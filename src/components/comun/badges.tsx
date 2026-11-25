import {
  ESTADO_CITACION_INFO,
  ESTADO_DIAGNOSTICO_INFO,
  ESTADO_INFO,
  ROL_INFO,
  TIPO_INFO,
  type EstadoCitacion,
  type EstadoDiagnostico,
  type EstadoExpediente,
  type Rol,
  type TipoDenuncia,
} from "@/lib/dominio/constantes";
import type { EstadoPlazo } from "@/lib/dominio/fechas";
import { cn } from "@/lib/utils";

/** Etiqueta redondeada con borde suave (las clases de color vienen de constantes.ts). */
export function Etiqueta({ className, children, title }: { className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EstadoBadge({ estado }: { estado: EstadoExpediente }) {
  const info = ESTADO_INFO[estado];
  return (
    <Etiqueta className={info.badge} title={info.descripcion}>
      {info.nombre}
    </Etiqueta>
  );
}

export function TipoBadge({ tipo, largo = false }: { tipo: TipoDenuncia; largo?: boolean }) {
  const info = TIPO_INFO[tipo];
  return (
    <Etiqueta className={info.badge} title={info.nombre}>
      {largo ? info.nombre : info.corto}
    </Etiqueta>
  );
}

export function EstadoDiagnosticoBadge({ estado }: { estado: EstadoDiagnostico }) {
  const info = ESTADO_DIAGNOSTICO_INFO[estado];
  return <Etiqueta className={info.badge}>{info.nombre}</Etiqueta>;
}

export function EstadoCitacionBadge({ estado }: { estado: EstadoCitacion }) {
  const info = ESTADO_CITACION_INFO[estado];
  return <Etiqueta className={info.badge}>{info.nombre}</Etiqueta>;
}

export function RolBadge({ rol }: { rol: Rol }) {
  const info = ROL_INFO[rol];
  return (
    <Etiqueta className={info.badge}>
      <span className={cn("size-1.5 rounded-full", info.punto)} />
      {info.nombre}
    </Etiqueta>
  );
}

const NIVEL_CLASE: Record<EstadoPlazo["nivel"], string> = {
  vencido: "bg-red-50 text-red-800 ring-red-600/25",
  hoy: "bg-orange-50 text-orange-800 ring-orange-600/25",
  proximo: "bg-amber-50 text-amber-800 ring-amber-600/25",
  en_termino: "bg-zinc-50 text-zinc-700 ring-zinc-500/20",
};

/** Plazo con color según urgencia. `nombre` opcional delante del texto. */
export function PlazoBadge({ plazo, nombre }: { plazo: EstadoPlazo; nombre?: string }) {
  return (
    <Etiqueta className={NIVEL_CLASE[plazo.nivel]} title={`Vence el ${plazo.vence.split("-").reverse().join("/")}`}>
      {nombre ? <span className="font-normal opacity-80">{nombre}:</span> : null}
      {plazo.texto}
    </Etiqueta>
  );
}

/** Marca de "simulado" para todo lo que en el MVP no se conecta de verdad. */
export function Simulado({ texto = "Simulado" }: { texto?: string }) {
  return <Etiqueta className="bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-600/20">{texto}</Etiqueta>;
}
