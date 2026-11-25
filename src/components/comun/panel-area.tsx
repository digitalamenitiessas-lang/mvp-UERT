import { ActivityIcon, GavelIcon, InboxIcon, StethoscopeIcon, type LucideIcon } from "lucide-react";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROL_INFO, type Rol } from "@/lib/dominio/constantes";
import { cn } from "@/lib/utils";

/** Áreas que tienen un panel de acciones en la ficha del expediente. */
type RolConPanel = Extract<Rol, "mesa_entrada" | "medico" | "legal" | "seguimiento">;

/** El mismo ícono que el área tiene en la barra de navegación. */
const ICONO: Record<RolConPanel, LucideIcon> = {
  mesa_entrada: InboxIcon,
  medico: StethoscopeIcon,
  legal: GavelIcon,
  seguimiento: ActivityIcon,
};

/** Título de cada panel: «Acciones de» y el área (corto, entra en la columna lateral de la ficha). */
const TITULO: Record<RolConPanel, string> = {
  mesa_entrada: "Acciones de Mesa de entrada",
  medico: "Acciones del Área médica",
  legal: "Acciones del Área legal",
  seguimiento: "Acciones de Seguimiento",
};

/**
 * Marco común de los paneles de acciones de la ficha (Mesa, Médica, Legal y
 * Seguimiento): mismo tamaño, encabezado con el ícono en el color del rol,
 * título «Acciones de …» y descripción. El contenido (CardContent y, si hace
 * falta, CardFooter) lo pone cada panel.
 */
export function PanelArea({
  rol,
  descripcion,
  accion,
  className,
  children,
}: {
  rol: RolConPanel;
  descripcion: React.ReactNode;
  /** Algo chico a la derecha del título (por ejemplo, el estado). */
  accion?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const Icono = ICONO[rol];
  return (
    <Card size="sm" className={className}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <span
            className={cn("flex size-7 shrink-0 items-center justify-center rounded-md ring-1", ROL_INFO[rol].badge)}
            aria-hidden
          >
            <Icono className="size-4" />
          </span>
          {TITULO[rol]}
        </CardTitle>
        <CardDescription>{descripcion}</CardDescription>
        {accion ? <CardAction>{accion}</CardAction> : null}
      </CardHeader>
      {children}
    </Card>
  );
}
