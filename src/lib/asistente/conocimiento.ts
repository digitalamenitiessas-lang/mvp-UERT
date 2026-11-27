/**
 * Lo que sabe Yanapa, el asistente virtual de la UERT: las preguntas
 * prearmadas, cómo reconocer lo que se escribe y las respuestas fijas.
 *
 * No usa ningún servicio de IA: las respuestas salen de las mismas reglas y
 * constantes del sistema (plazos, motivos, documentación…), así que si cambia
 * una regla, cambia la respuesta. Las preguntas que necesitan datos de la
 * demo (pendientes, vencimientos, un expediente) las arma src/lib/asistente/responder.ts.
 *
 * Es código puro: lo usan el servidor y el widget (bienvenida y sugerencias).
 */
import {
  DESISTIMIENTO_INFO,
  MOTIVO_CESE_ILT_INFO,
  MOTIVO_RECHAZO_INFO,
  MOTIVOS_RECHAZO,
  PLAZOS,
  ROL_INFO,
  TIPO_INFO,
  TIPOS,
  UERT,
  type Rol,
} from "@/lib/dominio/constantes";
import { documentosDeRecepcion } from "@/lib/dominio/documentos";
import type { Bloque, ContextoAsistente, Respuesta, Sugerencia } from "./tipos";

/** Nombre del asistente: de «yanapay», ayudar en quichua santiagueño. */
export const NOMBRE_ASISTENTE = "Yanapa";

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------
/** Minúsculas, sin tildes y sin signos: «¿Cuándo vence?» → «cuando vence». */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombre de pila para saludar: «Dra. Silvina Herrera» → «Silvina». */
export function nombreDePila(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const palabras = nombre.split(/\s+/).filter((p) => !/\.$/.test(p) && p.length > 1);
  return palabras[0] ?? null;
}

// ---------------------------------------------------------------------------
// Intenciones
// ---------------------------------------------------------------------------
/**
 * Una clave suma `p` puntos si aparece alguno de sus términos. Un término de
 * hasta 3 letras tiene que ser una palabra exacta («ep», «cm»); uno más largo
 * vale como comienzo de palabra («citac» → «citaciones»); con espacios, como frase.
 */
interface Clave {
  t: string[];
  p?: number;
}

export type Tema =
  | "El circuito"
  | "Mis datos"
  | "Mesa de entrada"
  | "Área médica"
  | "Área legal"
  | "Seguimiento"
  | "SRT y Enfermedad Profesional"
  | "Sobre la demo";

export interface Intencion {
  id: string;
  /** Cómo se ve como pregunta prearmada. */
  pregunta: string;
  tema?: Tema;
  claves: Clave[];
  /** Puntaje mínimo para reconocerla (2 por defecto). */
  minimo?: number;
  /** Débil: solo gana si ninguna otra llega al mínimo (saludos, gracias…). */
  debil?: boolean;
  /** Puntos extra por algo que las claves no ven (p. ej. «.AD» y «.AZ» juntos). */
  extra?: (palabras: string[]) => number;
  /** La responde responder.ts con datos de la demo. */
  datos?: boolean;
  /** Respuesta fija. */
  responder?: (ctx: ContextoAsistente) => Bloque[];
  /** Preguntas para seguir. */
  siguientes?: string[];
}

const nota = (texto: string): Bloque => ({ tipo: "nota", texto });
const texto = (t: string): Bloque => ({ tipo: "texto", texto: t });
const enlaces = (...e: Array<[string, string]>): Bloque => ({
  tipo: "enlaces",
  enlaces: e.map(([t, href]) => ({ texto: t, href })),
});

/** Si la tarea es de otra área, cómo probarla. */
function deOtraArea(ctx: ContextoAsistente, area: Rol): Bloque[] {
  if (!ctx.rol || ctx.rol === area) return [];
  return [
    nota(
      `Esto lo hace ${ROL_INFO[area].nombre}. Para probarlo, cambiá de rol desde «Viendo como», arriba a la derecha.`,
    ),
  ];
}

const listaDias = (n: number, habiles: boolean) => `${n} días ${habiles ? "hábiles" : "corridos"}`;

