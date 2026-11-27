"use client";

/**
 * Yanapa, el asistente virtual de la UERT: botón flotante abajo a la derecha
 * que abre una conversación. Responde preguntas prearmadas o escritas, recibe
 * audios (los transcribe el navegador) y archivos (solo se registran nombre y
 * tamaño). No usa servicios de IA: ver src/lib/asistente.
 *
 * La conversación se guarda en sessionStorage: sigue al navegar, al cambiar
 * de rol y al recargar (los audios y las vistas previas no se guardan).
 */
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  ListIcon,
  MessageSquareTextIcon,
  MicIcon,
  PaperclipIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";
import { accionAsistente } from "@/app/acciones";
import { LogoSDE } from "@/components/app/marca";
import {
  bienvenida,
  NOMBRE_ASISTENTE,
  nombreDePila,
  preguntasPorTema,
  sugerenciasPara,
} from "@/lib/asistente/conocimiento";
import type { ConsultaAsistente, ContextoAsistente, Respuesta, Sugerencia } from "@/lib/asistente/tipos";
import { ROL_INFO, type Rol } from "@/lib/dominio/constantes";
import { cn } from "@/lib/utils";
import { AvatarYanapa, SolSDE } from "./avatar";
import { Compositor } from "./compositor";
import { BurbujaBot, BurbujaUsuario, Chips, Escribiendo, type Mensaje } from "./mensajes";
import type { AudioGrabado } from "./use-grabador";

const CLAVE_CONVERSACION = "uert_asistente_conversacion_v1";
const CLAVE_AVISO = "uert_asistente_aviso_visto";
/** Panel abierto: al cambiar de rol Next rearma la página y el panel se vuelve a abrir solo. */
const CLAVE_ABIERTO = "uert_asistente_abierto";

function recordar(clave: string, valor: boolean) {
  try {
    if (valor) window.sessionStorage.setItem(clave, "1");
    else window.sessionStorage.removeItem(clave);
  } catch {
    // Sin almacenamiento: no se recuerda.
  }
}

function recuerda(clave: string): boolean {
  try {
    return window.sessionStorage.getItem(clave) === "1";
  } catch {
    return false;
  }
}

