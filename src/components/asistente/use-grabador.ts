"use client";

/**
 * Grabación de audios para el asistente: graba con MediaRecorder, mide el
 * volumen para dibujar la onda y, si el navegador lo permite (Chrome, Edge,
 * Safari), transcribe con el reconocimiento de voz del propio navegador.
 * No se sube el audio a ningún lado: queda en la página.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Lo mínimo del reconocimiento de voz del navegador (no está en los tipos del DOM). */
interface Reconocimiento {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructorReconocimiento = new () => Reconocimiento;

function reconocimientoDelNavegador(): ConstructorReconocimiento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocimiento; webkitSpeechRecognition?: ConstructorReconocimiento };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface AudioGrabado {
  url: string;
  segundos: number;
  /** Volumen normalizado (0–1) en 36 tramos, para dibujar la onda. */
  niveles: number[];
  /** Texto reconocido, o null si no se pudo. */
  transcripcion: string | null;
}

export type EstadoGrabador = "inactivo" | "pidiendo" | "grabando" | "procesando";

export const MAX_SEGUNDOS = 60;
const TRAMOS = 36;

/** Reduce la serie de volúmenes a `n` tramos y la escala a 0–1. */
function resumirNiveles(serie: number[], n = TRAMOS): number[] {
  if (!serie.length) return Array.from({ length: n }, () => 0.15);
  const max = Math.max(...serie, 0.05);
  return Array.from({ length: n }, (_, i) => {
    const desde = Math.floor((i * serie.length) / n);
    const hasta = Math.max(desde + 1, Math.floor(((i + 1) * serie.length) / n));
    const tramo = serie.slice(desde, hasta);
    const prom = tramo.reduce((s, v) => s + v, 0) / tramo.length;
    return Math.min(1, Math.max(0.12, prom / max));
  });
}