export const INTENCIONES: Intencion[] = [
  // --- Charla -------------------------------------------------------------
  {
    id: "saludo",
    pregunta: "Hola",
    debil: true,
    claves: [{ t: ["hola", "buen dia", "buenas", "buenos dias", "que tal", "como estas", "como andas"], p: 2 }],
    responder: (ctx) => [
      texto(
        `¡Hola${ctx.nombre ? `, ${ctx.nombre}` : ""}! ¿En qué te ayudo? Podés elegir una pregunta o escribirme lo que necesites.`,
      ),
    ],
  },
  {
    id: "gracias",
    pregunta: "Gracias",
    debil: true,
    claves: [{ t: ["gracias", "genial", "perfecto", "joya", "barbaro", "buenisimo", "excelente", "dale"], p: 2 }],
    responder: () => [texto("¡De nada! Si necesitás algo más, acá estoy.")],
  },
  {
    id: "despedida",
    pregunta: "Chau",
    debil: true,
    claves: [{ t: ["chau", "adios", "hasta luego", "nos vemos", "hasta manana"], p: 2 }],
    responder: () => [texto("¡Hasta luego! Cuando me necesites, tocá el botón de abajo a la derecha.")],
  },
  {
    id: "quien_sos",
    pregunta: "¿Quién sos?",
    tema: "Sobre la demo",
    claves: [
      {
        t: ["quien sos", "que sos", "como te llamas", "tu nombre", "sos un bot", "sos una ia", "sos humano", "yanapa", "sos real"],
        p: 2,
      },
    ],
    responder: () => [
      texto(
        `Soy **${NOMBRE_ASISTENTE}**, el asistente virtual de la UERT. Mi nombre viene de «yanapay», que en quichua santiagueño quiere decir **ayudar**.`,
      ),
      texto(
        "Te oriento con el circuito de las denuncias, los plazos y los datos de esta demo. Mis respuestas salen de las mismas reglas del sistema: si algo no lo sé, te lo digo.",
      ),
    ],
    siguientes: ["que_podes", "circuito"],
  },
  {
    id: "que_podes",
    pregunta: "¿En qué me podés ayudar?",
    tema: "Sobre la demo",
    debil: true,
    claves: [
      { t: ["que podes", "que sabes", "en que me ayudas", "que haces", "que preguntas", "como funcionas", "que te puedo"], p: 2 },
      { t: ["ayuda", "ayudame", "ayudar"], p: 1 },
    ],
    responder: () => [
      { tipo: "lista", titulo: "Puedo ayudarte con esto:", items: [
        { titulo: "Explicarte el circuito y los plazos", detalle: "De la Mesa de entrada al alta, con las reglas de cada área." },
        { titulo: "Decirte qué tenés pendiente y qué vence", detalle: "Con los datos de la demo, según tu rol." },
        { titulo: "Buscar expedientes", detalle: "Escribime el número, el DNI, el CUIL o el apellido." },
        { titulo: "Contarte cómo está un expediente", detalle: "Abrí la ficha y preguntame «¿en qué estado está?»." },
        { titulo: "Recibir audios y archivos", detalle: "Hablame con el micrófono o adjuntá una foto o un PDF." },
      ] },
    ],
    siguientes: ["pendientes", "circuito", "audios"],
  },
  {
    id: "recorrido",
    pregunta: "Mostrame cómo usar esta pantalla",
    tema: "Sobre la demo",
    claves: [
      {
        t: [
          "recorrido guiado",
          "recorrido",
          "tour",
          "guiame",
          "visita guiada",
          "mostrame la pantalla",
          "mostrame esta pantalla",
          "mostrame como usar",
          "como uso esta pantalla",
          "explicame esta pantalla",
          "explicame la pantalla",
          "que hay en esta pantalla",
          "que puedo hacer aca",
          "que hay aca",
        ],
        p: 2,
      },
    ],
    responder: (ctx) =>
      ctx.rol
        ? [
            texto("Te muestro la pantalla paso a paso, marcando cada parte y qué se puede hacer ahí."),
            texto("También te llevo por **todo el circuito**: voy cambiando de rol y de pantalla solo."),
            { tipo: "recorrido" },
          ]
        : [
            texto(
              "Tocá **«Ver el recorrido guiado»** en esta pantalla: entra como Mesa de entrada y te lleva por todo el circuito, cambiando de rol solo.",
            ),
          ],
    siguientes: ["circuito", "que_podes"],
  },
  {
    id: "humano",
    pregunta: "Quiero hablar con una persona",
    tema: "Sobre la demo",
    claves: [
      { t: ["persona", "humano", "operador", "alguien", "agente", "empleado", "mesa de ayuda", "soporte"], p: 1 },
      { t: ["hablar", "comunicar", "contactar", "atienda", "llamar", "derivar"], p: 1 },
    ],
    responder: () => [
      texto("En esta demo no hay una persona del otro lado: respondo yo con lo que sé del sistema."),
      nota(
        "En el sistema real, desde acá se podría derivar la consulta a la mesa de ayuda de la UERT, con el expediente y la conversación adjuntos.",
      ),
    ],
    siguientes: ["que_podes"],
  },
  {
    id: "audios",
    pregunta: "¿Puedo mandarte audios?",
    tema: "Sobre la demo",
    claves: [{ t: ["audio", "nota de voz", "mensaje de voz", "microfono", "grabar", "grabo", "hablarte", "por voz", "dictar"], p: 2 }],
    responder: () => [
      texto(
        "¡Sí! Tocá el **micrófono** y hablame: cuando termines, tocá enviar. Te escucho y lo paso a texto para responderte (en Chrome y Edge; en otros navegadores el audio llega igual, pero te pido que me lo escribas).",
      ),
      texto("También podés **adjuntar** una foto o un PDF con el clip, por ejemplo el certificado médico de una denuncia."),
      nota("Para usar el micrófono, el navegador te va a pedir permiso la primera vez."),
    ],
    siguientes: ["adjuntar", "que_podes"],
  },

  // --- El circuito ----------------------------------------------------------
  {
    id: "circuito",
    pregunta: "¿Cómo es el circuito de una denuncia?",
    tema: "El circuito",
    claves: [
      { t: ["circuito", "recorrido", "flujo", "etapas", "proceso", "camino", "paso a paso", "como funciona el sistema"], p: 2 },
      { t: ["denuncia", "tramite", "expediente", "siniestro"], p: 1 },
      { t: ["como es", "como sigue", "que pasa con"], p: 1 },
    ],
    responder: () => [
      {
        tipo: "pasos",
        titulo: "Una denuncia pasa por cuatro áreas:",
        pasos: [
          "**Mesa de entrada** la recibe, controla la documentación, verifica la relación laboral, emite la constancia y la pasa al Área médica.",
          "**Área médica** evalúa cada diagnóstico (puede citar al trabajador) y define si hay baja laboral.",
          `**Área legal** acepta o rechaza cada diagnóstico dentro de ${listaDias(PLAZOS.legalDiasHabiles, true)}.`,
          "**Seguimiento** controla la licencia hasta el alta o, si no hubo baja, la presentación ante la Comisión Médica.",
        ],
      },
      texto(
        "También puede terminar como **Desistida** (no se configuró o caducó) o **Rechazada** (se rechazaron todos los diagnósticos).",
      ),
      enlaces(["Ver todos los expedientes", "/expedientes"]),
    ],
    siguientes: ["plazos", "cargar_denuncia", "desistido"],
  },
  {
    id: "plazos",
    pregunta: "¿Qué plazos hay que cumplir?",
    tema: "El circuito",
    claves: [
      { t: ["plazo", "cuanto tiempo", "cuantos dias", "dias habiles", "termino", "tiempos"], p: 2 },
      { t: ["vencimiento"], p: 1 },
    ],
    responder: () => [
      {
        tipo: "lista",
        titulo: "Los plazos que controla el sistema:",
        items: [
          { titulo: `Control de cobertura: ${PLAZOS.configuracionHoras} h`, detalle: "En una EP, si no hay cobertura se informa a la SRT dentro de ese plazo." },
          { titulo: `Citaciones: ${PLAZOS.citacionHorasMinimas} h de anticipación`, detalle: "Como mínimo, entre la notificación y la cita." },
          { titulo: `Dictamen legal: ${listaDias(PLAZOS.legalDiasHabiles, true)}`, detalle: `Con una prórroga única de ${listaDias(PLAZOS.prorrogaDiasHabiles, true)} (a confirmar con la UERT).` },
          { titulo: `Sin baja: ${listaDias(PLAZOS.sinBajaDiasHabiles, true)}`, detalle: "Para presentar el trámite ante la Comisión Médica." },
          { titulo: `Primera presentación de la licencia: ${listaDias(PLAZOS.primeraPresentacionDias, false)}`, detalle: "Desde la aceptación; las siguientes las fija Seguimiento." },
          { titulo: `Tope de la licencia: ${PLAZOS.topeIltDias} días`, detalle: "Desde la primera manifestación o el accidente." },
        ],
      },
      nota("Los días hábiles descuentan fines de semana y feriados."),
    ],
    siguientes: ["vencimientos", "prorroga", "tope_ilt"],
  },
  {
    id: "numero_siniestro",
    pregunta: "¿Cómo se arma el número de siniestro?",
    tema: "El circuito",
    claves: [
      { t: ["numero", "nro", "numeracion", "sufijo", "formato"], p: 1 },
      { t: ["siniestro", "expediente", "denuncia", "20 posiciones", "se arma"], p: 1 },
    ],
    responder: () => [
      texto("En pantalla se ve como **AAAA-NNNNNN-SS**: año, contador del año y sufijo. Por ejemplo, 2026-000012-00."),
      texto(
        `El sufijo **00** es el siniestro y **01**, **02**… son sus reingresos. Para la SRT se informa con 20 posiciones: ${UERT.prefijoSiniestro} + año + contador + sufijo.`,
      ),
      nota("El prefijo se tomó del sistema anterior y está a confirmar con la UERT."),
    ],
    siguientes: ["reingreso", "busqueda"],
  },
  {
    id: "desistido",
    pregunta: "¿Qué es un expediente desistido?",
    tema: "El circuito",
    claves: [{ t: ["desist", "actuaciones previas", "no se configuro", "falta de cobertura", "relacion no corroborada"], p: 2 }],
    responder: () => [
      texto(
        "**Desistido** es el Asentamiento de Actuaciones Previas: la denuncia no llegó a configurarse o caducó. **No es un rechazo**.",
      ),
      { tipo: "lista", titulo: "Los motivos posibles:", items: Object.values(DESISTIMIENTO_INFO).map((m) => ({ titulo: m })) },
      nota("Lo pueden registrar Mesa de entrada (en la recepción) y el Área médica (durante la evaluación)."),
    ],
    siguientes: ["citaciones", "circuito"],
  },
  {
    id: "que_es_uert",
    pregunta: "¿Qué es la UERT?",
    tema: "El circuito",
    claves: [{ t: ["uert", "unidad ejecutora", "que es esto", "que es este sistema", "para que sirve"], p: 2 }],
    responder: () => [
      texto(
        `La **${UERT.nombre}** gestiona los accidentes de trabajo y las enfermedades profesionales del personal de la Provincia de ${UERT.provincia}, que es su propio empleador autoasegurado.`,
      ),
      texto("Este sistema reemplaza al actual: lleva cada denuncia por las áreas, controla los plazos y se comunica con la SRT."),
    ],
    siguientes: ["circuito", "srt"],
  },

  // --- Mis datos (responder.ts) ------------------------------------------
  {
    id: "pendientes",
    pregunta: "¿Qué tengo pendiente hoy?",
    tema: "Mis datos",
    datos: true,
    claves: [
      {
        t: ["pendiente", "tengo que hacer", "que hago", "mi bandeja", "bandeja", "tareas", "para hoy", "que me toca", "por hacer"],
        p: 2,
      },
    ],
    siguientes: ["vencimientos", "circuito"],
  },
  {
    id: "vencimientos",
    pregunta: "¿Qué expedientes vencen pronto?",
    tema: "Mis datos",
    datos: true,
    minimo: 3,
    claves: [
      { t: ["vencen", "vence", "vencimiento", "por vencer"], p: 2 },
      { t: ["pronto", "hoy", "semana", "expedientes", "cuales", "proxim"], p: 1 },
      { t: ["vencid", "atrasad", "fuera de termino"], p: 3 },
    ],
    siguientes: ["pendientes", "plazos"],
  },
  {
    id: "resumen",
    pregunta: "Dame un resumen del día",
    tema: "Mis datos",
    datos: true,
    claves: [
      { t: ["resumen", "panorama", "como venimos", "estadistica", "numeros", "indicadores", "tablero", "cuantos expedientes", "situacion"], p: 2 },
    ],
    siguientes: ["vencimientos", "srt"],
  },
  {
    id: "citaciones_proximas",
    pregunta: "¿Qué citaciones hay programadas?",
    tema: "Mis datos",
    datos: true,
    minimo: 3,
    claves: [
      { t: ["citacion", "cita", "turno"], p: 1 },
      { t: ["proxima", "agenda", "hoy", "semana", "programad", "tengo", "mis", "hay"], p: 2 },
    ],
    siguientes: ["citaciones"],
  },
  {
    id: "expediente_actual",
    pregunta: "¿En qué estado está este expediente?",
    datos: true,
    claves: [
      { t: ["este expediente", "esta denuncia", "este caso", "este tramite", "esta ficha", "este siniestro"], p: 3 },
      { t: ["quien actua", "quien tiene", "a quien le toca", "que area", "en que estado"], p: 2 },
      { t: ["como esta", "que falta", "que sigue", "estado"], p: 1 },
    ],
    siguientes: ["adjuntar", "plazos"],
  },

  // --- Mesa de entrada ----------------------------------------------------
  {
    id: "cargar_denuncia",
    pregunta: "¿Cómo cargo una denuncia nueva?",
    tema: "Mesa de entrada",
    claves: [
      { t: ["cargo", "cargar", "carga", "registrar", "registro", "ingresar", "ingreso", "nueva", "crear", "recibir", "tomar"], p: 1 },
      { t: ["denuncia", "siniestro", "accidente", "enfermedad"], p: 1 },
    ],
    responder: (ctx) => [
      {
        tipo: "pasos",
        titulo: "Desde «Nueva denuncia»:",
        pasos: [
          "Buscá a la persona por **CUIL o DNI**. Si tiene siniestros abiertos (en este sistema o en el actual), te avisa.",
          "Elegí el tipo: **Accidente de trabajo**, **In itinere** o **Enfermedad profesional**.",
          "Completá las solapas: persona, datos laborales, el hecho, los diagnósticos y la documentación.",
          "Revisá y registrá: el sistema le asigna el número y podés imprimir la **constancia de recepción**.",
        ],
      },
      ...deOtraArea(ctx, "mesa_entrada"),
      enlaces(["Cargar una denuncia", "/mesa/nueva"]),
    ],
    siguientes: ["documentacion", "siniestro_abierto", "pasar_medica"],
  },
  {
    id: "documentacion",
    pregunta: "¿Qué documentación pide cada tipo?",
    tema: "Mesa de entrada",
    claves: [
      { t: ["documentacion", "documentos", "papeles", "requisito", "checklist"], p: 1 },
      { t: ["pide", "piden", "pedir", "necesit", "exig", "obligatori", "presentar", "lleva", "hace falta", "traer"], p: 1 },
      { t: ["in itinere", "accidente", "enfermedad", "ep", "at", "tipo", "cada"], p: 1 },
    ],
    responder: () => [
      {
        tipo: "lista",
        titulo: "Lo que se pide al recibir la denuncia:",
        items: TIPOS.map((t) => ({
          titulo: TIPO_INFO[t].nombre,
          detalle: documentosDeRecepcion(t)
            .map((d) => (d.exigencia === "si_corresponde" ? `${d.nombre} (si corresponde)` : d.nombre))
            .join(" · "),
        })),
      },
      nota("En la demo se registran el nombre y el tamaño de cada archivo, no el archivo."),
    ],
    siguientes: ["adjuntar", "pasar_medica"],
  },
  {
    id: "siniestro_abierto",
    pregunta: "¿Qué pasa si ya tiene un siniestro abierto?",
    tema: "Mesa de entrada",
    claves: [
      { t: ["abierto", "otro siniestro", "ya tiene", "duplicad", "repetid", "dos denuncias"], p: 2 },
      { t: ["siniestro", "denuncia", "persona", "trabajador"], p: 1 },
    ],
    responder: () => [
      texto(
        "Al buscar a la persona, el sistema revisa sus siniestros **abiertos**, en este sistema y en el que la UERT usa hoy, y te los muestra antes de seguir.",
      ),
      texto(
        "Es un aviso: podés cargar la denuncia igual. Si es un siniestro nuevo durante una licencia activa, puede corresponder una **intercurrencia**; si es una recaída después del alta, un **reingreso**.",
      ),
    ],
    siguientes: ["intercurrencia", "reingreso"],
  },
  {
    id: "pasar_medica",
    pregunta: "¿Cuándo puedo pasar una denuncia a Médica?",
    tema: "Mesa de entrada",
    claves: [
      { t: ["pasar", "pase", "paso", "mandar", "enviar", "derivar"], p: 1 },
      { t: ["medica", "medico", "medicina"], p: 1 },
    ],
    responder: (ctx) => [
      {
        tipo: "lista",
        titulo: "Para pasarla al Área médica hace falta:",
        items: [
          { titulo: "Verificar la relación laboral", detalle: "Si no se corrobora, queda Desistida y se informa a la SRT." },
          { titulo: "La documentación obligatoria completa", detalle: "Según el tipo de denuncia." },
          { titulo: "En una EP, informarla a la SRT", detalle: "Se hace sola al pasarla, por el Web Service FODEP (simulado)." },
        ],
      },
      ...deOtraArea(ctx, "mesa_entrada"),
    ],
    siguientes: ["documentacion", "fodep"],
  },
  {
    id: "reingreso",
    pregunta: "¿Cómo cargo un reingreso?",
    tema: "Mesa de entrada",
    claves: [{ t: ["reingreso", "reingres", "recaida", "rehabilit", "reabrir", "volvio a"], p: 2 }],
    responder: (ctx) => [
      texto(
        "Un **reingreso** es una recaída de un siniestro que ya tuvo el alta. Se carga desde la ficha de ese siniestro (estado **Alta médica**), con la fecha y la descripción.",
      ),
      texto("Conserva el número y suma 1 al sufijo: el reingreso de 2026-000012-00 es **2026-000012-01**. Vuelve a empezar en Mesa de entrada."),
      ...deOtraArea(ctx, "mesa_entrada"),
    ],
    siguientes: ["numero_siniestro", "intercurrencia"],
  },
  {
    id: "documentos_impresos",
    pregunta: "¿Qué documentos se pueden imprimir?",
    tema: "Mesa de entrada",
    claves: [{ t: ["constancia", "comprobante", "imprimir", "impresion", "notificacion", "hoja"], p: 2 }],
    responder: () => [
      {
        tipo: "lista",
        titulo: "Desde la ficha del expediente:",
        items: [
          { titulo: "Constancia de recepción", detalle: "La emite Mesa de entrada al registrar la denuncia." },
          { titulo: "Citación", detalle: "La emite el Área médica al programar una cita." },
          { titulo: "Notificación de rechazo", detalle: "La emite el Área legal al cerrar un dictamen con diagnósticos rechazados." },
        ],
      },
      nota("Para el PDF, elegí «Guardar como PDF» al imprimir."),
    ],
    siguientes: ["citaciones", "motivos_rechazo"],
  },
  {
    id: "adjuntar",
    pregunta: "¿Cómo adjunto un documento?",
    tema: "Mesa de entrada",
    claves: [
      { t: ["adjunt", "anexar"], p: 2 },
      { t: ["subir", "sumar", "agregar", "cargar"], p: 1 },
      { t: ["archivo", "documento", "pdf", "foto", "imagen", "escane", "certificado"], p: 1 },
    ],
    responder: () => [
      texto(
        "En la ficha del expediente usá **«Adjuntar documento»**: elegís el tipo (DNI, certificado médico, estudios…) y los archivos, en una o varias tandas.",
      ),
      texto("Pueden adjuntar Mesa de entrada, Médica, Legal y Seguimiento mientras el expediente está abierto."),
      nota("En la demo se registran el nombre y el tamaño de cada archivo, no el archivo. A mí también podés mandarme uno con el clip."),
    ],
    siguientes: ["documentacion"],
  },

  // --- Área médica --------------------------------------------------------
  {
    id: "evaluar_diagnostico",
    pregunta: "¿Cómo evalúo un diagnóstico?",
    tema: "Área médica",
    claves: [
      { t: ["evalu", "constat", "analiz", "revis"], p: 1 },
      { t: ["diagnostic", "cie", "cie10", "patologia", "lesion"], p: 1 },
    ],
    responder: (ctx) => [
      {
        tipo: "pasos",
        titulo: "En la ficha, panel del Área médica:",
        pasos: [
          "Tocá **Evaluar** en el diagnóstico.",
          "Confirmá o corregí el código **CIE-10**, indicá si está en el **Listado de EP** y si la patología está **constatada**.",
          "Cargá las **lesiones** y las **zonas del cuerpo** (tablas de la SRT) y el código de examen.",
        ],
      },
      texto(`Si hace falta, podés agregar diagnósticos (en una EP, hasta 10, cada uno con su agente causante).`),
      ...deOtraArea(ctx, "medico"),
    ],
    siguientes: ["baja", "pasar_legal", "citaciones"],
  },
  {
    id: "citaciones",
    pregunta: "¿Cómo funcionan las citaciones?",
    tema: "Área médica",
    claves: [{ t: ["citacion", "citar", "cito", "citado", "72", "inasistencia", "no asistio", "no vino", "no se presento", "reiter", "caduc"], p: 2 }],
    responder: (ctx) => [
      {
        tipo: "pasos",
        pasos: [
          `El Área médica cita al trabajador a un examen, a estudios o a presentar documentación, con al menos **${PLAZOS.citacionHorasMinimas} h** de anticipación.`,
          "Después de la cita registra si **asistió** o **no asistió**.",
          "Si no asistió, se puede **reiterar una sola vez**.",
          "Si tampoco asiste a la reiteración, el trámite **caduca** y la denuncia queda **Desistida** por incomparecencia.",
        ],
      },
      nota("Cada citación se puede imprimir desde la ficha para entregarla o enviarla."),
      ...deOtraArea(ctx, "medico"),
    ],
    siguientes: ["citaciones_proximas", "desistido"],
  },
  {
    id: "baja",
    pregunta: "¿Cómo se define la baja laboral?",
    tema: "Área médica",
    claves: [
      { t: ["baja"], p: 2 },
      { t: ["defin", "laboral", "inasistencia", "con baja", "sin baja"], p: 1 },
    ],
    responder: (ctx) => [
      texto("El Área médica define si hay **baja laboral** y, si la hay, desde qué fecha empieza la inasistencia."),
      texto("La inasistencia empieza como mínimo **el día siguiente** al siniestro."),
      {
        tipo: "lista",
        titulo: "Qué pasa después del dictamen legal:",
        items: [
          { titulo: "Con baja → Licencia activa", detalle: "Seguimiento controla las presentaciones hasta el alta." },
          { titulo: "Sin baja → Aceptado sin baja", detalle: `Hay ${listaDias(PLAZOS.sinBajaDiasHabiles, true)} para presentarlo ante la Comisión Médica.` },
        ],
      },
      ...deOtraArea(ctx, "medico"),
    ],
    siguientes: ["pasar_legal", "licencia"],
  },
  {
    id: "pasar_legal",
    pregunta: "¿Cuándo puedo pasar a Legal?",
    tema: "Área médica",
    claves: [
      { t: ["pasar", "pase", "paso", "mandar", "enviar", "derivar"], p: 1 },
      { t: ["legal", "abogad", "juridic"], p: 1 },
    ],
    responder: (ctx) => [
      {
        tipo: "lista",
        titulo: "El Área médica la pasa a Legal cuando:",
        items: [
          { titulo: "Todos los diagnósticos están evaluados" },
          { titulo: "Está definida la baja laboral (con o sin baja)" },
        ],
      },
      texto(`Al pasar, empieza a correr el plazo legal de **${listaDias(PLAZOS.legalDiasHabiles, true)}**.`),
      ...deOtraArea(ctx, "medico"),
    ],
    siguientes: ["evaluar_diagnostico", "plazos"],
  },
  {
    id: "reencuadre",
    pregunta: "¿Cómo reencuadro un accidente como EP?",
    tema: "Área médica",
    claves: [
      { t: ["reencuadr", "convertir", "cambiar el tipo", "pasar a ep"], p: 2 },
      { t: ["enfermedad profesional", "ep"], p: 1 },
    ],
    responder: (ctx) => [
      texto(
        "Durante la evaluación, el Área médica puede **reencuadrar** un accidente como **Enfermedad Profesional** si lo que se denunció es en realidad una EP.",
      ),
      texto("El expediente conserva el número y pasa a pedir los datos de una EP (exposición, agente causante) y a informarse por FODEP."),
      ...deOtraArea(ctx, "medico"),
    ],
    siguientes: ["fodep"],
  },

  // --- Área legal ---------------------------------------------------------
  {
    id: "motivos_rechazo",
    pregunta: "¿Qué significan los motivos R, D, E, P y L?",
    tema: "Área legal",
    claves: [
      { t: ["motivo", "causal", "razon", "letras"], p: 1 },
      { t: ["rechaz", "significa", "quiere decir"], p: 1 },
      { t: ["cymat"], p: 2 },
    ],
    extra: (palabras) => (palabras.filter((p) => ["r", "d", "p", "l"].includes(p)).length >= 2 ? 2 : 0),
    responder: () => [
      {
        tipo: "lista",
        titulo: "Motivos de rechazo de un diagnóstico:",
        items: MOTIVOS_RECHAZO.map((m) => ({ titulo: `${m} · ${MOTIVO_RECHAZO_INFO[m].nombre}`, detalle: MOTIVO_RECHAZO_INFO[m].detalle })),
      },
      nota("R aplica a accidentes; D, a reingresos; E, P y L, a enfermedades profesionales."),
    ],
    siguientes: ["decidir_diagnostico", "cerrar_dictamen"],
  },
  {
    id: "decidir_diagnostico",
    pregunta: "¿Cómo acepto o rechazo un diagnóstico?",
    tema: "Área legal",
    claves: [
      { t: ["acept", "rechaz", "decid", "resolver", "dictamin"], p: 1 },
      { t: ["diagnostic", "denuncia", "cada"], p: 1 },
    ],
    responder: (ctx) => [
      texto("El Área legal decide **cada diagnóstico por separado**: lo acepta o lo rechaza con un motivo y su fundamento."),
      {
        tipo: "lista",
        items: [
          { titulo: "Rechazo por E", detalle: "Exige adjuntar el relevamiento CYMAT." },
          { titulo: "Rechazo por P", detalle: "Exige precisar los estudios practicados." },
        ],
      },
      ...deOtraArea(ctx, "legal"),
    ],
    siguientes: ["motivos_rechazo", "cerrar_dictamen", "prorroga"],
  },
  {
    id: "prorroga",
    pregunta: "¿Cómo pido una prórroga?",
    tema: "Área legal",
    claves: [{ t: ["prorroga", "prorrog", "extender", "extension", "mas tiempo", "mas dias", "ampliar"], p: 2 }],
    responder: (ctx) => [
      texto(
        `En el panel del Área legal tocá **«Pedir prórroga»**. Se puede pedir **una sola vez** y suma **${listaDias(PLAZOS.prorrogaDiasHabiles, true)}** al vencimiento.`,
      ),
      nota("La duración de la prórroga está a confirmar con la UERT."),
      ...deOtraArea(ctx, "legal"),
    ],
    siguientes: ["plazos", "vencimientos"],
  },
  {
    id: "cerrar_dictamen",
    pregunta: "¿Cómo cierro el dictamen?",
    tema: "Área legal",
    claves: [
      { t: ["cerrar", "cierro", "cierre", "terminar", "finalizar"], p: 1 },
      { t: ["dictamen"], p: 1 },
    ],
    responder: (ctx) => [
      texto("Cuando todos los diagnósticos tienen decisión, tocá **«Cerrar dictamen»**. El expediente sigue según el resultado:"),
      {
        tipo: "lista",
        items: [
          { titulo: "Algún diagnóstico aceptado y con baja", detalle: "→ Licencia activa (Seguimiento)." },
          { titulo: "Algún diagnóstico aceptado y sin baja", detalle: "→ Aceptado sin baja: hay que presentarlo ante la Comisión Médica." },
          { titulo: "Todos rechazados", detalle: "→ Rechazado. Se imprime la notificación de rechazo." },
        ],
      },
      ...deOtraArea(ctx, "legal"),
    ],
    siguientes: ["motivos_rechazo", "documentos_impresos"],
  },

  // --- Seguimiento --------------------------------------------------------
  {
    id: "presentaciones",
    pregunta: "¿Cómo registro una presentación de la licencia?",
    tema: "Seguimiento",
    claves: [
      { t: ["presentacion", "certificado de control"], p: 2 },
      { t: ["licencia", "registr", "carg"], p: 1 },
    ],
    responder: (ctx) => [
      texto(
        "En la ficha, panel de Seguimiento, tocá **«Registrar presentación»**: la fecha, el detalle (certificado de control, estudios…) y la **próxima fecha** en la que tiene que presentarse.",
      ),
      texto(`Con esa fecha el sistema avisa ${PLAZOS.avisoPresentacionDias} días antes y marca las presentaciones vencidas.`),
      ...deOtraArea(ctx, "seguimiento"),
    ],
    siguientes: ["licencia", "alta"],
  },
  {
    id: "licencia",
    pregunta: "¿Cómo se sigue una licencia?",
    tema: "Seguimiento",
    claves: [{ t: ["licencia", "ilt", "incapacidad laboral temporaria", "seguimiento"], p: 2 }],
    responder: (ctx) => [
      texto(
        "Cuando el dictamen acepta la denuncia con baja, el expediente queda en **Licencia activa** y lo sigue el área de Seguimiento:",
      ),
      {
        tipo: "pasos",
        pasos: [
          `La primera presentación es a los ${listaDias(PLAZOS.primeraPresentacionDias, false)} de la aceptación.`,
          "En cada presentación se registra el control y se fija la siguiente.",
          "Si hay un siniestro nuevo durante la licencia, se carga como **intercurrencia**.",
          `Termina con el **alta**, o al llegar al tope de ${PLAZOS.topeIltDias} días.`,
        ],
      },
      ...deOtraArea(ctx, "seguimiento"),
      enlaces(["Ver licencias", "/seguimiento"]),
    ],
    siguientes: ["presentaciones", "intercurrencia", "alta"],
  },
  {
    id: "intercurrencia",
    pregunta: "¿Qué es una intercurrencia?",
    tema: "Seguimiento",
    claves: [{ t: ["intercurrencia", "intercurrente", "durante la licencia", "otro accidente"], p: 2 }],
    responder: (ctx) => [
      texto(
        "Es un **siniestro nuevo que ocurre durante una licencia activa**. Se carga desde la ficha del siniestro original y queda vinculado a él.",
      ),
      texto("Tiene su propio número y va **directo al Área médica**, sin pasar por Mesa de entrada."),
      ...deOtraArea(ctx, "seguimiento"),
    ],
    siguientes: ["reingreso", "licencia"],
  },
  {
    id: "alta",
    pregunta: "¿Cómo doy el alta?",
    tema: "Seguimiento",
    claves: [
      { t: ["alta"], p: 2 },
      { t: ["dar", "doy", "medica", "cese", "fin", "terminar"], p: 1 },
    ],
    responder: (ctx) => [
      texto("Desde el panel de Seguimiento (o del Área médica), tocá **«Dar el alta»** con la fecha y el motivo del cese de la licencia:"),
      { tipo: "lista", items: Object.entries(MOTIVO_CESE_ILT_INFO).map(([k, v]) => ({ titulo: `${k} · ${v}` })) },
      texto("El expediente queda en **Alta médica**. Si después hay una recaída, se carga un reingreso."),
      ...deOtraArea(ctx, "seguimiento"),
    ],
    siguientes: ["reingreso", "tope_ilt"],
  },
  {
    id: "tope_ilt",
    pregunta: "¿Qué pasa al llegar a los 365 días?",
    tema: "Seguimiento",
    claves: [{ t: ["365", "tope", "un ano", "limite de la licencia"], p: 2 }],
    responder: () => [
      texto(
        `La licencia por accidente o enfermedad profesional tiene un tope de **${PLAZOS.topeIltDias} días** desde el siniestro (Ley 24.557, art. 7).`,
      ),
      texto(
        `El sistema avisa ${PLAZOS.avisoTopeIltDias} días antes. Al cumplirse, la licencia se cierra con el motivo **T · ${MOTIVO_CESE_ILT_INFO.T}**.`,
      ),
    ],
    siguientes: ["alta", "comision_medica"],
  },
  {
    id: "comision_medica",
    pregunta: "¿Qué es la Comisión Médica?",
    tema: "Seguimiento",
    claves: [{ t: ["comision medica", "comision", "cm"], p: 3 }],
    responder: (ctx) => [
      texto(
        `Es la **${UERT.comisionMedica.nombre}** (${UERT.comisionMedica.direccion}).`,
      ),
      texto(
        `Cuando se acepta una denuncia **sin baja**, hay **${listaDias(PLAZOS.sinBajaDiasHabiles, true)}** para presentar el trámite ahí. Al registrarlo, el expediente queda **Cerrado**.`,
      ),
      ...deOtraArea(ctx, "seguimiento"),
    ],
    siguientes: ["baja", "plazos"],
  },

  // --- SRT y Enfermedad Profesional ---------------------------------------
  {
    id: "fodep",
    pregunta: "¿Qué es una denuncia de Enfermedad Profesional (FODEP)?",
    tema: "SRT y Enfermedad Profesional",
    claves: [{ t: ["fodep", "enfermedad profesional", "ep", "enfermedades profesionales"], p: 2 }],
    responder: () => [
      texto(
        "Es la nueva denuncia de **Enfermedad Profesional** de la SRT. Se carga con la exposición al agente de riesgo y **hasta 10 diagnósticos**, cada uno con su agente causante.",
      ),
      {
        tipo: "pasos",
        pasos: [
          `Mesa de entrada controla la cobertura dentro de las ${PLAZOS.configuracionHoras} h.`,
          "Al pasarla al Área médica, se informa a la SRT por el **Web Service FODEP** y vuelve el número de formulario.",
          "Cada diagnóstico se evalúa y se decide por separado, y viaja a la SRT en los archivos de intercambio.",
        ],
      },
      nota("En la demo, la conexión con la SRT está simulada: se arma lo mismo que se enviaría y se valida con sus reglas."),
    ],
    siguientes: ["srt", "intercambio", "documentacion"],
  },
  {
    id: "srt",
    pregunta: "¿Cómo se comunica el sistema con la SRT?",
    tema: "SRT y Enfermedad Profesional",
    claves: [
      { t: ["srt", "superintendencia", "web service", "ws"], p: 2 },
      { t: ["comunica", "informa", "envia", "manda", "conecta"], p: 1 },
    ],
    responder: () => [
      {
        tipo: "lista",
        titulo: "Por dos caminos:",
        items: [
          { titulo: "Web Service FODEP", detalle: "Alta, consulta y desistimiento de cada denuncia de EP, en el momento." },
          { titulo: "Sistema de Intercambio", detalle: "Lotes de archivos con los diagnósticos, las lesiones y las zonas del cuerpo." },
        ],
      },
      texto("Todo queda registrado en «Comunicación SRT»: qué se mandó, qué respondió y los errores (códigos FOxx)."),
      nota("En la demo, la conexión está simulada: falta el certificado y el WSDL de la SRT."),
      enlaces(["Ir a Comunicación SRT", "/srt"]),
    ],
    siguientes: ["intercambio", "fodep"],
  },
  {
    id: "intercambio",
    pregunta: "¿Qué son los archivos .AD, .AL y .AZ?",
    tema: "SRT y Enfermedad Profesional",
    claves: [{ t: ["intercambio", "lote", "ancho fijo"], p: 2 }],
    extra: (palabras) => (["ad", "az"].every((x) => palabras.includes(x)) ? 3 : 0),
    responder: () => [
      texto("Son los archivos del **Sistema de Intercambio** de la SRT para FODEP, de ancho fijo:"),
      {
        tipo: "lista",
        items: [
          { titulo: ".AD · Diagnósticos", detalle: "Un registro por diagnóstico (65 posiciones)." },
          { titulo: ".AL · Lesiones", detalle: "Las lesiones de cada diagnóstico (21 posiciones)." },
          { titulo: ".AZ · Zonas del cuerpo", detalle: "Las zonas de cada diagnóstico (22 posiciones)." },
        ],
      },
      texto("Se vinculan por el **Número Único de Diagnóstico**. Los lotes se generan desde «Comunicación SRT»."),
    ],
    siguientes: ["srt"],
  },

  // --- Sobre la demo ------------------------------------------------------
  {
    id: "que_rol",
    pregunta: "¿Con qué rol empiezo?",
    tema: "Sobre la demo",
    claves: [
      { t: ["rol"], p: 1 },
      { t: ["empiezo", "empezar", "primero", "elijo", "elegir", "recomend", "cual"], p: 1 },
    ],
    responder: () => [
      texto("Para ver el circuito completo, empezá por **Mesa de entrada**: cargá una denuncia y pasala al Área médica."),
      texto(
        "Después cambiá a **Área médica**, **Área legal** y **Seguimiento** desde «Viendo como» para llevarla hasta el alta. **Dirección** te muestra el tablero con todo.",
      ),
    ],
    siguientes: ["circuito", "cambiar_rol"],
  },
  {
    id: "cambiar_rol",
    pregunta: "¿Cómo cambio de rol?",
    tema: "Sobre la demo",
    claves: [
      { t: ["rol", "roles", "usuario", "perfil"], p: 1 },
      { t: ["cambiar", "cambio", "otro", "viendo como", "entrar como", "pasar a"], p: 1 },
    ],
    responder: () => [
      {
        tipo: "pasos",
        pasos: [
          "Tocá **«Viendo como»**, arriba a la derecha.",
          "Elegí el área: Mesa de entrada, Médica, Legal, Seguimiento, Dirección o Administración.",
          "Si estás en una ficha, te quedás en el mismo expediente para seguir el trámite con el rol nuevo.",
        ],
      },
    ],
    siguientes: ["que_rol", "circuito"],
  },
  {
    id: "busqueda",
    pregunta: "¿Cómo funciona la búsqueda unificada?",
    tema: "Sobre la demo",
    claves: [{ t: ["busqueda", "buscador", "unificada", "sistema actual", "sistema viejo", "como busco"], p: 2 }],
    responder: () => [
      texto(
        "Buscás por **nombre, DNI o CUIL** y trae todos los siniestros de la persona, del sistema nuevo y del que la UERT usa hoy, ordenados por año.",
      ),
      texto("A mí también podés pedirme que busque: escribime un número de expediente, un DNI, un CUIL o un apellido."),
      enlaces(["Abrir la búsqueda", "/buscar"]),
    ],
    siguientes: ["numero_siniestro"],
  },
  {
    id: "reiniciar_demo",
    pregunta: "¿Cómo reinicio los datos de la demo?",
    tema: "Sobre la demo",
    claves: [
      { t: ["reinici", "resetear", "reset", "borrar", "volver a cero", "recargar", "limpiar"], p: 2 },
      { t: ["demo", "datos", "prueba"], p: 1 },
    ],
    responder: (ctx) => [
      texto(
        "Con el rol **Administración**, en la pantalla de Administración tocá **«Reiniciar la demo»**. Se borran los datos y se vuelven a cargar los de ejemplo, con fechas relativas a hoy.",
      ),
      ...deOtraArea(ctx, "admin"),
    ],
    siguientes: ["cambiar_rol"],
  },
];

