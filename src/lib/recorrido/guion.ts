/**
 * Guion del recorrido guiado (system tour): qué se explica en cada pantalla
 * y el recorrido completo del circuito, que va cambiando de rol y de pantalla.
 *
 * Cada paso marca un elemento por su atributo `data-recorrido` (ver
 * OBJETIVOS). Sin objetivo, o si el elemento no está, la tarjeta se muestra
 * centrada; un paso `opcional` que no está en pantalla se saltea.
 *
 * Es código puro (sin React): lo usa el motor del recorrido y los tests.
 */
import { ROL_INFO, type EstadoExpediente, type Rol } from "@/lib/dominio/constantes";

/** Elementos marcados con data-recorrido en la aplicación. */
export const OBJETIVOS = [
  // Barra
  "aviso-demo",
  "marca",
  "buscador",
  "selector-rol",
  "navegacion",
  "boton-recorrido",
  "asistente",
  // Comunes
  "encabezado",
  "acciones-pagina",
  "indicadores",
  // Bandejas
  "para-pasar",
  "recientes",
  "para-evaluar",
  "citaciones",
  "reiterar",
  "en-dictamen",
  "comision-medica",
  "motivos",
  "presentaciones",
  "tope-ilt",
  "licencias",
  "por-etapa",
  "vencimientos",
  "srt-tablero",
  // Nueva denuncia
  "pasos-denuncia",
  "paso-persona",
  // Ficha
  "ficha-encabezado",
  "circuito",
  "quien-actua",
  "panel-area",
  "pestanas-ficha",
  // Otras
  "filtros-expedientes",
  "lista-expedientes",
  "pestanas-srt",
  "llamadas-ws",
  "formulario-busqueda",
  "reiniciar-demo",
  "usuarios",
] as const;
export type Objetivo = (typeof OBJETIVOS)[number];

export interface PasoRecorrido {
  objetivo?: Objetivo;
  titulo: string;
  /** Admite **negrita**. */
  texto: string;
  /** Si el elemento no está en pantalla, el paso se saltea. */
  opcional?: boolean;
}

// ---------------------------------------------------------------------------
// Pasos comunes
// ---------------------------------------------------------------------------
const YANAPA: PasoRecorrido = {
  objetivo: "asistente",
  titulo: "¿Dudas? Preguntale a Yanapa",
  texto:
    "El asistente virtual responde sobre el circuito, los plazos y tus pendientes, con los datos del sistema. También recibe **audios** y **archivos**.",
};

