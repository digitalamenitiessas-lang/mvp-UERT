"use client";

/**
 * Cómo se ven los mensajes del asistente: burbujas de Yanapa (con sus
 * bloques: pasos, listas, indicadores, expedientes…) y del usuario (texto,
 * audio con su onda y archivo adjunto).
 */
import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CircleAlertIcon,
  FileTextIcon,
  InfoIcon,
  MicIcon,
  PauseIcon,
  PlayIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { EstadoBadge, PlazoBadge, TipoBadge } from "@/components/comun/badges";
import type { Bloque, ExpedienteResumen, Respuesta, Sugerencia } from "@/lib/asistente/tipos";
import type { Rol } from "@/lib/dominio/constantes";
import { cn } from "@/lib/utils";
import { AvatarYanapa } from "./avatar";

// ---------------------------------------------------------------------------
// Modelo
// ---------------------------------------------------------------------------
export type Mensaje =
  /**
   * `rol` y `ruta`: con qué rol y en qué pantalla se respondió. Si después
   * cambian, las sugerencias pasan a ser las del rol o la pantalla nueva.
   */
  | { id: string; de: "bot"; hora: number; respuesta: Respuesta; rol: Rol | null; ruta?: string }
  | { id: string; de: "usuario"; hora: number; tipo: "texto"; texto: string }
  | {
      id: string;
      de: "usuario";
      hora: number;
      tipo: "audio";
      /** Sin url después de recargar la página (el audio no se guarda). */
      url?: string;
      segundos: number;
      niveles: number[];
      transcripcion: string | null;
    }
  | {
      id: string;
      de: "usuario";
      hora: number;
      tipo: "archivo";
      nombre: string;
      tamano: number;
      mime: string;
      /** Vista previa de una imagen (solo mientras dura la página). */
      vistaPrevia?: string;
    };

export const hora = (ms: number) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(ms);

export const duracion = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString("es-AR")} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}