const POR_ID = new Map(INTENCIONES.map((i) => [i.id, i]));

export function intencion(id: string): Intencion | undefined {
  return POR_ID.get(id);
}

// ---------------------------------------------------------------------------
// Reconocer lo que se escribe
// ---------------------------------------------------------------------------
function coincide(termino: string, palabras: string[], frase: string): boolean {
  if (termino.includes(" ")) return ` ${frase} `.includes(` ${termino} `);
  if (termino.length <= 3) return palabras.includes(termino);
  return palabras.some((p) => p.startsWith(termino));
}

export function puntaje(i: Intencion, frase: string): number {
  const palabras = frase.split(" ").filter(Boolean);
  const base = i.claves.reduce((s, c) => s + (c.t.some((t) => coincide(t, palabras, frase)) ? (c.p ?? 1) : 0), 0);
  return base + (i.extra?.(palabras) ?? 0);
}

/** La intención que mejor coincide con el texto, o null. */
export function detectarIntencion(texto: string): string | null {
  const frase = normalizarTexto(texto);
  if (!frase) return null;
  let mejor: { id: string; puntos: number; debil: boolean } | null = null;
  for (const i of INTENCIONES) {
    const puntos = puntaje(i, frase);
    if (puntos < (i.minimo ?? 2)) continue;
    const debil = Boolean(i.debil);
    // Una fuerte le gana a una débil; entre iguales, la de más puntos (y, si empatan, la primera).
    if (!mejor || (mejor.debil && !debil) || (mejor.debil === debil && puntos > mejor.puntos)) {
      mejor = { id: i.id, puntos, debil };
    }
  }
  return mejor?.id ?? null;
}

