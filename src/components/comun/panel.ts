import type { ExpedienteFicha, PlazoExpediente } from "@/lib/datos/expedientes";
import type { Usuario } from "@/lib/tipos";

/**
 * Props de los paneles de acciones que la ficha del expediente muestra según
 * el rol (PanelMesa, PanelMedico, PanelLegal, PanelSeguimiento). Cada panel
 * devuelve null si el usuario no tiene nada que hacer en ese estado.
 */
export interface PanelProps {
  ficha: ExpedienteFicha;
  usuario: Usuario;
  plazos: PlazoExpediente[];
}
