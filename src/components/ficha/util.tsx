/**
 * Piezas chicas de presentación que usan las secciones de la ficha del
 * expediente y la constancia (componentes de servidor).
 */
import type { LucideIcon } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { FechaISO } from "@/lib/dominio/fechas";
import type { Documento } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const ETAPA_DOCUMENTO: Record<Documento["etapa"], string> = {
  recepcion: "Recepción",
  medica: "Área médica",
  legal: "Área legal",
  seguimiento: "Seguimiento",
};

export const SEXO: Record<"F" | "M" | "X", string> = { F: "Femenino", M: "Masculino", X: "X (no binario)" };

/** Colores de etiqueta reutilizados en la ficha. */
export const CLASE = {
  ok: "bg-green-50 text-green-800 ring-green-600/20",
  error: "bg-red-50 text-red-800 ring-red-600/20",
  aviso: "bg-amber-50 text-amber-800 ring-amber-600/25",
  neutro: "bg-zinc-50 text-zinc-700 ring-zinc-500/20",
} as const;

/** Edad cumplida a una fecha. */
export function edad(nacimiento: FechaISO, hoyISO: FechaISO): number {
  const [a1, m1, d1] = nacimiento.split("-").map(Number);
  const [a2, m2, d2] = hoyISO.split("-").map(Number);
  return a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
}

const listaFormato = new Intl.ListFormat("es-AR", { style: "long", type: "conjunction" });

/** ["a", "b", "c"] → "a, b y c". */
export function enumerar(items: string[]): string {
  return listaFormato.format(items);
}

/** Sí / No / — para booleanos que pueden faltar. */
export function SiNo({ valor, nulo = "—" }: { valor: boolean | null | undefined; nulo?: string }) {
  if (valor === null || valor === undefined) return <span className="text-muted-foreground">{nulo}</span>;
  return <>{valor ? "Sí" : "No"}</>;
}

/** Código de un catálogo de la SRT con su descripción. */
export function Codigo({
  codigo,
  descripcion,
  className,
}: {
  codigo: string | null | undefined;
  descripcion?: string | null;
  className?: string;
}) {
  if (!codigo) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={className}>
      <span className="mr-1.5 font-mono text-xs font-semibold">{codigo}</span>
      {descripcion ?? <span className="text-muted-foreground">Sin descripción en el catálogo</span>}
    </span>
  );
}

/** Tarjeta con título (e ícono) para agrupar datos de la ficha. */
export function Tarjeta({
  titulo,
  descripcion,
  icono: Icono,
  acciones,
  children,
  className,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  icono?: LucideIcon;
  acciones?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          {Icono ? <Icono className="size-4 text-muted-foreground" aria-hidden /> : null}
          {titulo}
        </CardTitle>
        {descripcion ? <CardDescription>{descripcion}</CardDescription> : null}
        {acciones ? <CardAction>{acciones}</CardAction> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Estado vacío de una sección. */
export function Vacio({
  titulo,
  descripcion,
  icono: Icono,
  className,
}: {
  titulo: string;
  descripcion?: React.ReactNode;
  icono?: LucideIcon;
  className?: string;
}) {
  return (
    <Empty className={cn("rounded-lg border border-dashed bg-background py-8", className)}>
      <EmptyHeader>
        {Icono ? (
          <EmptyMedia variant="icon">
            <Icono />
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{titulo}</EmptyTitle>
        {descripcion ? <EmptyDescription>{descripcion}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  );
}