/** Qué buscar si el texto trae un número de expediente, un CUIL, un DNI o «buscá …». */
export interface PedidoBusqueda {
  /** Lo que se le pasa a la búsqueda de expedientes. */
  termino: string;
  /** Cómo se lo nombra en la respuesta. */
  etiqueta: string;
  por: "numero" | "cuil" | "dni" | "texto";
}

const PALABRAS_VACIAS = new Set([
  "un", "una", "el", "la", "los", "las", "de", "del", "al", "a", "y", "o", "que", "en", "por", "para", "con", "me", "mi",
  "expediente", "expedientes", "denuncia", "denuncias", "siniestro", "siniestros", "trabajador", "trabajadora", "persona",
]);

export function detectarBusqueda(textoOriginal: string): PedidoBusqueda | null {
  const t = textoOriginal.trim();
  // Número de expediente: 2026-000012, 2026-12-01, 2026/12…
  const n = /\b(20\d{2})\s*[-/]\s*(\d{1,6})(?:\s*[-/]\s*(\d{1,2}))?\b/.exec(t);
  if (n) {
    const numero = `${n[1]}-${n[2].padStart(6, "0")}${n[3] ? `-${n[3].padStart(2, "0")}` : ""}`;
    return { termino: numero, etiqueta: `el número ${numero}`, por: "numero" };
  }
  const cuil = /\b(\d{2})[-.\s]?(\d{8})[-.\s]?(\d)\b/.exec(t);
  if (cuil) {
    const d = `${cuil[1]}${cuil[2]}${cuil[3]}`;
    return { termino: d, etiqueta: `el CUIL ${cuil[1]}-${cuil[2]}-${cuil[3]}`, por: "cuil" };
  }
  const dni = /\b(\d{1,2})\.?(\d{3})\.?(\d{3})\b/.exec(t);
  if (dni) {
    const d = `${dni[1]}${dni[2]}${dni[3]}`;
    return { termino: d, etiqueta: `el DNI ${Number(d).toLocaleString("es-AR")}`, por: "dni" };
  }
  // «buscá a Pérez», «buscame el expediente de Gómez», «mostrame a Ledesma»
  const pedido = /^(?:busca|buscame|buscar|busco|buscalo|buscala|encontra|encontrame|mostrame|traeme)\s+(.+)$/.exec(
    normalizarTexto(t),
  );
  if (pedido) {
    const palabras = pedido[1].split(" ").filter((p) => !PALABRAS_VACIAS.has(p));
    if (palabras.length && palabras.join("").length >= 3) {
      const termino = palabras.join(" ");
      return { termino, etiqueta: `«${termino}»`, por: "texto" };
    }
  }
  return null;
}