let contador = 0;
const nuevoId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m${Date.now()}-${++contador}`;

function leerConversacion(): Mensaje[] {
  try {
    const crudo = window.sessionStorage.getItem(CLAVE_CONVERSACION);
    const lista = crudo ? (JSON.parse(crudo) as Mensaje[]) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function guardarConversacion(mensajes: Mensaje[]) {
  try {
    // Los audios y las vistas previas son object URLs: no sobreviven a una recarga.
    const sinBlobs = mensajes.map((m) =>
      m.de === "usuario" && m.tipo === "audio"
        ? { ...m, url: undefined }
        : m.de === "usuario" && m.tipo === "archivo"
          ? { ...m, vistaPrevia: undefined }
          : m,
    );
    window.sessionStorage.setItem(CLAVE_CONVERSACION, JSON.stringify(sinBlobs.slice(-60)));
  } catch {
    // Sin almacenamiento (modo privado): la conversación vive mientras esté la página.
  }
}

function soltarBlobs(mensajes: Mensaje[]) {
  for (const m of mensajes) {
    if (m.de === "usuario" && m.tipo === "audio" && m.url) URL.revokeObjectURL(m.url);
    if (m.de === "usuario" && m.tipo === "archivo" && m.vistaPrevia) URL.revokeObjectURL(m.vistaPrevia);
  }
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Respuesta armada en el navegador (errores del micrófono o de conexión). */
const respuestaLocal = (intencion: string, textos: string[], ctx: ContextoAsistente): Respuesta => ({
  intencion,
  bloques: textos.map((t) => ({ tipo: "texto" as const, texto: t })),
  sugerencias: sugerenciasPara(ctx),
});

export function Asistente({ usuario }: { usuario: { nombre: string; rol: Rol } | null }) {
  const ruta = usePathname();
  const rol = usuario?.rol ?? null;
  const ctx: ContextoAsistente = { rol, nombre: nombreDePila(usuario?.nombre), ruta };

  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<"chat" | "temas">("chat");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargado, setCargado] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [aviso, setAviso] = useState(false);

  const lista = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const mensajesRef = useRef<Mensaje[]>([]);

  // Guardar la conversación y bajar al último mensaje.
  useEffect(() => {
    mensajesRef.current = mensajes;
    if (cargado) guardarConversacion(mensajes);
  }, [mensajes, cargado]);

  useEffect(() => {
    if (!abierto || vista !== "chat") return;
    const l = lista.current;
    if (l) l.scrollTo({ top: l.scrollHeight, behavior: mensajes.length > 2 ? "smooth" : "auto" });
  }, [mensajes.length, pendiente, abierto, vista]);

  // Al desmontar, soltar los audios y las imágenes.
  useEffect(() => () => soltarBlobs(mensajesRef.current), []);

  const verAviso = () => {
    setAviso(false);
    recordar(CLAVE_AVISO, true);
  };

  const mensajeBienvenida = (): Mensaje => ({
    id: nuevoId(),
    de: "bot",
    hora: Date.now(),
    respuesta: bienvenida(ctx),
    rol,
    ruta,
  });

  const abrir = (enfocar = true) => {
    verAviso();
    if (!cargado) {
      const guardados = leerConversacion();
      setMensajes(guardados.length ? guardados : [mensajeBienvenida()]);
      setCargado(true);
    }
    setVista("chat");
    setAbierto(true);
    recordar(CLAVE_ABIERTO, true);
    if (enfocar) {
      requestAnimationFrame(() => panel.current?.querySelector<HTMLTextAreaElement>("[data-asistente-entrada]")?.focus());
    }
  };

  // Si estaba abierto (cambio de rol, recarga), se vuelve a abrir. Si no, el
  // aviso «¿Te ayudo?» aparece una vez por sesión, a los pocos segundos.
  const reabrir = useEffectEvent(() => {
    if (recuerda(CLAVE_ABIERTO)) abrir(false);
  });
  useEffect(() => {
    const cuadro = window.requestAnimationFrame(() => reabrir());
    const t = window.setTimeout(() => {
      if (!recuerda(CLAVE_AVISO) && !recuerda(CLAVE_ABIERTO)) setAviso(true);
    }, 2500);
    return () => {
      window.cancelAnimationFrame(cuadro);
      window.clearTimeout(t);
    };
  }, []);

  const cerrar = () => {
    setAbierto(false);
    recordar(CLAVE_ABIERTO, false);
    requestAnimationFrame(() => boton.current?.focus());
  };

  const reiniciar = () => {
    soltarBlobs(mensajes);
    setMensajes([mensajeBienvenida()]);
    setVista("chat");
  };

  /** En el celular el panel tapa la pantalla: al ir a un expediente, se cierra. */
  const alNavegar = () => {
    if (window.matchMedia("(max-width: 639px)").matches) {
      setAbierto(false);
      recordar(CLAVE_ABIERTO, false);
    }
  };

  const responderBot = (respuesta: Respuesta) =>
    setMensajes((m) => [...m, { id: nuevoId(), de: "bot", hora: Date.now(), respuesta, rol, ruta }]);

  async function consultar(consulta: Omit<ConsultaAsistente, "ruta">, delUsuario: Mensaje) {
    setMensajes((m) => [...m, delUsuario]);
    setPendiente(true);
    const inicio = Date.now();
    let respuesta: Respuesta;
    try {
      const res = await accionAsistente({ ...consulta, ruta });
      respuesta = res.ok ? res.datos : respuestaLocal("error", [res.error], ctx);
    } catch {
      respuesta = respuestaLocal("error", ["No me pude conectar. Revisá la conexión y probá de nuevo."], ctx);
    }
    // Una pausa breve, como quien escribe: más larga si la respuesta es larga.
    const largo = JSON.stringify(respuesta.bloques).length;
    await esperar(Math.max(0, 450 + Math.min(650, largo / 3) - (Date.now() - inicio)));
    setPendiente(false);
    responderBot(respuesta);
  }

  const elegir = (s: Sugerencia) => {
    setVista("chat");
    void consultar(
      { texto: s.texto, intencion: s.intencion },
      { id: nuevoId(), de: "usuario", hora: Date.now(), tipo: "texto", texto: s.texto },
    );
  };

  const escribir = (texto: string) =>
    void consultar({ texto }, { id: nuevoId(), de: "usuario", hora: Date.now(), tipo: "texto", texto });

  const adjuntar = (f: File) =>
    void consultar(
      { texto: "", adjunto: { nombre: f.name, tipo: f.type, tamano: f.size } },
      {
        id: nuevoId(),
        de: "usuario",
        hora: Date.now(),
        tipo: "archivo",
        nombre: f.name,
        tamano: f.size,
        mime: f.type,
        vistaPrevia: f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined,
      },
    );

  const audio = (a: AudioGrabado) =>
    void consultar(a.transcripcion ? { texto: a.transcripcion } : { texto: "", audioSinTexto: { segundos: a.segundos } }, {
      id: nuevoId(),
      de: "usuario",
      hora: Date.now(),
      tipo: "audio",
      url: a.url,
      segundos: a.segundos,
      niveles: a.niveles,
      transcripcion: a.transcripcion,
    });

  const errorAudio = (motivo: "permiso" | "sin_microfono" | "no_soportado") =>
    responderBot(
      respuestaLocal(
        "audio_error",
        motivo === "permiso"
          ? [
              "No pude usar el micrófono: el navegador no dio permiso.",
              "Habilitalo desde el candado de la barra de direcciones y volvé a probar. Mientras tanto, escribime o elegí una pregunta.",
            ]
          : motivo === "sin_microfono"
            ? ["No encontré un micrófono conectado. Podés escribirme o elegir una pregunta."]
            : ["Este navegador no permite grabar audio. Podés escribirme o elegir una pregunta."],
        ctx,
      ),
    );

  const ultimo = mensajes.at(-1);
  const ultimoBot = mensajes.findLast((m) => m.de === "bot");
  /** Si cambió de rol desde la última respuesta, se avisa y se sugiere lo del rol nuevo. */
  const cambioDeRol = Boolean(ultimoBot && ultimoBot.de === "bot" && ultimoBot.rol !== rol && rol);
  /** Si cambió de pantalla, las sugerencias pasan a ser las de la pantalla nueva. */
  const cambioDePantalla = Boolean(ultimoBot && ultimoBot.de === "bot" && ultimoBot.ruta && ultimoBot.ruta !== ruta);
  const primeraVez = !mensajes.some((m) => m.de === "usuario");

  return (
    <div className="no-imprimir">
      {/* Panel */}
      {abierto ? (
        <div
          ref={panel}
          role="dialog"
          aria-modal="false"
          aria-labelledby="asistente-titulo"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              if (vista === "temas") setVista("chat");
              else cerrar();
            }
          }}
          className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-background shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 sm:inset-auto sm:right-5 sm:bottom-[5.75rem] sm:h-[min(680px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:motion-safe:zoom-in-95 sm:motion-safe:slide-in-from-bottom-2"
        >
          {/* Encabezado institucional */}
          <header className="bg-primary text-primary-foreground">
            <div className="flex items-center gap-3 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3">
              <AvatarYanapa enLinea className="size-10" />
              <div className="min-w-0 leading-tight">
                <p id="asistente-titulo" className="text-base font-bold tracking-wide">
                  {NOMBRE_ASISTENTE}
                </p>
                <p className="truncate text-xs text-white/80">Asistente virtual de la UERT · En línea</p>
              </div>
              <div className="ml-auto flex items-center gap-0.5">
                <BotonEncabezado
                  etiqueta={vista === "temas" ? "Volver a la conversación" : "Todas las preguntas"}
                  onClick={() => setVista(vista === "temas" ? "chat" : "temas")}
                >
                  {vista === "temas" ? <MessageSquareTextIcon /> : <ListIcon />}
                </BotonEncabezado>
                <BotonEncabezado etiqueta="Nueva conversación" onClick={reiniciar}>
                  <RotateCcwIcon />
                </BotonEncabezado>
                <BotonEncabezado etiqueta="Cerrar el asistente" onClick={cerrar}>
                  <XIcon />
                </BotonEncabezado>
              </div>
            </div>
            {/* Filete celeste, como las franjas del escudo */}
            <div className="h-[3px] bg-sde-celeste" aria-hidden />
          </header>

          {vista === "temas" ? (
            <TodasLasPreguntas onVolver={() => setVista("chat")} onElegir={elegir} deshabilitado={pendiente} />
          ) : (
            <>
              <div ref={lista} role="log" aria-live="polite" className="flex-1 space-y-4 overflow-y-auto bg-muted px-3.5 py-4">
                <Presentacion />
                {mensajes.map((m) =>
                  m.de === "bot" ? (
                    <div key={m.id} className="space-y-2">
                      <BurbujaBot respuesta={m.respuesta} horaMs={m.hora} onNavegar={alNavegar} />
                      {m === ultimo && !pendiente && !cambioDeRol ? (
                        <Chips
                          items={cambioDePantalla ? sugerenciasPara(ctx) : m.respuesta.sugerencias}
                          onElegir={elegir}
                          deshabilitado={pendiente}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <BurbujaUsuario key={m.id} m={m} />
                  ),
                )}
                {pendiente ? <Escribiendo /> : null}
                {cambioDeRol && !pendiente && rol ? (
                  <div className="space-y-2 motion-safe:animate-in motion-safe:fade-in">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="h-px flex-1 bg-border" />
                      Ahora estás como <span className="font-semibold text-foreground">{ROL_INFO[rol].nombre}</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <Chips items={sugerenciasPara(ctx)} onElegir={elegir} />
                  </div>
                ) : null}
              </div>
              <Compositor
                deshabilitado={pendiente}
                primeraVez={primeraVez}
                onTexto={escribir}
                onArchivo={adjuntar}
                onAudio={audio}
                onErrorAudio={errorAudio}
              />
            </>
          )}
        </div>
      ) : null}

      {/* Aviso «¿Te ayudo?» */}
      {aviso && !abierto ? (
        <div className="fixed right-5 bottom-[5.75rem] z-40 w-64 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          <div className="relative rounded-2xl rounded-br-md border bg-background p-3.5 pr-8 shadow-lg">
            <button
              type="button"
              onClick={verAviso}
              className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Cerrar el aviso"
            >
              <XIcon className="size-3.5" />
            </button>
            <button type="button" onClick={() => abrir()} className="text-left">
              <p className="text-sm font-semibold">¿Te ayudo{ctx.nombre ? `, ${ctx.nombre}` : ""}?</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                Soy {NOMBRE_ASISTENTE}. Preguntame por tus pendientes, los plazos o cualquier expediente.
              </p>
            </button>
          </div>
        </div>
      ) : null}

      {/* Botón flotante */}
      <button
        ref={boton}
        type="button"
        onClick={abierto ? cerrar : () => abrir()}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar el asistente virtual" : `Abrir el asistente virtual ${NOMBRE_ASISTENTE}`}
        title={abierto ? undefined : `${NOMBRE_ASISTENTE} · Asistente virtual`}
        className={cn(
          "group fixed right-5 bottom-5 z-40 size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-4 ring-white/70 transition hover:scale-105 hover:shadow-xl focus-visible:ring-sde-celeste focus-visible:outline-none active:scale-95",
          abierto ? "hidden sm:flex" : "flex",
        )}
      >
        <span className={cn("transition duration-200", abierto ? "scale-0 rotate-90 opacity-0" : "scale-100 opacity-100")}>
          <SolSDE className="size-8 transition-transform duration-500 group-hover:rotate-45" />
        </span>
        <XIcon
          className={cn(
            "absolute size-6 transition duration-200",
            abierto ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0",
          )}
        />
        {!abierto ? (
          <span className="absolute top-0.5 right-0.5 size-3 rounded-full bg-emerald-400 ring-2 ring-primary" aria-hidden />
        ) : null}
      </button>
    </div>
  );
}

function BotonEncabezado({
  etiqueta,
  onClick,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex size-8 items-center justify-center rounded-full text-white/85 transition hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none [&_svg]:size-[18px]"
    >
      {children}
    </button>
  );
}

/** Cabecera de la conversación: quién es Yanapa y qué se le puede mandar. */
function Presentacion() {
  return (
    <div className="flex flex-col items-center px-4 pt-1 pb-2 text-center">
      <AvatarYanapa className="size-14 ring-4 ring-background" />
      <p className="mt-2 text-base font-bold">{NOMBRE_ASISTENTE}</p>
      <p className="text-xs text-muted-foreground">Unidad Ejecutora de Riesgos del Trabajo</p>
      <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
        {[
          { icono: MessageSquareTextIcon, texto: "Texto" },
          { icono: MicIcon, texto: "Audios" },
          { icono: PaperclipIcon, texto: "Archivos" },
        ].map(({ icono: Icono, texto }) => (
          <span
            key={texto}
            className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border"
          >
            <Icono className="size-3 text-primary" />
            {texto}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Todas las preguntas prearmadas, por tema. */
function TodasLasPreguntas({
  onVolver,
  onElegir,
  deshabilitado,
}: {
  onVolver: () => void;
  onElegir: (s: Sugerencia) => void;
  deshabilitado: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted">
      <div className="flex items-center gap-2 border-b bg-background px-3 py-2.5">
        <button
          type="button"
          onClick={onVolver}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Volver a la conversación"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <p className="text-sm font-semibold">Todas las preguntas</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3.5 py-4">
        {preguntasPorTema().map(({ tema, preguntas }) => (
          <section key={tema}>
            <h3 className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-primary uppercase">{tema}</h3>
            <div className="divide-y overflow-hidden rounded-xl border bg-background">
              {preguntas.map((p) => (
                <button
                  key={p.intencion}
                  type="button"
                  disabled={deshabilitado}
                  onClick={() => onElegir(p)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] transition hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50"
                >
                  <span className="flex-1">{p.texto}</span>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </section>
        ))}
        <div className="flex flex-col items-center gap-1.5 pt-2 pb-1 text-center">
          <LogoSDE variante="azul" className="h-7 opacity-80" />
          <p className="text-[11px] text-muted-foreground">
            {NOMBRE_ASISTENTE} responde con las reglas del sistema y los datos de la demo.
          </p>
        </div>
      </div>
    </div>
  );
}
