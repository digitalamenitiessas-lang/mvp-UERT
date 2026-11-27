/**
 * Yanapa, el asistente virtual: que reconozca lo que se escribe, que todas
 * las preguntas prearmadas tengan respuesta y que las respuestas con datos
 * salgan de la demo (PGlite en memoria).
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  detectarBusqueda,
  detectarIntencion,
  expedienteDeRuta,
  INTENCIONES,
  intencion,
  nombreDePila,
  pareceNombre,
  preguntasPorTema,
  respuestaFija,
  sugerenciasPara,
} from "@/lib/asistente/conocimiento";
import { limpiarConsulta, responderConsulta } from "@/lib/asistente/responder";
import type { Bloque, ConsultaAsistente, Respuesta } from "@/lib/asistente/tipos";
import { crearPglite, type Db } from "@/lib/db";
import { migrar } from "@/lib/db/migrar";
import { listarExpedientes } from "@/lib/datos/expedientes";
import { sembrarDemo } from "@/lib/demo/sembrar";
import { ROLES, type Rol } from "@/lib/dominio/constantes";
import type { Usuario } from "@/lib/tipos";

describe("Reconoce lo que se escribe", () => {
  it.each([
    ["hola", "saludo"],
    ["Hola, ¿cómo cargo una denuncia?", "cargar_denuncia"],
    ["¿Qué tengo pendiente?", "pendientes"],
    ["qué expedientes vencen esta semana", "vencimientos"],
    ["¿hay algo vencido?", "vencimientos"],
    ["¿Cuántos días tiene legal para dictaminar?", "plazos"],
    ["qué significa el motivo E", "motivos_rechazo"],
    ["¿Qué significan los motivos R, D, E, P y L?", "motivos_rechazo"],
    ["cómo pido una prórroga", "prorroga"],
    ["¿Qué es una intercurrencia?", "intercurrencia"],
    ["documentación para un accidente in itinere", "documentacion"],
    ["¿Qué son los archivos .AD, .AL y .AZ?", "intercambio"],
    ["cómo cambio de rol", "cambiar_rol"],
    ["quiero hablar con una persona", "humano"],
    ["¿puedo mandarte un audio?", "audios"],
    ["¡gracias!", "gracias"],
    ["¿Cómo evalúo un diagnóstico?", "evaluar_diagnostico"],
    ["¿qué pasa si no se presenta a la citación?", "citaciones"],
    ["¿qué citaciones tengo esta semana?", "citaciones_proximas"],
    ["dame un resumen", "resumen"],
    ["¿cuándo doy el alta?", "alta"],
    ["¿cómo se arma el número de siniestro?", "numero_siniestro"],
    ["¿qué es FODEP?", "fodep"],
    ["¿qué pasa si ya tiene un siniestro abierto?", "siniestro_abierto"],
    ["¿quién tiene que actuar en este expediente?", "expediente_actual"],
    ["mostrame cómo usar esta pantalla", "recorrido"],
    ["quiero hacer el recorrido guiado", "recorrido"],
    ["¿Cómo es el recorrido de una denuncia?", "circuito"],
    ["¿Qué es un accidente de trabajo?", null],
    ["asdfgh", null],
  ])("«%s» → %s", (texto, esperado) => {
    expect(detectarIntencion(texto)).toBe(esperado);
  });

  it("cada pregunta prearmada se reconoce a sí misma", () => {
    const debiles = new Set(INTENCIONES.filter((i) => i.debil).map((i) => i.id));
    for (const i of INTENCIONES.filter((x) => x.tema && !debiles.has(x.id))) {
      expect(detectarIntencion(i.pregunta), i.pregunta).toBe(i.id);
    }
  });
});

describe("Pedidos de búsqueda", () => {
  it.each([
    ["2026-12", { termino: "2026-000012", por: "numero" }],
    ["el expediente 2026-000017-00", { termino: "2026-000017-00", por: "numero" }],
    ["20-99000103-1", { termino: "20990001031", por: "cuil" }],
    ["99.000.103", { termino: "99000103", por: "dni" }],
    ["buscá a Ledesma", { termino: "ledesma", por: "texto" }],
    ["mostrame el expediente de Gómez", { termino: "gomez", por: "texto" }],
  ])("«%s»", (texto, esperado) => {
    expect(detectarBusqueda(texto)).toMatchObject(esperado);
  });

  it("no confunde una pregunta con una búsqueda", () => {
    expect(detectarBusqueda("¿qué plazos hay?")).toBeNull();
    expect(detectarBusqueda("buscá un expediente")).toBeNull();
  });

  it("reconoce un apellido suelto", () => {
    expect(pareceNombre("Ledesma")).toBe("ledesma");
    expect(pareceNombre("¿Cómo cargo una denuncia nueva hoy mismo?")).toBeNull();
    expect(pareceNombre("2026")).toBeNull();
  });
});

describe("Preguntas prearmadas", () => {
  it("todas tienen respuesta (fija o con datos) y sus sugerencias existen", () => {
    for (const i of INTENCIONES) {
      expect(Boolean(i.responder) !== Boolean(i.datos), i.id).toBe(true);
      for (const s of i.siguientes ?? []) expect(intencion(s), `${i.id} → ${s}`).toBeDefined();
    }
  });

  it("las respuestas fijas se arman para todos los roles sin textos vacíos", () => {
    for (const rol of [...ROLES, null]) {
      for (const i of INTENCIONES.filter((x) => x.responder)) {
        const r = respuestaFija(i.id, { rol, nombre: "Carla", ruta: "/" })!;
        expect(r.bloques.length, i.id).toBeGreaterThan(0);
        expect(JSON.stringify(r), i.id).not.toMatch(/undefined|NaN|\[object/);
      }
    }
  });

  it("sugiere cuatro preguntas válidas según el rol y la pantalla", () => {
    const rutas = ["/", "/mesa", "/mesa/nueva", "/expedientes/3", "/srt", "/buscar", "/ingresar"];
    for (const rol of [...ROLES, null]) {
      for (const ruta of rutas) {
        const s = sugerenciasPara({ rol, nombre: null, ruta });
        expect(s).toHaveLength(4);
        s.forEach((x) => expect(intencion(x.intencion)).toBeDefined());
      }
    }
  });

  it("agrupa las preguntas por tema, sin temas vacíos", () => {
    for (const { tema, preguntas } of preguntasPorTema()) expect(preguntas.length, tema).toBeGreaterThan(0);
  });

  it("saluda por el nombre de pila y reconoce la ficha en la ruta", () => {
    expect(nombreDePila("Dra. Silvina Herrera")).toBe("Silvina");
    expect(nombreDePila("Lic. Laura Ibáñez")).toBe("Laura");
    expect(expedienteDeRuta("/expedientes/18")).toBe(18);
    expect(expedienteDeRuta("/expedientes/18/editar")).toBe(18);
    expect(expedienteDeRuta("/expedientes")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Con los datos de la demo
// ---------------------------------------------------------------------------
let db: Db;
let usuarios: Record<Rol, Usuario>;

beforeAll(async () => {
  db = await crearPglite(":memory:");
  await migrar(db);
  await sembrarDemo(db, { ahora: new Date() });
  const { rows } = await db.query<Usuario>("select * from usuarios");
  usuarios = Object.fromEntries(rows.map((u) => [u.rol, u])) as Record<Rol, Usuario>;
});

const preguntar = (rol: Rol | null, c: Partial<ConsultaAsistente>) =>
  responderConsulta(db, rol ? usuarios[rol] : null, { texto: "", ruta: "/", ...c });

const bloques = <T extends Bloque["tipo"]>(r: Respuesta, tipo: T) =>
  r.bloques.filter((b): b is Extract<Bloque, { tipo: T }> => b.tipo === tipo);

describe("Respuestas con datos de la demo", () => {
  it.each(ROLES)("«¿Qué tengo pendiente?» como %s", async (rol) => {
    const r = await preguntar(rol, { texto: "¿Qué tengo pendiente hoy?", intencion: "pendientes" });
    expect(r.intencion).toBe("pendientes");
    expect(bloques(r, "indicadores").length).toBe(1);
    expect(JSON.stringify(r)).not.toMatch(/undefined|NaN/);
  });

  it("los pendientes de Mesa de entrada son los expedientes en recepción", async () => {
    const enRecepcion = await listarExpedientes(db, { estados: ["recepcion"] });
    const r = await preguntar("mesa_entrada", { intencion: "pendientes" });
    expect(bloques(r, "indicadores")[0].items[0]).toMatchObject({ etiqueta: "En recepción", valor: enRecepcion.length });
    for (const e of bloques(r, "expedientes")[0].items) expect(e.estado).toBe("recepcion");
  });

  it("los vencimientos de Legal son solo de su área y los más urgentes primero", async () => {
    const r = await preguntar("legal", { intencion: "vencimientos" });
    const items = bloques(r, "expedientes").flatMap((b) => b.items);
    items.forEach((e) => expect(e.estado).toBe("dictamen_legal"));
    const orden = { vencido: 0, hoy: 1, proximo: 2, en_termino: 3 };
    const niveles = items.map((e) => orden[e.plazo!.nivel]);
    expect(niveles).toEqual([...niveles].sort((a, b) => a - b));
  });

  it("el resumen del día cuenta los expedientes abiertos", async () => {
    const abiertos = await listarExpedientes(db, {
      estados: ["recepcion", "evaluacion_medica", "dictamen_legal", "licencia_activa", "sin_baja"],
    });
    const r = await preguntar("direccion", { texto: "dame un resumen del día" });
    expect(r.intencion).toBe("resumen");
    expect(bloques(r, "indicadores")[0].items[0]).toMatchObject({ etiqueta: "Abiertos", valor: abiertos.length });
  });

  it("cuenta cómo está el expediente de la ficha y qué puede hacer cada rol", async () => {
    const [exp] = await listarExpedientes(db, { estados: ["evaluacion_medica"], limite: 1 });
    const ruta = `/expedientes/${exp.id}`;
    const medico = await preguntar("medico", { intencion: "expediente_actual", ruta });
    expect(JSON.stringify(medico)).toContain(exp.numero);
    expect(JSON.stringify(medico)).toContain("Evaluar los diagnósticos");

    const legal = await preguntar("legal", { intencion: "expediente_actual", ruta });
    expect(bloques(legal, "nota").some((n) => n.texto.includes("Área médica"))).toBe(true);
  });

  it("busca por número, por DNI y por apellido", async () => {
    const [exp] = await listarExpedientes(db, { limite: 1 });
    const porNumero = await preguntar("mesa_entrada", { texto: `expediente ${exp.numero}` });
    expect(bloques(porNumero, "expedientes")[0].items.map((e) => e.id)).toContain(exp.id);

    const porDni = await preguntar("mesa_entrada", { texto: exp.dni });
    expect(bloques(porDni, "expedientes")[0].items.map((e) => e.id)).toContain(exp.id);

    const porApellido = await preguntar("mesa_entrada", { texto: exp.apellido });
    expect(porApellido.intencion).toBe("buscar");
    expect(bloques(porApellido, "expedientes")[0].items.map((e) => e.id)).toContain(exp.id);
  });

  it("una pregunta reconocida le gana a «mostrame …» como búsqueda", async () => {
    const r = await preguntar("direccion", { texto: "mostrame cómo usar esta pantalla", ruta: "/direccion" });
    expect(r.intencion).toBe("recorrido");
    expect(bloques(r, "recorrido")).toHaveLength(1);
    const pendientes = await preguntar("legal", { texto: "mostrame mis pendientes" });
    expect(pendientes.intencion).toBe("pendientes");
  });

  it("si no encuentra, ofrece la búsqueda unificada", async () => {
    const r = await preguntar("mesa_entrada", { texto: "2019-999999" });
    expect(bloques(r, "enlaces")[0].enlaces[0].href).toBe("/buscar?q=2019-999999");
  });

  it("responde un adjunto con el expediente de la ficha", async () => {
    const [exp] = await listarExpedientes(db, { estados: ["recepcion"], limite: 1 });
    const r = await preguntar("mesa_entrada", {
      ruta: `/expedientes/${exp.id}`,
      adjunto: { nombre: "dni.pdf", tipo: "application/pdf", tamano: 250_000 },
    });
    expect(JSON.stringify(r)).toContain(exp.numero);
    expect(JSON.stringify(r)).toContain("244 KB");
  });

  it("responde un audio que no se pudo transcribir", async () => {
    const r = await preguntar("medico", { audioSinTexto: { segundos: 7.4 } });
    expect(r.intencion).toBe("audio_sin_texto");
    expect(JSON.stringify(r)).toContain("0:07");
  });

  it("sin rol, contesta lo general y pide elegir uno para los datos", async () => {
    expect((await preguntar(null, { texto: "¿Qué es FODEP?" })).intencion).toBe("fodep");
    const r = await preguntar(null, { intencion: "pendientes" });
    expect(JSON.stringify(r)).toContain("elegí con qué rol entrar");
  });

  it("si no entiende, lo dice y sugiere preguntas", async () => {
    const r = await preguntar("legal", { texto: "zzzz qqqq" });
    expect(r.intencion).toBe("no_entendida");
    expect(r.sugerencias.length).toBeGreaterThan(0);
  });
});

describe("Lo que llega del navegador", () => {
  it("se limpia: largos, tipos e intenciones inventadas", () => {
    const c = limpiarConsulta({
      texto: "x".repeat(2000),
      ruta: 42,
      intencion: "borrar_todo",
      adjunto: { nombre: 5, tamano: -3 },
      audioSinTexto: { segundos: 99999 },
    });
    expect(c.texto).toHaveLength(500);
    expect(c.ruta).toBe("/");
    expect(c.intencion).toBeUndefined();
    expect(c.adjunto).toEqual({ nombre: "archivo", tipo: "", tamano: 0 });
    expect(c.audioSinTexto).toEqual({ segundos: 600 });
    expect(limpiarConsulta(null)).toEqual({ texto: "", ruta: "/" });
  });
});