/** Si no se reconoció nada: ¿parece un apellido o un nombre? (1 a 4 palabras, solo letras). */
export function pareceNombre(textoOriginal: string): string | null {
  const palabras = normalizarTexto(textoOriginal).split(" ").filter(Boolean);
  if (!palabras.length || palabras.length > 4) return null;
  if (!palabras.every((p) => /^[a-z]{3,}$/.test(p))) return null;
  const utiles = palabras.filter((p) => !PALABRAS_VACIAS.has(p));
  return utiles.length ? utiles.join(" ") : null;
}

// ---------------------------------------------------------------------------
// Sugerencias y bienvenida
// ---------------------------------------------------------------------------
export function sugerencia(id: string): Sugerencia | null {
  const i = POR_ID.get(id);
  return i ? { texto: i.pregunta, intencion: i.id } : null;
}

export function sugerencias(ids: string[]): Sugerencia[] {
  return ids.map(sugerencia).filter((s): s is Sugerencia => s !== null);
}

/** Id del expediente si la ruta es una ficha (/expedientes/12). */
export function expedienteDeRuta(ruta: string): number | null {
  const m = /^\/expedientes\/(\d{1,9})(?:\/|$)/.exec(ruta);
  return m ? Number(m[1]) : null;
}

const POR_ROL: Record<Rol, string[]> = {
  mesa_entrada: ["pendientes", "cargar_denuncia", "documentacion", "pasar_medica"],
  medico: ["pendientes", "citaciones_proximas", "evaluar_diagnostico", "pasar_legal"],
  legal: ["pendientes", "vencimientos", "motivos_rechazo", "prorroga"],
  seguimiento: ["pendientes", "vencimientos", "intercurrencia", "tope_ilt"],
  direccion: ["resumen", "vencimientos", "circuito", "srt"],
  admin: ["reiniciar_demo", "resumen", "intercambio", "cambiar_rol"],
};

