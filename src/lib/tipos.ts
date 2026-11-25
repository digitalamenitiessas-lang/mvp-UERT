/**
 * Formas de las filas de la base tal como las devuelve src/lib/db
 * (fechas sin hora como 'YYYY-MM-DD', momentos como Date).
 */
import type {
  Canal,
  CodigoExamen,
  EstadoCitacion,
  EstadoDiagnostico,
  EstadoExpediente,
  MotivoCeseIlt,
  MotivoCitacion,
  MotivoDesistimiento,
  MotivoRechazo,
  Rol,
  TipoDenuncia,
  TipoDenunciante,
} from "@/lib/dominio/constantes";
import type { FechaISO } from "@/lib/dominio/fechas";

export interface Usuario {
  id: number;
  nombre: string;
  rol: Rol;
  cargo: string;
  email: string | null;
  activo: boolean;
  orden: number;
}

export interface Persona {
  id: number;
  cuil: string;
  dni: string;
  apellido: string;
  nombres: string;
  fecha_nacimiento: FechaISO | null;
  sexo: "F" | "M" | "X" | null;
  telefono: string | null;
  email: string | null;
  domicilio: string | null;
  localidad_id: number | null;
}

export interface Expediente {
  id: number;
  anio: number;
  contador: number;
  sufijo: number;
  numero: string;
  tipo: TipoDenuncia;
  estado: EstadoExpediente;
  persona_id: number;
  origen_id: number | null;
  es_reingreso: boolean;
  es_intercurrencia: boolean;
  reencuadrado_en: Date | null;
  canal: Canal;
  denunciante_tipo: TipoDenunciante;
  denunciante_nombre: string | null;
  denunciante_email: string | null;
  denunciante_telefono: string | null;
  recibido_en: Date;
  recibido_por: number | null;
  reparticion: string;
  cuit_empleador: string;
  codigo_establecimiento: string;
  domicilio_laboral: string | null;
  localidad_laboral_id: number | null;
  puesto: string | null;
  ciuo: string | null;
  tareas: string | null;
  antiguedad_empresa: string | null;
  antiguedad_area: string | null;
  desvinculado: boolean;
  fecha_ocurrencia: FechaISO | null;
  hora_ocurrencia: string | null;
  lugar_ocurrencia: string | null;
  localidad_ocurrencia_id: number | null;
  descripcion: string | null;
  forma_accidente: string | null;
  agente_material: string | null;
  trayecto: string | null;
  pluriempleo: boolean | null;
  cuits_pluriempleo: string[] | null;
  obligada_pago: boolean | null;
  exposicion_desde: FechaISO | null;
  exposicion_hasta: FechaISO | null;
  fodep_codigo: number | null;
  fodep_numero: number | null;
  fodep_estado: number | null;
  relacion_laboral_verificada: boolean | null;
  verificado_en: Date | null;
  con_baja: boolean | null;
  fecha_inicio_inasistencia: FechaISO | null;
  estres_postraumatico: boolean;
  legal_ingreso: FechaISO | null;
  legal_vence: FechaISO | null;
  legal_prorroga_usada: boolean;
  proxima_presentacion: FechaISO | null;
  fecha_fin_ilt: FechaISO | null;
  motivo_cese_ilt: MotivoCeseIlt | null;
  cm_vence: FechaISO | null;
  cm_presentado_en: FechaISO | null;
  desistido_motivo: MotivoDesistimiento | null;
  cerrado_en: Date | null;
  creado_en: Date;
  actualizado_en: Date;
}

export interface Diagnostico {
  id: number;
  expediente_id: number;
  orden: number;
  numero_unico: number;
  cie10: string;
  cie10_adecuado: string | null;
  agente_causante: string | null;
  fecha_diagnostico: FechaISO | null;
  codigo_examen: CodigoExamen | null;
  origen: "denuncia" | "evaluacion";
  en_listado: boolean | null;
  patologia_constatada: boolean | null;
  observacion_medica: string | null;
  estado: EstadoDiagnostico;
  motivo_rechazo: MotivoRechazo | null;
  fundamento: string | null;
  estudios: string | null;
  cymat_adjunto: boolean | null;
  evaluado_en: Date | null;
  decidido_en: Date | null;
  intercambio_estado: "pendiente" | "informado" | "modificado";
  intercambio_lote_id: number | null;
}

/** Diagnóstico con descripciones y sus lesiones y zonas. */
export interface DiagnosticoDetalle extends Diagnostico {
  cie10_descripcion: string;
  cie10_adecuado_descripcion: string | null;
  agente_descripcion: string | null;
  lesiones: Array<{ orden: number; codigo: string; descripcion: string }>;
  zonas: Array<{ orden: number; codigo: string; descripcion: string }>;
}

export interface Documento {
  id: number;
  expediente_id: number;
  tipo: string;
  nombre_archivo: string | null;
  tamano_bytes: number | null;
  etapa: "recepcion" | "medica" | "legal" | "seguimiento";
  observacion: string | null;
  cargado_por: number | null;
  cargado_por_nombre?: string | null;
  cargado_en: Date;
}

export interface Citacion {
  id: number;
  expediente_id: number;
  reiteracion_de: number | null;
  fecha_hora: Date;
  motivo: MotivoCitacion;
  lugar: string;
  detalle: string | null;
  estado: EstadoCitacion;
  notificada_en: Date;
  resultado_registrado_en: Date | null;
  creada_por: number | null;
}

export interface Presentacion {
  id: number;
  expediente_id: number;
  fecha: FechaISO;
  detalle: string;
  proxima_fecha: FechaISO | null;
  registrada_por: number | null;
  registrada_por_nombre?: string | null;
  registrada_en: Date;
}

export interface Movimiento {
  id: number;
  expediente_id: number | null;
  fecha: Date;
  usuario_id: number | null;
  usuario_nombre?: string | null;
  rol: Rol | null;
  accion: string;
  detalle: string;
  estado_anterior: EstadoExpediente | null;
  estado_nuevo: EstadoExpediente | null;
  datos: Record<string, unknown> | null;
}

export interface ComunicacionSRT {
  id: number;
  expediente_id: number | null;
  canal: "ws_fodep" | "eservicios" | "ventanilla" | "intercambio";
  operacion: string;
  request: unknown;
  response: unknown;
  ok: boolean;
  error_codigo: string | null;
  error_mensaje: string | null;
  simulado: boolean;
  fecha: Date;
}

export interface LoteIntercambio {
  id: number;
  generado_en: Date;
  generado_por: number | null;
  archivos: Array<{ extension: string; nombre: string; registros: number; contenido: string }>;
  registros: number;
}

export interface LegadoSiniestro {
  id: number;
  cuil: string | null;
  dni: string | null;
  apellido_nombre: string;
  numero: string;
  anio: number;
  tipo: string;
  estado: string;
  abierto: boolean;
  fecha_ocurrencia: FechaISO | null;
  diagnostico: string | null;
  reparticion: string | null;
}
