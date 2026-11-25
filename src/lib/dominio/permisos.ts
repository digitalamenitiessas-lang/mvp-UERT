/**
 * Qué puede hacer cada rol y en qué estado del expediente.
 * Las pantallas usan `puede()` para mostrar u ocultar botones; las
 * operaciones (src/lib/operaciones) lo vuelven a controlar en el servidor.
 */
import type { EstadoExpediente, Rol } from "./constantes";

export const ACCIONES = {
  crear_denuncia: { roles: ["mesa_entrada"], estados: null },
  editar_denuncia: { roles: ["mesa_entrada"], estados: ["recepcion"] },
  adjuntar_documento: {
    roles: ["mesa_entrada", "medico", "legal", "seguimiento"],
    estados: ["recepcion", "evaluacion_medica", "dictamen_legal", "licencia_activa", "sin_baja"],
  },
  verificar_relacion_laboral: { roles: ["mesa_entrada"], estados: ["recepcion"] },
  pasar_a_medica: { roles: ["mesa_entrada"], estados: ["recepcion"] },
  desistir: { roles: ["mesa_entrada", "medico"], estados: ["recepcion", "evaluacion_medica"] },
  agregar_diagnostico: { roles: ["medico"], estados: ["evaluacion_medica"] },
  evaluar_diagnostico: { roles: ["medico"], estados: ["evaluacion_medica"] },
  programar_citacion: { roles: ["medico"], estados: ["evaluacion_medica"] },
  registrar_asistencia: { roles: ["medico"], estados: ["evaluacion_medica"] },
  definir_baja: { roles: ["medico"], estados: ["evaluacion_medica"] },
  reencuadrar_ep: { roles: ["medico"], estados: ["evaluacion_medica"] },
  pasar_a_legal: { roles: ["medico"], estados: ["evaluacion_medica"] },
  decidir_diagnostico: { roles: ["legal"], estados: ["dictamen_legal"] },
  solicitar_prorroga: { roles: ["legal"], estados: ["dictamen_legal"] },
  cerrar_dictamen: { roles: ["legal"], estados: ["dictamen_legal"] },
  registrar_presentacion: { roles: ["seguimiento"], estados: ["licencia_activa"] },
  registrar_intercurrencia: { roles: ["seguimiento"], estados: ["licencia_activa"] },
  dar_alta: { roles: ["seguimiento", "medico"], estados: ["licencia_activa"] },
  registrar_presentacion_cm: { roles: ["seguimiento", "legal"], estados: ["sin_baja"] },
  crear_reingreso: { roles: ["mesa_entrada"], estados: ["alta"] },
  generar_intercambio: { roles: ["mesa_entrada", "admin"], estados: null },
  reiniciar_demo: { roles: ["admin"], estados: null },
} as const satisfies Record<string, { roles: readonly Rol[]; estados: readonly EstadoExpediente[] | null }>;

export type Accion = keyof typeof ACCIONES;

/** ¿El rol puede hacer la acción (en ese estado, si la acción depende del estado)? */
export function puede(rol: Rol, accion: Accion, estado?: EstadoExpediente): boolean {
  const regla = ACCIONES[accion];
  if (!(regla.roles as readonly Rol[]).includes(rol)) return false;
  if (regla.estados === null || estado === undefined) return true;
  return (regla.estados as readonly EstadoExpediente[]).includes(estado);
}