/** Las cuatro preguntas que más sirven donde está el usuario. */
export function sugerenciasPara(ctx: ContextoAsistente): Sugerencia[] {
  const { ruta, rol } = ctx;
  if (!rol) return sugerencias(["que_rol", "circuito", "fodep", "audios"]);
  if (expedienteDeRuta(ruta)) return sugerencias(["expediente_actual", "adjuntar", "plazos", "circuito"]);
  if (ruta.startsWith("/mesa/nueva")) return sugerencias(["documentacion", "siniestro_abierto", "fodep", "numero_siniestro"]);
  if (ruta.startsWith("/srt")) return sugerencias(["srt", "intercambio", "fodep", "resumen"]);
  if (ruta.startsWith("/buscar")) return sugerencias(["busqueda", "numero_siniestro", "pendientes", "circuito"]);
  return sugerencias(POR_ROL[rol]);
}

/** Primer mensaje al abrir el asistente. */
export function bienvenida(ctx: ContextoAsistente): Respuesta {
  const area = ctx.rol ? ROL_INFO[ctx.rol].nombre : null;
  return {
    intencion: "bienvenida",
    bloques: [
      texto(
        `¡Hola${ctx.nombre ? `, ${ctx.nombre}` : ""}! Soy **${NOMBRE_ASISTENTE}**, el asistente virtual de la UERT.${
          area ? ` Veo que estás como **${area}**.` : ""
        }`,
      ),
      texto("Elegí una pregunta o escribime. También podés mandarme un **audio** o **adjuntar** un archivo."),
    ],
    sugerencias: [...sugerenciasPara(ctx), ...(ctx.rol ? sugerencias(["recorrido"]) : [])],
  };
}