function tipoSoportado(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function useGrabador({
  onListo,
  onError,
}: {
  onListo: (audio: AudioGrabado) => void;
  onError: (motivo: "permiso" | "sin_microfono" | "no_soportado") => void;
}) {
  const [estado, setEstado] = useState<EstadoGrabador>("inactivo");
  const [segundos, setSegundos] = useState(0);
  /** Últimos volúmenes (para la onda en vivo). */
  const [vivo, setVivo] = useState<number[]>([]);
  /** Lo que va entendiendo el reconocimiento, mientras se habla. */
  const [parcial, setParcial] = useState("");

  const r = useRef<{
    stream: MediaStream | null;
    grabador: MediaRecorder | null;
    partes: Blob[];
    contexto: AudioContext | null;
    intervalo: number | null;
    inicio: number;
    serie: number[];
    reco: Reconocimiento | null;
    finales: string;
    descartar: boolean;
  }>({
    stream: null,
    grabador: null,
    partes: [],
    contexto: null,
    intervalo: null,
    inicio: 0,
    serie: [],
    reco: null,
    finales: "",
    descartar: false,
  });

  const limpiar = useCallback(() => {
    const s = r.current;
    if (s.intervalo !== null) window.clearInterval(s.intervalo);
    s.intervalo = null;
    s.stream?.getTracks().forEach((t) => t.stop());
    s.stream = null;
    void s.contexto?.close().catch(() => {});
    s.contexto = null;
  }, []);

  /** Espera a que el reconocimiento termine de entregar el texto (como mucho 1,5 s). */
  const textoFinal = useCallback(
    () =>
      new Promise<string | null>((resolver) => {
        const reco = r.current.reco;
        if (!reco) return resolver(null);
        let listo = false;
        const terminar = () => {
          if (listo) return;
          listo = true;
          const t = r.current.finales.trim();
          r.current.reco = null;
          resolver(t || null);
        };
        reco.onend = terminar;
        window.setTimeout(terminar, 1500);
        try {
          reco.stop();
        } catch {
          terminar();
        }
      }),
    [],
  );

  const terminar = useCallback(() => {
    const s = r.current;
    if (!s.grabador || s.grabador.state === "inactive") return;
    setEstado("procesando");
    s.grabador.stop();
  }, []);

  const iniciar = useCallback(async () => {
    if (estado !== "inactivo") return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError("no_soportado");
      return;
    }
    setEstado("pidiendo");
    const s = r.current;
    s.descartar = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setEstado("inactivo");
      if (s.descartar) return;
      const nombre = (e as DOMException)?.name;
      onError(nombre === "NotFoundError" || nombre === "OverconstrainedError" ? "sin_microfono" : "permiso");
      return;
    }
    // Si se canceló mientras el navegador pedía permiso, no se graba.
    if (s.descartar) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    s.stream = stream;
    s.partes = [];
    s.serie = [];
    s.finales = "";
    s.inicio = performance.now();

    // Volumen en vivo
    try {
      const contexto = new AudioContext();
      const analizador = contexto.createAnalyser();
      analizador.fftSize = 512;
      contexto.createMediaStreamSource(stream).connect(analizador);
      s.contexto = contexto;
      const datos = new Uint8Array(analizador.fftSize);
      s.intervalo = window.setInterval(() => {
        analizador.getByteTimeDomainData(datos);
        let suma = 0;
        for (const v of datos) suma += ((v - 128) / 128) ** 2;
        const nivel = Math.sqrt(suma / datos.length);
        s.serie.push(nivel);
        setVivo((prev) => [...prev.slice(-27), nivel]);
        const seg = (performance.now() - s.inicio) / 1000;
        setSegundos(seg);
        if (seg >= MAX_SEGUNDOS) terminar();
      }, 90);
    } catch {
      // Sin análisis de volumen: la onda queda plana, la grabación sigue.
    }

    // Grabación
    const tipo = tipoSoportado();
    const grabador = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    s.grabador = grabador;
    grabador.ondataavailable = (e) => {
      if (e.data.size) s.partes.push(e.data);
    };
    grabador.onstop = async () => {
      const duracion = (performance.now() - s.inicio) / 1000;
      limpiar();
      const transcripcion = await textoFinal();
      setVivo([]);
      setParcial("");
      setSegundos(0);
      setEstado("inactivo");
      if (s.descartar || duracion < 0.6) return;
      const blob = new Blob(s.partes, { type: grabador.mimeType || "audio/webm" });
      onListo({ url: URL.createObjectURL(blob), segundos: duracion, niveles: resumirNiveles(s.serie), transcripcion });
    };
    grabador.start(250);

    // Transcripción (si el navegador la tiene)
    const Reco = reconocimientoDelNavegador();
    if (Reco) {
      try {
        const reco = new Reco();
        reco.lang = "es-AR";
        reco.continuous = true;
        reco.interimResults = true;
        reco.onresult = (e) => {
          let interino = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal) s.finales += `${res[0].transcript} `;
            else interino += res[0].transcript;
          }
          setParcial(`${s.finales}${interino}`.trim());
        };
        reco.onerror = () => {};
        reco.start();
        s.reco = reco;
      } catch {
        s.reco = null;
      }
    }
    setEstado("grabando");
  }, [estado, limpiar, onError, onListo, terminar, textoFinal]);

  const cancelar = useCallback(() => {
    const s = r.current;
    s.descartar = true;
    try {
      s.reco?.abort();
    } catch {
      // nada
    }
    s.reco = null;
    if (s.grabador && s.grabador.state !== "inactive") s.grabador.stop();
    else {
      limpiar();
      setEstado("inactivo");
    }
  }, [limpiar]);

  // Si el componente se desmonta grabando, se suelta el micrófono.
  useEffect(() => () => limpiar(), [limpiar]);

  return {
    estado,
    segundos,
    vivo,
    parcial,
    puedeTranscribir: reconocimientoDelNavegador() !== null,
    iniciar,
    terminar,
    cancelar,
  };
}
