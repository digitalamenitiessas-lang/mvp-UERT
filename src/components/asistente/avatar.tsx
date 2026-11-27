/**
 * Marca de Yanapa: el sol de ocho puntas del escudo de Santiago del Estero,
 * en blanco sobre el azul institucional, con el centro dorado del escudo.
 */
import { cn } from "@/lib/utils";

/** Puntos de una estrella de 8 puntas centrada en (20, 20). */
const ESTRELLA = Array.from({ length: 16 }, (_, k) => {
  const angulo = (k * Math.PI) / 8 - Math.PI / 2;
  const radio = k % 2 === 0 ? 12.5 : 5.6;
  return `${(20 + radio * Math.cos(angulo)).toFixed(2)},${(20 + radio * Math.sin(angulo)).toFixed(2)}`;
}).join(" ");

/** Solo el sol (para el botón flotante, sobre el azul). */
export function SolSDE({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-7", className)} aria-hidden>
      <polygon points={ESTRELLA} fill="currentColor" />
      <circle cx="20" cy="20" r="3.6" fill="#d6b452" />
      <circle cx="20" cy="20" r="3.6" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="0.8" />
    </svg>
  );
}

/** Avatar redondo de Yanapa: el sol sobre el azul, con borde claro. */
export function AvatarYanapa({ className, enLinea = false }: { className?: string; enLinea?: boolean }) {
  return (
    <span className={cn("relative inline-flex size-9 shrink-0 rounded-full", className)}>
      <span className="flex size-full items-center justify-center rounded-full bg-primary text-white ring-2 ring-white/90">
        <SolSDE className="size-[72%]" />
      </span>
      {enLinea ? (
        <span
          className="absolute right-0 bottom-0 size-2.5 rounded-full bg-emerald-400 ring-2 ring-primary"
          aria-label="En línea"
        />
      ) : null}
    </span>
  );
}