/** Todas las preguntas prearmadas, por tema (la pantalla «Todas las preguntas»). */
export function preguntasPorTema(): Array<{ tema: Tema; preguntas: Sugerencia[] }> {
  const temas: Tema[] = [
    "Mis datos",
    "El circuito",
    "Mesa de entrada",
    "Área médica",
    "Área legal",
    "Seguimiento",
    "SRT y Enfermedad Profesional",
    "Sobre la demo",
  ];
  return temas.map((tema) => ({
    tema,
    preguntas: INTENCIONES.filter((i) => i.tema === tema).map((i) => ({ texto: i.pregunta, intencion: i.id })),
  }));
}

/** Respuesta fija de una intención (null si es de datos o no existe). */
export function respuestaFija(id: string, ctx: ContextoAsistente): Respuesta | null {
  const i = POR_ID.get(id);
  if (!i?.responder) return null;
  return { intencion: i.id, bloques: i.responder(ctx), sugerencias: sugerencias(i.siguientes ?? []) };
}

/** Cuando no hay respuesta armada. */
export function respuestaNoEntendida(ctx: ContextoAsistente): Respuesta {
  return {
    intencion: "no_entendida",
    bloques: [
      texto("No tengo una respuesta armada para eso todavía."),
      texto(
        "Probá con alguna de estas preguntas, o escribime un **número de expediente**, un **DNI**, un **CUIL** o un **apellido** y lo busco.",
      ),
    ],
    sugerencias: sugerenciasPara(ctx),
  };
}