/** Si la bandeja es de otra área, cómo probar sus acciones. */
function comoOtraArea(rol: Rol, duena: Rol): PasoRecorrido[] {
  if (rol === duena) return [];
  return [
    {
      objetivo: "selector-rol",
      titulo: `Estás mirando como ${ROL_INFO[rol].nombre}`,
      texto: `Esta bandeja es de **${ROL_INFO[duena].nombre}**: la podés ver, pero las acciones las hace esa área. Para probarlas, cambiá de rol desde **«Viendo como»**.`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Recorrido de cada pantalla
// ---------------------------------------------------------------------------
export interface PantallaRecorrido {
  id: string;
  nombre: string;
  pasos: (rol: Rol) => PasoRecorrido[];
}

const PANTALLAS: Array<PantallaRecorrido & { ruta: RegExp }> = [
  {
    id: "mesa-nueva",
    nombre: "Nueva denuncia",
    ruta: /^\/mesa\/nueva\/?$/,
    pasos: (rol) => [
      {
        objetivo: "encabezado",
        titulo: "Cargar una denuncia",
        texto:
          "Acá Mesa de entrada carga una denuncia nueva: de **accidente de trabajo**, **in itinere** o **enfermedad profesional (FODEP)**.",
      },
      {
        objetivo: "pasos-denuncia",
        titulo: "Dos pasos",
        texto: "Primero se identifica a la persona; después se completa la denuncia en un único formulario con solapas.",
        opcional: true,
      },
      {
        objetivo: "paso-persona",
        titulo: "Primero, la persona",
        texto:
          "Elegís el tipo y buscás por **CUIL o DNI**. El sistema trae los datos y te avisa si la persona tiene **siniestros abiertos**, en este sistema y en el que se usa hoy.",
        opcional: true,
      },
      {
        titulo: "Después, la denuncia",
        texto:
          "Las solapas piden los datos laborales, el hecho, los diagnósticos y la documentación. El **checklist cambia según el tipo** y las solapas avisan qué falta. Al registrar, el sistema asigna el número y emite la **constancia de recepción**.",
      },
      ...comoOtraArea(rol, "mesa_entrada"),
      YANAPA,
    ],
  },
  {
    id: "mesa",
    nombre: "Bandeja de Mesa de entrada",
    ruta: /^\/mesa\/?$/,
    pasos: (rol) => [
      {
        objetivo: "encabezado",
        titulo: "Bandeja de Mesa de entrada",
        texto: "Acá llegan las denuncias. Mesa de entrada las controla y las pasa al Área médica.",
      },
      {
        objetivo: "indicadores",
        titulo: "El día de un vistazo",
        texto:
          "Cuántas hay en recepción, cuántas están **listas para pasar**, las recibidas hoy y las EP que falta informar a la SRT. Cada tarjeta lleva a su lista.",
      },
      {
        objetivo: "para-pasar",
        titulo: "La lista de trabajo",
        texto:
          "Cada denuncia muestra si la **relación laboral** está verificada, si la **documentación** está completa y cuál es el **próximo paso**. Tocá el número para abrir la ficha.",
      },
      {
        objetivo: "acciones-pagina",
        titulo: "Nueva denuncia",
        texto: "Desde acá se carga una denuncia nueva.",
        opcional: true,
      },
      {
        objetivo: "recientes",
        titulo: "Lo que entró esta semana",
        texto: "Todas las denuncias de los últimos 7 días, estén en el área que estén.",
        opcional: true,
      },
      ...comoOtraArea(rol, "mesa_entrada"),
      YANAPA,
    ],
  },
  {
    id: "medica",
    nombre: "Bandeja del Área médica",
    ruta: /^\/medica\/?$/,
    pasos: (rol) => [
      {
        objetivo: "encabezado",
        titulo: "Bandeja del Área médica",
        texto: "El Área médica evalúa cada diagnóstico, cita al trabajador y define si hay baja laboral.",
      },
      {
        objetivo: "indicadores",
        titulo: "Lo pendiente",
        texto: "Expedientes para evaluar, diagnósticos sin evaluar, citaciones programadas y las que hay que reiterar.",
      },
      {
        objetivo: "para-evaluar",
        titulo: "Para evaluar",
        texto: "Los expedientes que llegaron de Mesa de entrada, con cuántos diagnósticos faltan evaluar.",
      },
      {
        objetivo: "citaciones",
        titulo: "Citaciones",
        texto:
          "Las citas programadas (siempre con **72 h** de anticipación). Después de la fecha se registra si el trabajador asistió.",
        opcional: true,
      },
      {
        objetivo: "reiterar",
        titulo: "Inasistencias",
        texto:
          "Si no asistió, se puede **reiterar una sola vez**. Si tampoco va a la reiteración, el trámite caduca y queda **Desistido**.",
        opcional: true,
      },
      ...comoOtraArea(rol, "medico"),
      YANAPA,
    ],
  },
  {
    id: "legal",
    nombre: "Bandeja del Área legal",
    ruta: /^\/legal\/?$/,
    pasos: (rol) => [
      {
        objetivo: "encabezado",
        titulo: "Bandeja del Área legal",
        texto: "Legal tiene **10 días hábiles** (con una prórroga) para aceptar o rechazar **cada diagnóstico**.",
      },
      {
        objetivo: "indicadores",
        titulo: "Los plazos primero",
        texto: "Cuántos hay en dictamen, cuántos **vencieron**, cuántos vencen en dos días y los que van a la Comisión Médica.",
      },
      {
        objetivo: "en-dictamen",
        titulo: "En dictamen",
        texto: "Ordenados por vencimiento: el plazo en rojo o en ámbar se ve enseguida.",
      },
      {
        objetivo: "comision-medica",
        titulo: "Aceptados sin baja",
        texto: "Cuando se acepta sin baja, hay **20 días hábiles** para presentar el trámite ante la Comisión Médica.",
        opcional: true,
      },
      {
        objetivo: "motivos",
        titulo: "Motivos de rechazo",
        texto: "R, D, E, P y L, con lo que exige cada uno: el rechazo por E pide el CYMAT y el rechazo por P, los estudios.",
        opcional: true,
      },
      ...comoOtraArea(rol, "legal"),
      YANAPA,
    ],
  },
  {
    id: "seguimiento",
    nombre: "Seguimiento de licencias",
    ruta: /^\/seguimiento\/?$/,
    pasos: (rol) => [
      {
        objetivo: "encabezado",
        titulo: "Seguimiento de licencias",
        texto: "Con la denuncia aceptada y con baja, este equipo controla la licencia hasta el alta.",
      },
      {
        objetivo: "indicadores",
        titulo: "Qué controlar",
        texto: "Licencias activas, presentaciones vencidas o por vencer, el tope de 365 días y los casos sin baja.",
      },
      {
        objetivo: "presentaciones",
        titulo: "Presentaciones",
        texto:
          "Cada licencia tiene su **próxima presentación**: el sistema avisa antes de que venza y marca las vencidas.",
        opcional: true,
      },
      {
        objetivo: "tope-ilt",
        titulo: "Tope de 365 días",
        texto: "Las licencias que se acercan al año desde el siniestro, el máximo que permite la ley.",
        opcional: true,
      },
      {
        objetivo: "licencias",
        titulo: "Todas las licencias",
        texto: "Desde la ficha se registran las presentaciones, las **intercurrencias** y el **alta**.",
        opcional: true,
      },
      ...comoOtraArea(rol, "seguimiento"),
      YANAPA,
    ],
  },
  {
    id: "direccion",
    nombre: "Tablero de Dirección",
    ruta: /^\/direccion\/?$/,
    pasos: () => [
      {
        objetivo: "encabezado",
        titulo: "Tablero de Dirección",
        texto: "La foto de toda la Unidad: dónde está cada expediente, qué plazos vencen y cómo va la comunicación con la SRT.",
      },
      {
        objetivo: "indicadores",
        titulo: "Los números clave",
        texto: "Expedientes abiertos, recibidos en el mes, **plazos vencidos**, lo que vence pronto, errores con la SRT y diagnósticos por informar.",
      },
      {
        objetivo: "por-etapa",
        titulo: "Por etapa",
        texto: "Cuántos expedientes hay en cada área: se ve enseguida dónde se acumula el trabajo.",
      },
      {
        objetivo: "vencimientos",
        titulo: "Vencimientos",
        texto: "Los plazos vencidos y los que vencen en los próximos días, de todas las áreas.",
        opcional: true,
      },
      {
        objetivo: "srt-tablero",
        titulo: "Comunicación con la SRT",
        texto: "Las últimas comunicaciones: Web Service FODEP, notificaciones y lotes de intercambio.",
        opcional: true,
      },
      YANAPA,
    ],
  },
  {
    id: "srt",
    nombre: "Comunicación con la SRT",
    ruta: /^\/srt\/?$/,
    pasos: () => [
      {
        objetivo: "encabezado",
        titulo: "Comunicación con la SRT",
        texto: "Todo lo que el sistema le informa a la Superintendencia de Riesgos del Trabajo. En la demo, **simulado**.",
      },
      {
        objetivo: "pestanas-srt",
        titulo: "Tres canales",
        texto:
          "El **Web Service FODEP** (cada denuncia de EP, en el momento), las **notificaciones** y el **Sistema de Intercambio** (lotes de archivos .AD, .AL y .AZ).",
      },
      {
        objetivo: "llamadas-ws",
        titulo: "Cada llamada, registrada",
        texto: "Qué se envió, qué respondió la SRT y, si hubo error, su código (FOxx).",
        opcional: true,
      },
      YANAPA,
    ],
  },
  {
    id: "ficha",
    nombre: "Ficha del expediente",
    ruta: /^\/expedientes\/\d+\/?$/,
    pasos: () => [
      {
        objetivo: "ficha-encabezado",
        titulo: "La ficha del expediente",
        texto: "El número, el tipo de denuncia, el estado y la persona. A la derecha, los documentos para imprimir.",
      },
      {
        objetivo: "circuito",
        titulo: "En qué etapa está",
        texto: "La línea muestra el recorrido: Recepción, Área médica, Área legal, Licencia y Cierre. Debajo, los **plazos que corren**.",
      },
      {
        objetivo: "quien-actua",
        titulo: "¿Quién actúa ahora?",
        texto: "Qué área tiene el expediente y qué falta para avanzar. Si no es tu turno, te dice a qué rol cambiar.",
      },
      {
        objetivo: "panel-area",
        titulo: "Las acciones de tu área",
        texto: "Los botones para avanzar el trámite. Solo aparecen los que **tu rol puede usar en este estado**.",
        opcional: true,
      },
      {
        objetivo: "pestanas-ficha",
        titulo: "Todo el expediente, por solapas",
        texto: "Resumen, diagnósticos, documentación, citaciones, licencia, comunicaciones con la SRT y el **historial** completo.",
      },
      YANAPA,
    ],
  },
  {
    id: "expedientes",
    nombre: "Listado de expedientes",
    ruta: /^\/expedientes\/?$/,
    pasos: () => [
      {
        objetivo: "encabezado",
        titulo: "Todos los expedientes",
        texto: "Las denuncias del sistema nuevo, de la más reciente a la más antigua. Lo ven todos los roles.",
      },
      {
        objetivo: "filtros-expedientes",
        titulo: "Filtros",
        texto: "Buscá por persona, número o repartición, y filtrá por estado o por tipo.",
      },
      {
        objetivo: "lista-expedientes",
        titulo: "La lista",
        texto: "Cada fila muestra el estado y el plazo más urgente. Tocá el número para abrir la ficha.",
      },
      YANAPA,
    ],
  },
  {
    id: "buscar",
    nombre: "Búsqueda unificada",
    ruta: /^\/buscar\/?$/,
    pasos: () => [
      {
        objetivo: "encabezado",
        titulo: "Búsqueda unificada",
        texto:
          "Por nombre, DNI o CUIL trae **todos los siniestros de la persona**: los del sistema nuevo y los del que la UERT usa hoy, por año.",
      },
      {
        objetivo: "formulario-busqueda",
        titulo: "Buscá",
        texto: "Escribí y buscá. También podés hacerlo desde el buscador de la barra, en cualquier pantalla.",
      },
      YANAPA,
    ],
  },
  {
    id: "admin",
    nombre: "Administración",
    ruta: /^\/admin\/?$/,
    pasos: (rol) => [
      {
        objetivo: "encabezado",
        titulo: "Administración",
        texto: "Usuarios, catálogos de la SRT, parámetros y la herramienta para reiniciar la demo.",
      },
      {
        objetivo: "reiniciar-demo",
        titulo: "Reiniciar la demo",
        texto: "Borra los datos y vuelve a cargar los de ejemplo, con fechas relativas a hoy. Útil antes de una presentación.",
        opcional: true,
      },
      {
        objetivo: "usuarios",
        titulo: "Usuarios de la demo",
        texto: "Un usuario por rol. En el sistema real, cada persona tiene su usuario y su contraseña.",
        opcional: true,
      },
      ...comoOtraArea(rol, "admin"),
      YANAPA,
    ],
  },
];

/** El recorrido de la pantalla de esa ruta, o null si no tiene. */
export function pantallaDe(ruta: string): PantallaRecorrido | null {
  return PANTALLAS.find((p) => p.ruta.test(ruta)) ?? null;
}

export const IDS_PANTALLAS = PANTALLAS.map((p) => p.id);

// ---------------------------------------------------------------------------
// Recorrido completo del circuito
// ---------------------------------------------------------------------------
export interface EtapaCircuito {
  id: string;
  nombre: string;
  rol: Rol;
  /** Ruta fija, o la ficha de un expediente de ejemplo en ese estado. */
  ruta: string | { expedienteEn: EstadoExpediente };
  pasos: PasoRecorrido[];
}

export const CIRCUITO: EtapaCircuito[] = [
  {
    id: "inicio",
    nombre: "Bienvenida",
    rol: "mesa_entrada",
    ruta: "/mesa",
    pasos: [
      {
        titulo: "El circuito de una denuncia, de punta a punta",
        texto:
          "Vamos a seguir una denuncia por **todas las áreas**: Mesa de entrada, Médica, Legal, Seguimiento y Dirección. **Yo cambio de rol y de pantalla**: vos solo avanzá con «Siguiente» (o con las flechas del teclado).",
      },
      {
        objetivo: "aviso-demo",
        titulo: "Una demostración",
        texto: "Los datos son ficticios y la comunicación con la SRT está simulada: se arma lo mismo que se enviaría, pero no se envía.",
      },
      {
        objetivo: "selector-rol",
        titulo: "Un rol por área",
        texto:
          "Cada área entra con su rol y ve lo suyo. En la demo se cambia con un clic desde **«Viendo como»**; en este recorrido lo hago yo.",
      },
      {
        objetivo: "navegacion",
        titulo: "Las secciones de cada rol",
        texto: "El menú cambia según el rol: la bandeja propia, el listado de expedientes, la búsqueda y, si corresponde, la SRT.",
      },
    ],
  },
  {
    id: "mesa",
    nombre: "Mesa de entrada",
    rol: "mesa_entrada",
    ruta: "/mesa",
    pasos: [
      {
        objetivo: "encabezado",
        titulo: "1 · Mesa de entrada recibe la denuncia",
        texto: "Es la puerta de entrada: la denuncia llega en persona o digital, y Mesa la carga y la controla.",
      },
      {
        objetivo: "acciones-pagina",
        titulo: "Cargar una denuncia",
        texto:
          "Se busca a la persona por CUIL o DNI (el sistema avisa si tiene **siniestros abiertos**) y se completa la denuncia por solapas, con el checklist de documentación según el tipo.",
        opcional: true,
      },
      {
        objetivo: "para-pasar",
        titulo: "Controlar antes de pasar",
        texto: "Para pasarla a Médica hace falta **verificar la relación laboral** y tener la **documentación** completa.",
      },
    ],
  },
  {
    id: "mesa-ficha",
    nombre: "Mesa de entrada",
    rol: "mesa_entrada",
    ruta: { expedienteEn: "recepcion" },
    pasos: [
      {
        objetivo: "circuito",
        titulo: "La ficha: el expediente recién llegado",
        texto: "Está en **Recepción**, la primera etapa del circuito. Cada expediente tiene su ficha con todo su historial.",
      },
      {
        objetivo: "panel-area",
        titulo: "Las acciones de Mesa",
        texto:
          "Verificar la relación laboral, adjuntar la documentación, imprimir la constancia y **pasarla al Área médica**. En una EP, al pasarla se informa a la SRT por el **Web Service FODEP**.",
        opcional: true,
      },
    ],
  },
  {
    id: "medica",
    nombre: "Área médica",
    rol: "medico",
    ruta: "/medica",
    pasos: [
      {
        objetivo: "encabezado",
        titulo: "2 · El Área médica evalúa",
        texto: "Cambié a **Área médica**. Acá llegan los expedientes que pasó Mesa de entrada.",
      },
      {
        objetivo: "indicadores",
        titulo: "Su bandeja",
        texto: "Para evaluar, diagnósticos pendientes y citaciones: lo que tiene que resolver el área.",
      },
      {
        objetivo: "citaciones",
        titulo: "Citaciones",
        texto:
          "Puede citar al trabajador con **72 h** de anticipación. Si no va, se reitera una sola vez; si tampoco va, el trámite caduca y queda Desistido.",
        opcional: true,
      },
    ],
  },
  {
    id: "medica-ficha",
    nombre: "Área médica",
    rol: "medico",
    ruta: { expedienteEn: "evaluacion_medica" },
    pasos: [
      {
        objetivo: "panel-area",
        titulo: "Evaluar cada diagnóstico",
        texto:
          "Por cada diagnóstico: el código **CIE-10**, si está en el Listado de EP, las lesiones y las zonas del cuerpo. Después define si hay **baja laboral** y la pasa al **Área legal**.",
        opcional: true,
      },
      {
        objetivo: "pestanas-ficha",
        titulo: "Todo queda registrado",
        texto: "Diagnósticos, documentación, citaciones y el **historial** de cada movimiento, con quién lo hizo y cuándo.",
      },
    ],
  },
  {
    id: "legal",
    nombre: "Área legal",
    rol: "legal",
    ruta: "/legal",
    pasos: [
      {
        objetivo: "encabezado",
        titulo: "3 · El Área legal dictamina",
        texto: "Ahora soy **Área legal**: tiene **10 días hábiles** (más una prórroga) para expedirse.",
      },
      {
        objetivo: "en-dictamen",
        titulo: "Ordenados por vencimiento",
        texto: "El plazo de cada expediente se ve en color: lo vencido y lo que vence pronto, primero.",
      },
    ],
  },
  {
    id: "legal-ficha",
    nombre: "Área legal",
    rol: "legal",
    ruta: { expedienteEn: "dictamen_legal" },
    pasos: [
      {
        objetivo: "panel-area",
        titulo: "Aceptar o rechazar cada diagnóstico",
        texto:
          "Cada diagnóstico se decide por separado, con su motivo si se rechaza (R, D, E, P o L). Al **cerrar el dictamen**, el expediente sigue solo: a licencia, a Comisión Médica o rechazado con su notificación.",
        opcional: true,
      },
      {
        objetivo: "circuito",
        titulo: "El plazo, siempre a la vista",
        texto: "Debajo del circuito se ve cuántos días hábiles quedan para el dictamen.",
      },
    ],
  },
  {
    id: "seguimiento",
    nombre: "Seguimiento",
    rol: "seguimiento",
    ruta: "/seguimiento",
    pasos: [
      {
        objetivo: "encabezado",
        titulo: "4 · Seguimiento controla la licencia",
        texto: "Con la denuncia aceptada y con baja, el trabajador está de licencia. Cambié a **Seguimiento de licencias**.",
      },
      {
        objetivo: "indicadores",
        titulo: "Presentaciones y vencimientos",
        texto: "Cada licencia tiene presentaciones periódicas. El sistema avisa antes de cada vencimiento y controla el **tope de 365 días**.",
      },
      {
        objetivo: "licencias",
        titulo: "Hasta el alta",
        texto: "Desde la ficha se registran las presentaciones, las intercurrencias y el **alta**, que cierra la licencia.",
        opcional: true,
      },
    ],
  },
  {
    id: "direccion",
    nombre: "Dirección",
    rol: "direccion",
    ruta: "/direccion",
    pasos: [
      {
        objetivo: "encabezado",
        titulo: "5 · Dirección ve todo",
        texto: "Como **Dirección**, el tablero muestra la Unidad completa.",
      },
      {
        objetivo: "indicadores",
        titulo: "Los números de la Unidad",
        texto: "Expedientes abiertos, plazos vencidos, lo que vence pronto y los errores con la SRT.",
      },
      {
        objetivo: "por-etapa",
        titulo: "Dónde está cada expediente",
        texto: "Cuántos hay en cada área: si algo se traba, se ve acá.",
      },
    ],
  },
  {
    id: "srt",
    nombre: "SRT",
    rol: "direccion",
    ruta: "/srt",
    pasos: [
      {
        objetivo: "pestanas-srt",
        titulo: "La comunicación con la SRT",
        texto:
          "El sistema informa a la SRT por el **Web Service FODEP** y por el **Sistema de Intercambio**. Todo queda registrado, con sus respuestas y errores.",
      },
    ],
  },
  {
    id: "cierre",
    nombre: "Cierre",
    rol: "direccion",
    ruta: "/srt",
    pasos: [
      {
        objetivo: "buscador",
        titulo: "Encontrar cualquier caso",
        texto:
          "Desde cualquier pantalla se busca por nombre, DNI, CUIL o número, en el sistema nuevo y en el actual.",
        opcional: true,
      },
      {
        objetivo: "asistente",
        titulo: "Yanapa, el asistente",
        texto: "Responde sobre el circuito y los plazos, dice qué tenés pendiente y busca expedientes. Recibe audios y archivos.",
      },
      {
        objetivo: "boton-recorrido",
        titulo: "Volver a recorrer",
        texto: "Desde acá repetís este recorrido o pedís el de **la pantalla en la que estés**.",
      },
      {
        titulo: "¡Ese es el circuito completo!",
        texto:
          "De la Mesa de entrada al alta, con los plazos controlados y la SRT informada. Ahora podés recorrerlo por tu cuenta cambiando de rol.",
      },
    ],
  },
];

export interface PasoDelCircuito extends PasoRecorrido {
  /** Índice de la etapa en CIRCUITO. */
  etapa: number;
}

/** Todos los pasos del circuito, en orden. */
export const PASOS_CIRCUITO: PasoDelCircuito[] = CIRCUITO.flatMap((e, etapa) => e.pasos.map((p) => ({ ...p, etapa })));

/** Las etapas que se cuentan en la tarjeta («Etapa 2 de 5 · Área médica»). */
export const ETAPAS_VISIBLES = ["Mesa de entrada", "Área médica", "Área legal", "Seguimiento", "Dirección"] as const;

export function etapaVisible(etapa: number): { numero: number; total: number; nombre: string } | null {
  const nombre = CIRCUITO[etapa]?.nombre;
  const i = ETAPAS_VISIBLES.findIndex((n) => n === nombre || (n === "Dirección" && (nombre === "SRT" || nombre === "Cierre")));
  return i >= 0 ? { numero: i + 1, total: ETAPAS_VISIBLES.length, nombre: ETAPAS_VISIBLES[i] } : null;
}
