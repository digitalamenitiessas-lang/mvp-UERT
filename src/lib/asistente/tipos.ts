/**
 * Tipos del asistente virtual (Yanapa). Las respuestas son bloques de datos
 * planos: las arma el servidor y las dibuja el widget, sin HTML.
 */
import type { EstadoExpediente, Rol, TipoDenuncia } from "@/lib/dominio/constantes";
import type { EstadoPlazo } from "@/lib/dominio/fechas";

/** Dónde está y quién es el que pregunta. */
export interface ContextoAsistente {
  rol: Rol | null;
  /** Nombre de pila del usuario de la demo (para saludar). */
  nombre: string | null;
  /** Ruta actual, sin el basePath (usePathname). */
  ruta: string;
}

/** Un expediente dentro de una respuesta (tarjeta con enlace a la ficha). */
export interface ExpedienteResumen {
  id: number;
  numero: string;
  persona: string;
  tipo: TipoDenuncia;
  estado: EstadoExpediente;
  plazo?: EstadoPlazo & { nombre: string };
  detalle?: string;
}

export interface Enlace {
  texto: string;
  href: string;
}

/**
 * Piezas de una respuesta. `texto` admite **negrita** y saltos de línea;
 * nada más (no se interpreta HTML).
 */
export type Bloque =
  | { tipo: "texto"; texto: string }
  | { tipo: "pasos"; titulo?: string; pasos: string[] }
  | { tipo: "lista"; titulo?: string; items: Array<{ titulo: string; detalle?: string }> }
  | { tipo: "indicadores"; items: Array<{ etiqueta: string; valor: number; tono?: "normal" | "alerta" | "peligro" }> }
  | { tipo: "expedientes"; items: ExpedienteResumen[]; vacio?: string }
  | { tipo: "nota"; texto: string }
  | { tipo: "enlaces"; enlaces: Enlace[] };

export interface Respuesta {
  /** Intención que la generó (para tests y para no repetir sugerencias). */
  intencion: string;
  bloques: Bloque[];
  /** Preguntas para seguir (chips debajo de la respuesta). */
  sugerencias: Sugerencia[];
}

/** Pregunta prearmada: el texto que ve el usuario y la intención que dispara. */
export interface Sugerencia {
  texto: string;
  intencion: string;
}

/** Lo que manda el widget en cada mensaje. */
export interface ConsultaAsistente {
  texto: string;
  /** Si vino de una pregunta prearmada, la intención exacta (no se adivina). */
  intencion?: string;
  ruta: string;
  /** Archivo adjunto: en la demo se registran nombre, tipo y tamaño, no el archivo. */
  adjunto?: { nombre: string; tipo: string; tamano: number };
  /** Audio sin transcripción (el navegador no pudo pasarlo a texto). */
  audioSinTexto?: { segundos: number };
}