// ---------------------------------------------------------------------------
// Texto con **negrita**
// ---------------------------------------------------------------------------
function ConNegrita({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linea, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {linea.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
            parte.startsWith("**") && parte.endsWith("**") ? (
              <strong key={j} className="font-semibold text-foreground">
                {parte.slice(2, -2)}
              </strong>
            ) : (
              <Fragment key={j}>{parte}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bloques de una respuesta
// ---------------------------------------------------------------------------
function TarjetaExpediente({ e, onNavegar }: { e: ExpedienteResumen; onNavegar: () => void }) {
  return (
    <Link
      href={`/expedientes/${e.id}`}
      onClick={onNavegar}
      className="group block rounded-xl border bg-background p-2.5 transition hover:border-primary/40 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-semibold text-primary">{e.numero}</span>
        <TipoBadge tipo={e.tipo} />
        <ArrowRightIcon className="ml-auto size-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </span>
      <span className="mt-1 block truncate text-[13px] font-medium">{e.persona}</span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <EstadoBadge estado={e.estado} />
        {e.plazo ? <PlazoBadge plazo={e.plazo} nombre={e.plazo.nombre} /> : null}
      </span>
      {e.detalle ? <span className="mt-1.5 block text-xs leading-snug text-muted-foreground">{e.detalle}</span> : null}
    </Link>
  );
}

const TONO_ICONO = {
  alerta: <TriangleAlertIcon className="size-3.5 text-amber-600" aria-label="Atención" />,
  peligro: <CircleAlertIcon className="size-3.5 text-red-600" aria-label="Urgente" />,
};

function VistaBloque({ b, onNavegar }: { b: Bloque; onNavegar: () => void }) {
  switch (b.tipo) {
    case "texto":
      return (
        <p className="leading-relaxed">
          <ConNegrita texto={b.texto} />
        </p>
      );
    case "nota":
      return (
        <p className="flex gap-2 rounded-lg bg-muted px-2.5 py-2 text-xs leading-snug text-muted-foreground">
          <InfoIcon className="mt-px size-3.5 shrink-0 text-sde-celeste" />
          <span>
            <ConNegrita texto={b.texto} />
          </span>
        </p>
      );
    case "pasos":
      return (
        <div className="space-y-2">
          {b.titulo ? <p className="font-medium">{b.titulo}</p> : null}
          <ol className="space-y-2">
            {b.pasos.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="leading-snug">
                  <ConNegrita texto={p} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      );
    case "lista":
      return (
        <div className="space-y-2">
          {b.titulo ? <p className="font-medium">{b.titulo}</p> : null}
          <ul className="space-y-1.5">
            {b.items.map((it, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-sde-celeste" aria-hidden />
                <span className="leading-snug">
                  <span className="font-medium">{it.titulo}</span>
                  {it.detalle ? <span className="block text-xs text-muted-foreground">{it.detalle}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "indicadores":
      return (
        <div className="grid grid-cols-2 gap-1.5 [&>*:last-child:nth-child(odd)]:col-span-2">
          {b.items.map((it, i) => (
            <div key={i} className="rounded-lg border bg-background px-2.5 py-2">
              <p className="text-xl leading-none font-bold tabular-nums">{it.valor}</p>
              <p className="mt-1 flex items-start gap-1 text-[11px] leading-tight text-muted-foreground">
                {it.tono && it.tono !== "normal" && it.valor > 0 ? TONO_ICONO[it.tono] : null}
                <span>{it.etiqueta}</span>
              </p>
            </div>
          ))}
        </div>
      );
    case "expedientes":
      return b.items.length ? (
        <div className="space-y-1.5">
          {b.items.map((e) => (
            <TarjetaExpediente key={`${e.id}-${e.detalle ?? ""}`} e={e} onNavegar={onNavegar} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">{b.vacio ?? "No hay expedientes para mostrar."}</p>
      );
    case "enlaces":
      return (
        <div className="flex flex-wrap gap-1.5">
          {b.enlaces.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavegar}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {l.texto}
              <ArrowRightIcon className="size-3.5" />
            </Link>
          ))}
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Burbujas
// ---------------------------------------------------------------------------
export function BurbujaBot({
  respuesta,
  horaMs,
  onNavegar,
}: {
  respuesta: Respuesta;
  horaMs: number;
  onNavegar: () => void;
}) {
  return (
    <div className="flex items-end gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
      <AvatarYanapa className="mb-5 size-7 ring-0" />
      <div className="min-w-0 max-w-[88%]">
        <div className="space-y-2.5 rounded-2xl rounded-bl-md border border-border/80 bg-background px-3.5 py-2.5 text-[13.5px] text-foreground/90 shadow-xs">
          {respuesta.bloques.map((b, i) => (
            <VistaBloque key={i} b={b} onNavegar={onNavegar} />
          ))}
        </div>
        <p className="mt-1 pl-1 text-[10.5px] text-muted-foreground">Yanapa · {hora(horaMs)}</p>
      </div>
    </div>
  );
}

function ReproductorAudio({ m }: { m: Extract<Mensaje, { tipo: "audio" }> }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  const [avance, setAvance] = useState(0);
  const alternar = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };
  return (
    <div className="flex items-center gap-2.5">
      {m.url ? (
        <>
          <button
            type="button"
            onClick={alternar}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-primary transition hover:scale-105 focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none"
            aria-label={sonando ? "Pausar el audio" : "Escuchar el audio"}
          >
            {sonando ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4 translate-x-px" />}
          </button>
          <audio
            ref={audio}
            src={m.url}
            preload="metadata"
            onPlay={() => setSonando(true)}
            onPause={() => setSonando(false)}
            onEnded={() => {
              setSonando(false);
              setAvance(0);
            }}
            onTimeUpdate={(e) => {
              const a = e.currentTarget;
              setAvance(a.duration && Number.isFinite(a.duration) ? a.currentTime / a.duration : a.currentTime / m.segundos);
            }}
          />
        </>
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15" title="El audio no se guarda al recargar">
          <MicIcon className="size-4" />
        </span>
      )}
      <span className="flex h-7 min-w-0 flex-1 items-center gap-[2px] overflow-hidden" aria-hidden>
        {m.niveles.map((n, i) => (
          <span
            key={i}
            className={cn(
              "w-[2px] shrink-0 rounded-full transition-colors",
              i / m.niveles.length < avance ? "bg-white" : "bg-white/45",
            )}
            style={{ height: `${Math.round(18 + n * 82)}%` }}
          />
        ))}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-white/85">{duracion(m.segundos)}</span>
    </div>
  );
}

export function BurbujaUsuario({ m }: { m: Extract<Mensaje, { de: "usuario" }> }) {
  return (
    <div className="flex flex-col items-end motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-br-md bg-primary text-[13.5px] text-primary-foreground shadow-xs",
          m.tipo === "archivo" && m.vistaPrevia ? "overflow-hidden p-1" : "px-3.5 py-2.5",
          m.tipo === "audio" && "w-64 max-w-[85%]",
        )}
      >
        {m.tipo === "texto" ? <p className="leading-relaxed break-words whitespace-pre-wrap">{m.texto}</p> : null}
        {m.tipo === "audio" ? (
          <>
            <ReproductorAudio m={m} />
            <p className="mt-2 border-t border-white/15 pt-1.5 text-xs leading-snug text-white/85">
              {m.transcripcion ? (
                <>
                  <span className="font-medium text-white">Transcripción: </span>«{m.transcripcion}»
                </>
              ) : (
                "Sin transcripción"
              )}
            </p>
          </>
        ) : null}
        {m.tipo === "archivo" ? (
          m.vistaPrevia ? (
            <figure>
              {/* Vista previa local (object URL): next/image no aplica. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.vistaPrevia} alt={m.nombre} className="max-h-48 w-full rounded-xl object-cover" />
              <figcaption className="truncate px-2 py-1 text-xs text-white/85">
                {m.nombre} · {tamanoLegible(m.tamano)}
              </figcaption>
            </figure>
          ) : (
            <span className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <FileTextIcon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{m.nombre}</span>
                <span className="block text-xs text-white/75">{tamanoLegible(m.tamano)}</span>
              </span>
            </span>
          )
        ) : null}
      </div>
      <p className="mt-1 pr-1 text-[10.5px] text-muted-foreground">{hora(m.hora)}</p>
    </div>
  );
}

/** Tres puntos mientras Yanapa «escribe». */
export function Escribiendo() {
  return (
    <div className="flex items-end gap-2" aria-live="polite">
      <AvatarYanapa className="size-7 ring-0" />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-border/80 bg-background px-3.5 py-3 shadow-xs">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="size-1.5 rounded-full bg-primary/60 motion-safe:animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
        <span className="sr-only">Yanapa está escribiendo</span>
      </div>
    </div>
  );
}

/** Preguntas para seguir (chips). */
export function Chips({
  items,
  onElegir,
  deshabilitado,
}: {
  items: Sugerencia[];
  onElegir: (s: Sugerencia) => void;
  deshabilitado?: boolean;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pl-9 motion-safe:animate-in motion-safe:fade-in">
      {items.map((s) => (
        <button
          key={s.intencion}
          type="button"
          disabled={deshabilitado}
          onClick={() => onElegir(s)}
          className="rounded-full border border-primary/25 bg-background px-3 py-1.5 text-left text-xs font-medium text-primary transition hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          {s.texto}
        </button>
      ))}
    </div>
  );
}
