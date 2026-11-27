"use client";

/**
 * Dónde se escribe: texto, adjuntar un archivo o grabar un audio. Como en
 * cualquier mensajería: sin texto, el botón es el micrófono; con texto, enviar.
 */
import { useRef, useState } from "react";
import { LoaderCircleIcon, MicIcon, PaperclipIcon, SendHorizontalIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { duracion } from "./mensajes";
import { MAX_SEGUNDOS, useGrabador, type AudioGrabado } from "./use-grabador";

const ACEPTA = "image/*,application/pdf,.doc,.docx,.odt";

export function Compositor({
  deshabilitado,
  primeraVez,
  onTexto,
  onArchivo,
  onAudio,
  onErrorAudio,
}: {
  deshabilitado: boolean;
  /** Antes del primer mensaje se muestra qué se puede mandar. */
  primeraVez: boolean;
  onTexto: (texto: string) => void;
  onArchivo: (archivo: File) => void;
  onAudio: (audio: AudioGrabado) => void;
  onErrorAudio: (motivo: "permiso" | "sin_microfono" | "no_soportado") => void;
}) {
  const [texto, setTexto] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const grabador = useGrabador({ onListo: onAudio, onError: onErrorAudio });

  const ajustarAlto = () => {
    const t = area.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
  };

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio || deshabilitado) return;
    onTexto(limpio);
    setTexto("");
    requestAnimationFrame(() => {
      ajustarAlto();
      area.current?.focus();
    });
  };

  const grabando = grabador.estado !== "inactivo";

  if (grabando) {
    const barras = [...Array.from({ length: Math.max(0, 28 - grabador.vivo.length) }, () => 0), ...grabador.vivo];
    const max = Math.max(0.06, ...grabador.vivo);
    return (
      <div className="border-t bg-background px-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={grabador.cancelar}
            disabled={grabador.estado === "procesando"}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-red-50 hover:text-red-600 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40"
            aria-label="Descartar el audio"
          >
            <Trash2Icon className="size-5" />
          </button>
          <div className="flex h-10 flex-1 items-center gap-2.5 rounded-full bg-muted px-3.5">
            {grabador.estado === "grabando" ? (
              <span className="relative flex size-2.5 shrink-0">
                <span className="absolute inline-flex size-full rounded-full bg-red-500 opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
              </span>
            ) : (
              <LoaderCircleIcon className="size-4 shrink-0 text-primary motion-safe:animate-spin" />
            )}
            <span className="w-9 shrink-0 text-sm font-medium tabular-nums">{duracion(grabador.segundos)}</span>
            <span className="flex h-6 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden>
              {barras.map((n, i) => (
                <span
                  key={i}
                  className="w-[3px] shrink-0 rounded-full bg-primary/70 transition-[height] duration-75"
                  style={{ height: `${Math.round(12 + Math.min(1, n / max) * 88)}%` }}
                />
              ))}
            </span>
          </div>
          <button
            type="button"
            onClick={grabador.terminar}
            disabled={grabador.estado !== "grabando"}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
            aria-label="Enviar el audio"
          >
            <SendHorizontalIcon className="size-[18px]" />
          </button>
        </div>
        <p className="mt-2 truncate px-1 text-center text-[11px] text-muted-foreground" aria-live="polite">
          {grabador.estado === "pidiendo"
            ? "Pidiendo permiso para usar el micrófono…"
            : grabador.estado === "procesando"
              ? "Procesando el audio…"
              : grabador.parcial
                ? `«${grabador.parcial}»`
                : grabador.puedeTranscribir
                  ? `Te escucho… hablá con naturalidad (hasta ${MAX_SEGUNDOS} s)`
                  : `Grabando (hasta ${MAX_SEGUNDOS} s)`}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t bg-background px-3 pt-3 pb-2.5">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <button
          type="button"
          onClick={() => archivo.current?.click()}
          disabled={deshabilitado}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40"
          aria-label="Adjuntar un archivo"
          title="Adjuntar una foto o un PDF"
        >
          <PaperclipIcon className="size-5" />
        </button>
        <input
          ref={archivo}
          type="file"
          accept={ACEPTA}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onArchivo(f);
          }}
        />
        <textarea
          ref={area}
          value={texto}
          rows={1}
          maxLength={500}
          onChange={(e) => {
            setTexto(e.target.value);
            ajustarAlto();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder="Escribí tu consulta…"
          aria-label="Escribí tu consulta"
          data-asistente-entrada
          className="max-h-[120px] min-h-10 flex-1 resize-none rounded-[20px] border border-transparent bg-muted px-4 py-2.5 text-sm leading-5 outline-none placeholder:text-muted-foreground focus-visible:border-primary/30 focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        {texto.trim() ? (
          <button
            type="submit"
            disabled={deshabilitado}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
            aria-label="Enviar"
          >
            <SendHorizontalIcon className="size-[18px]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void grabador.iniciar()}
            disabled={deshabilitado}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
            )}
            aria-label="Grabar un audio"
            title="Grabar un audio"
          >
            <MicIcon className="size-[18px]" />
          </button>
        )}
      </form>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        {primeraVez ? (
          <>
            Escribí, mandá un audio <MicIcon className="size-3" aria-hidden /> o adjuntá un archivo{" "}
            <PaperclipIcon className="size-3" aria-hidden />
          </>
        ) : (
          "Yanapa responde con las reglas del sistema y los datos de la demo."
        )}
      </p>
    </div>
  );
}
