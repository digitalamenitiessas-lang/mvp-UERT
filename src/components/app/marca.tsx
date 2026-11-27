/**
 * Identidad del Gobierno de la Provincia de Santiago del Estero: el logo
 * (escudo + «Santiago del Estero») tomado de sde.gob.ar. El escudo en color
 * es el ícono de la app (src/app/icon.svg).
 *
 * Los SVG se importan (no van en /public) para que Next les ponga el prefijo
 * de la VPS (/uert) y el tamaño solos.
 */
import Image from "next/image";
import logoAzul from "@/assets/marca/sde-logo-azul.svg";
import logoBlanco from "@/assets/marca/sde-logo-blanco.svg";
import { cn } from "@/lib/utils";

/** Logo de Santiago del Estero: blanco sobre el azul institucional, azul sobre fondo claro (y en papel). */
export function LogoSDE({ variante, className }: { variante: "blanco" | "azul"; className?: string }) {
  return (
    <Image
      src={variante === "blanco" ? logoBlanco : logoAzul}
      alt="Gobierno de la Provincia de Santiago del Estero"
      loading="eager"
      className={cn("h-9 w-auto", className)}
    />
  );
}

/**
 * Marca de la aplicación: logo de la Provincia | UERT · Gestión de denuncias.
 * `sobre="azul"` para la barra institucional; `sobre="claro"` para fondos blancos.
 * Con `compactaEnMovil` el texto se oculta en pantallas chicas (queda el logo).
 */
export function Marca({
  sobre,
  compactaEnMovil = false,
  className,
}: {
  sobre: "azul" | "claro";
  compactaEnMovil?: boolean;
  className?: string;
}) {
  const azul = sobre === "azul";
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <LogoSDE variante={azul ? "blanco" : "azul"} className="h-8 sm:h-9" />
      <span
        className={cn("h-8 w-px shrink-0", azul ? "bg-white/35" : "bg-border", compactaEnMovil && "hidden sm:block")}
        aria-hidden
      />
      <span className={cn("text-left leading-tight", compactaEnMovil && "hidden sm:block")}>
        <span className="block text-base font-bold tracking-wide">UERT</span>
        <span className={cn("block text-xs", azul ? "text-white/80" : "text-muted-foreground")}>
          Gestión de denuncias
        </span>
      </span>
    </span>
  );
}

/** Pie institucional (azul, como el de sde.gob.ar). `ancho`: el mismo max-w que el contenido de la página. */
export function PieSDE({ ancho = "max-w-7xl" }: { ancho?: "max-w-7xl" | "max-w-5xl" }) {
  return (
    <footer className="no-imprimir bg-primary text-primary-foreground">
      <div
        className={cn(
          "mx-auto flex flex-col items-center gap-3 px-4 py-4 text-center sm:flex-row sm:justify-between sm:text-left",
          ancho,
        )}
      >
        <LogoSDE variante="blanco" className="h-7 sm:h-7" />
        <p className="text-xs leading-snug text-white/80">
          Unidad Ejecutora de Riesgos del Trabajo · Gobierno de la Provincia de Santiago del Estero
          <span className="block sm:text-right">MVP de demostración con datos ficticios</span>
        </p>
      </div>
    </footer>
  );
}
