/**
 * Reglas de negocio puntuales, cada una sobre una base nueva con la demo.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { crearPglite, type Db } from "@/lib/db";
import { migrar } from "@/lib/db/migrar";
import { sembrarDemo } from "@/lib/demo/sembrar";
import { buscarIncidentes } from "@/lib/datos/busqueda";
import { obtenerFicha } from "@/lib/datos/expedientes";
import { fechaDe, sumarDias } from "@/lib/dominio/fechas";
import type { NuevaDenunciaEntrada } from "@/lib/esquemas";
import {
  agregarDiagnostico,
  crearDenuncia,
  crearReingreso,
  darAlta,
  decidirDiagnostico,
  desistir,
  editarDenuncia,
  evaluarDiagnostico,
  generarLoteIntercambio,
  pasarAMedica,
  programarCitacion,
  reencuadrarComoEP,
  registrarAsistencia,
  registrarIntercurrencia,
  registrarPresentacionCM,
  solicitarProrroga,
  type Ctx,
} from "@/lib/operaciones";
import type { Expediente, Usuario } from "@/lib/tipos";

let db: Db;
let usuarios: Record<string, Usuario>;
const ahora = new Date();
const hoy = fechaDe(ahora);
const ctx = (rol: string): Ctx => ({ db, usuario: usuarios[rol], ahora: new Date() });

async function exp(apellido: string, extra = ""): Promise<Expediente> {
  const { rows } = await db.query<Expediente>(
    `select e.* from expedientes e join personas p on p.id = e.persona_id where p.apellido = $1 ${extra} order by e.id limit 1`,
    [apellido],
  );
  return rows[0];
}

beforeEach(async () => {
  db = await crearPglite(":memory:");
  await migrar(db);
  await sembrarDemo(db, { ahora });
  const { rows } = await db.query<Usuario>("select * from usuarios");
  usuarios = Object.fromEntries(rows.map((u) => [u.rol, u]));
});

describe("Edición en Mesa de entrada", () => {
  it("corrige datos y reemplaza los diagnósticos, sin cambiar persona ni tipo", async () => {
    const gomez = await exp("GÓMEZ");
    const ficha = (await obtenerFicha(db, gomez.id))!;
    const p = ficha.persona;
    const datos: NuevaDenunciaEntrada = {
      tipo: "EP",
      cuil: p.cuil,
      dni: p.dni,
      apellido: p.apellido,
      nombres: p.nombres,
      fecha_nacimiento: p.fecha_nacimiento ?? "",
      sexo: p.sexo ?? "",
      telefono: "385 555-9999",
      email: p.email ?? "",
      domicilio: p.domicilio ?? "",
      localidad_id: p.localidad_id,
      canal: "digital",
      denunciante_tipo: "trabajador",
      denunciante_nombre: "",
      denunciante_email: "",
      denunciante_telefono: "",
      reparticion: gomez.reparticion,
      domicilio_laboral: gomez.domicilio_laboral ?? "",
      localidad_laboral_id: gomez.localidad_laboral_id,
      puesto: gomez.puesto ?? "",
      ciuo: gomez.ciuo ?? "",
      tareas: gomez.tareas ?? "",
      antiguedad_empresa: gomez.antiguedad_empresa ?? "",
      antiguedad_area: gomez.antiguedad_area ?? "",
      desvinculado: false,
      fecha_ocurrencia: gomez.fecha_ocurrencia ?? "",
      hora_ocurrencia: "",
      lugar_ocurrencia: "",
      localidad_ocurrencia_id: null,
      descripcion: "",
      forma_accidente: "",
      agente_material: "",
      trayecto: "",
      pluriempleo: false,
      cuits_pluriempleo: [],
      obligada_pago: null,
      exposicion_desde: gomez.exposicion_desde ?? "",
      exposicion_hasta: "",
      diagnosticos: [{ cie10: "J383", agente_causante: "80006" }],
      documentos: [],
      origen_id: null,
      es_intercurrencia: false,
      confirmo_hecho_distinto: true,
    };
    const otroDni = String(Number(p.dni) + 1);
    await expect(editarDenuncia(ctx("mesa_entrada"), { expediente_id: gomez.id, datos: { ...datos, dni: otroDni } })).rejects.toMatchObject(
      { detalles: expect.arrayContaining([expect.stringMatching(/DNI no coincide con el CUIL/)]) },
    );
    await editarDenuncia(ctx("mesa_entrada"), { expediente_id: gomez.id, datos });
    const despues = (await obtenerFicha(db, gomez.id))!;
    expect(despues.persona.telefono).toBe("385 555-9999");
    expect(despues.diagnosticos.map((d) => d.cie10)).toEqual(["J383"]);
    await expect(
      editarDenuncia(ctx("mesa_entrada"), { expediente_id: gomez.id, datos: { ...datos, tipo: "AT", descripcion: "x", fecha_ocurrencia: hoy } }),
    ).rejects.toThrow(/tipo/);
    await expect(editarDenuncia(ctx("medico"), { expediente_id: gomez.id, datos })).rejects.toThrow(/no puede/);
  });
});

describe("Área médica", () => {
  it("reencuadra un accidente como EP e informa a la SRT", async () => {
    const medina = await exp("MEDINA");
    const r = await reencuadrarComoEP(ctx("medico"), {
      expediente_id: medina.id,
      agente_causante: "80005",
      exposicion_desde: "2010-01-01",
      observacion: "Lesión crónica por gestos repetitivos.",
    });
    const ficha = (await obtenerFicha(db, medina.id))!;
    expect(ficha.expediente.tipo).toBe("EP");
    expect(ficha.expediente.reencuadrado_en).not.toBeNull();
    expect(ficha.diagnosticos[0].agente_causante).toBe("80005");
    expect(r.informado).toBe(ficha.expediente.fodep_numero !== null);
  });
});

describe("Área legal", () => {
  it("la prórroga se usa una sola vez", async () => {
    const coronel = await exp("CORONEL");
    const antes = coronel.legal_vence!;
    await solicitarProrroga(ctx("legal"), { expediente_id: coronel.id });
    const despues = (await obtenerFicha(db, coronel.id))!.expediente;
    expect(despues.legal_vence! > antes).toBe(true);
    await expect(solicitarProrroga(ctx("legal"), { expediente_id: coronel.id })).rejects.toThrow(/ya se usó/);
  });

  it("el rechazo por ausencia de exposición deja el CYMAT entre los documentos", async () => {
    const rojas = await exp("ROJAS");
    const ficha = (await obtenerFicha(db, rojas.id))!;
    await expect(
      decidirDiagnostico(ctx("legal"), {
        diagnostico_id: ficha.diagnosticos[0].id,
        decision: "rechazado",
        motivo_rechazo: "E",
        fundamento: "Sin exposición",
        estudios: "",
        cymat_adjunto: false,
      }),
    ).rejects.toMatchObject({ detalles: expect.arrayContaining([expect.stringMatching(/CYMAT/)]) });
    await decidirDiagnostico(ctx("legal"), {
      diagnostico_id: ficha.diagnosticos[0].id,
      decision: "rechazado",
      motivo_rechazo: "E",
      fundamento: "Sin exposición",
      estudios: "",
      cymat_adjunto: true,
    });
    const despues = (await obtenerFicha(db, rojas.id))!;
    expect(despues.documentos.some((d) => d.tipo === "cymat")).toBe(true);
  });

  it("registra la presentación ante la Comisión Médica de un caso sin baja", async () => {
    const albarracin = await exp("ALBARRACÍN");
    await registrarPresentacionCM(ctx("legal"), { expediente_id: albarracin.id, fecha: hoy });
    expect((await obtenerFicha(db, albarracin.id))!.expediente.estado).toBe("cerrado");
  });
});

describe("Seguimiento", () => {
  it("la intercurrencia es un siniestro nuevo vinculado que va al área médica", async () => {
    const luna = await exp("LUNA");
    const r = await registrarIntercurrencia(ctx("seguimiento"), {
      expediente_id: luna.id,
      fecha_ocurrencia: hoy,
      descripcion: "Se golpeó la mano en la sesión de kinesiología.",
      cie10: "S600",
    });
    const nueva = (await obtenerFicha(db, r.id))!;
    expect(nueva.expediente.es_intercurrencia).toBe(true);
    expect(nueva.expediente.origen_id).toBe(luna.id);
    expect(nueva.expediente.estado).toBe("evaluacion_medica");
    await expect(
      registrarIntercurrencia(ctx("seguimiento"), {
        expediente_id: luna.id,
        fecha_ocurrencia: "2020-01-01",
        descripcion: "Antes de la licencia",
        cie10: "",
      }),
    ).rejects.toThrow(/durante la licencia/);
  });

  it("el alta cierra la licencia con la fecha de cese de la ILT (RF-21)", async () => {
    const luna = await exp("LUNA");
    await expect(darAlta(ctx("seguimiento"), { expediente_id: luna.id, fecha_alta: sumarDias(hoy, 1), motivo_cese_ilt: "L" })).rejects.toThrow(
      /posterior a hoy/,
    );
    await darAlta(ctx("seguimiento"), { expediente_id: luna.id, fecha_alta: hoy, motivo_cese_ilt: "L" });
    const e = (await obtenerFicha(db, luna.id))!.expediente;
    expect(e.estado).toBe("alta");
    expect(e.fecha_fin_ilt).toBe(hoy);
    expect(e.proxima_presentacion).toBeNull();
  });

  it("el motivo T (transcurso de un año) exige haber llegado al tope de 365 días (RF-22)", async () => {
    const luna = await exp("LUNA");
    await expect(darAlta(ctx("seguimiento"), { expediente_id: luna.id, fecha_alta: hoy, motivo_cese_ilt: "T" })).rejects.toThrow(
      /corresponde solo cuando se cumplió el tope/,
    );
    expect((await obtenerFicha(db, luna.id))!.expediente.estado).toBe(luna.estado);

    // Con el siniestro de hace más de un año, el tope ya pasó: T es el motivo que corresponde.
    const siniestro = sumarDias(hoy, -400);
    await db.query("update expedientes set fecha_ocurrencia = $2, fecha_inicio_inasistencia = $2 where id = $1", [luna.id, siniestro]);
    const tope = sumarDias(siniestro, 365);
    await expect(
      darAlta(ctx("seguimiento"), { expediente_id: luna.id, fecha_alta: sumarDias(tope, -1), motivo_cese_ilt: "T" }),
    ).rejects.toThrow(/tope/);
    await darAlta(ctx("seguimiento"), { expediente_id: luna.id, fecha_alta: tope, motivo_cese_ilt: "T" });
    const e = (await obtenerFicha(db, luna.id))!.expediente;
    expect(e.estado).toBe("alta");
    expect(e.motivo_cese_ilt).toBe("T");
    expect(e.fecha_fin_ilt).toBe(tope);
  });
});

describe("Búsqueda unificada", () => {
  it("encuentra por número del sistema actual y trae todos los siniestros de la persona", async () => {
    const personas = await buscarIncidentes(db, "at-2026-0611");
    expect(personas).toHaveLength(1);
    expect(personas[0].incidentes.some((i) => i.origen === "actual" && i.numero === "AT-2026-0611")).toBe(true);
    // JUÁREZ tiene siniestros en los dos sistemas: con uno del sistema actual aparecen todos.
    const juarez = await buscarIncidentes(db, "AT 2021 0233");
    expect(juarez).toHaveLength(1);
    expect(juarez[0].incidentes.some((i) => i.origen === "nuevo")).toBe(true);
    expect(juarez[0].incidentes.filter((i) => i.origen === "actual")).toHaveLength(2);
  });

  it("compara apellido y nombre palabra por palabra, en cualquier orden", async () => {
    const base = await buscarIncidentes(db, "juarez");
    const total = base.flatMap((p) => p.incidentes).length;
    expect(total).toBeGreaterThan(1);
    for (const q of ["JUAREZ CARLOS", "carlos juarez", "Juárez, Carlos"]) {
      const r = await buscarIncidentes(db, q);
      expect(r.flatMap((p) => p.incidentes)).toHaveLength(total);
    }
  });
});

describe("Reingreso", () => {
  it("mantiene el número, suma el sufijo y copia los diagnósticos aceptados", async () => {
    const figueroa = await exp("FIGUEROA");
    const r = await crearReingreso(ctx("mesa_entrada"), {
      origen_id: figueroa.id,
      fecha_ocurrencia: hoy,
      descripcion: "Dolor en el codo operado.",
    });
    expect(r.numero).toBe(figueroa.numero.replace(/-00$/, "-01"));
    const ficha = (await obtenerFicha(db, r.id))!;
    expect(ficha.expediente.es_reingreso).toBe(true);
    expect(ficha.expediente.estado).toBe("recepcion");
    expect(ficha.diagnosticos).toHaveLength(1);
    await expect(
      crearReingreso(ctx("mesa_entrada"), { origen_id: (await exp("LUNA")).id, fecha_ocurrencia: hoy, descripcion: "x" }),
    ).rejects.toThrow(/no puede/);
  });
});

describe("Desistimiento", () => {
  it("Mesa de entrada puede desistir una EP e informarla a la SRT", async () => {
    const ledesma = await exp("LEDESMA");
    await desistir(ctx("mesa_entrada"), { expediente_id: ledesma.id, motivo: "relacion_no_corroborada", observacion: "" });
    const ficha = (await obtenerFicha(db, ledesma.id))!;
    expect(ficha.expediente.estado).toBe("desistido");
    expect(ficha.comunicaciones.map((c) => c.operacion)).toEqual(
      expect.arrayContaining(["AltaDenunciaEP", "CambiarEstado", "Notificación al trabajador"]),
    );
  });
});

// ---------------------------------------------------------------------------
// Reglas de la revisión: examen de detección, lotes, reencuadre, citaciones
// ---------------------------------------------------------------------------
const evaluacionAccidente = (diagnostico_id: number, codigo_examen = "") => ({
  diagnostico_id,
  cie10_adecuado: "",
  patologia_constatada: true,
  en_listado: null,
  fecha_diagnostico: hoy,
  codigo_examen,
  observacion_medica: "",
  lesiones: ["23"],
  zonas: ["044"],
});

async function primerDiagnostico(expedienteId: number): Promise<number> {
  const { rows } = await db.query<{ id: number }>("select id from diagnosticos where expediente_id = $1 order by orden limit 1", [
    expedienteId,
  ]);
  return rows[0].id;
}

describe("Sistema de Intercambio", () => {
  it("en un accidente no acepta exámenes de detección que exigen el ID_FODEP", async () => {
    const medina = await exp("MEDINA");
    const dx = await primerDiagnostico(medina.id);
    await expect(evaluarDiagnostico(ctx("medico"), evaluacionAccidente(dx, "H"))).rejects.toThrow(/examen de detección/);
    await evaluarDiagnostico(ctx("medico"), evaluacionAccidente(dx, "R"));
  });

  it("un diagnóstico que el archivo no admite queda afuera sin frenar el lote", async () => {
    const medina = await exp("MEDINA");
    const dxMedina = await primerDiagnostico(medina.id);
    await evaluarDiagnostico(ctx("medico"), evaluacionAccidente(dxMedina));
    // Dato inválido cargado antes de la validación: código H sin formulario FODEP
    await db.query("update diagnosticos set codigo_examen = 'H' where id = $1", [dxMedina]);
    const vera = await exp("VERA");
    await evaluarDiagnostico(ctx("medico"), {
      ...evaluacionAccidente(await primerDiagnostico(vera.id), "F"),
      en_listado: true,
      lesiones: [],
      zonas: ["070"],
    });
    const lote = await generarLoteIntercambio(ctx("admin"));
    expect(lote.omitidos.map((o) => o.numero)).toEqual([medina.numero]);
    expect(lote.archivos.find((a) => a.extension === "AD")!.registros).toBe(1);
    const { rows } = await db.query<{ intercambio_estado: string }>("select intercambio_estado from diagnosticos where id = $1", [
      dxMedina,
    ]);
    expect(rows[0].intercambio_estado).toBe("pendiente");
  });

  it("un diagnóstico informado que queda desistido viaja como baja (B)", async () => {
    const medina = await exp("MEDINA");
    await evaluarDiagnostico(ctx("medico"), evaluacionAccidente(await primerDiagnostico(medina.id)));
    await generarLoteIntercambio(ctx("admin"));
    await desistir(ctx("medico"), { expediente_id: medina.id, motivo: "inconsistencia_diagnostico", observacion: "" });
    const lote = await generarLoteIntercambio(ctx("admin"));
    const lineas = lote.archivos.find((a) => a.extension === "AD")!.contenido.split("\r\n").filter(Boolean);
    expect(lineas).toHaveLength(1);
    expect(lineas[0][40]).toBe("B"); // posición 41: tipo de operación
  });
});

describe("Reencuadre como EP", () => {
  it("es todo o nada: sin diagnóstico o con datos que la SRT rechaza, sigue como accidente", async () => {
    const oliva = await exp("OLIVA");
    await pasarAMedica(ctx("mesa_entrada"), { expediente_id: oliva.id });
    const datos = { expediente_id: oliva.id, agente_causante: "80005", exposicion_desde: "2015-01-01", observacion: "" };
    await expect(reencuadrarComoEP(ctx("medico"), datos)).rejects.toThrow(/diagnóstico/);
    await agregarDiagnostico(ctx("medico"), { expediente_id: oliva.id, cie10: "S525", agente_causante: "" });
    await db.query("update personas set telefono = null where id = $1", [oliva.persona_id]);
    await expect(reencuadrarComoEP(ctx("medico"), datos)).rejects.toMatchObject({
      detalles: expect.arrayContaining([expect.stringMatching(/TelefonoTrabajador/)]),
    });
    expect((await exp("OLIVA")).tipo).toBe("AT");
    await reencuadrarComoEP(ctx("medico"), { ...datos, telefono: "385 555-0120" });
    const despues = (await obtenerFicha(db, oliva.id))!;
    expect(despues.expediente.tipo).toBe("EP");
    expect(despues.expediente.fodep_numero).not.toBeNull();
    expect(despues.persona.telefono).toBe("385 555-0120");
  });

  it("agregar un diagnóstico a una EP informada lo suma al FODEP y lo notifica", async () => {
    const vera = await exp("VERA");
    await agregarDiagnostico(ctx("medico"), { expediente_id: vera.id, cie10: "M545", agente_causante: "80011" });
    const ficha = (await obtenerFicha(db, vera.id))!;
    const operaciones = ficha.comunicaciones.map((c) => c.operacion);
    expect(operaciones.filter((o) => o === "AltaDiagnosticosEP")).toHaveLength(2);
    expect(ficha.comunicaciones.some((c) => c.canal === "ventanilla")).toBe(true);
  });
});

describe("Citaciones", () => {
  it("la inasistencia se registra recién cuando pasó la fecha de la citación", async () => {
    const juarez = await exp("JUÁREZ");
    const { rows } = await db.query<{ id: number }>("select id from citaciones where expediente_id = $1 and estado = 'programada'", [
      juarez.id,
    ]);
    await expect(registrarAsistencia(ctx("medico"), { citacion_id: rows[0].id, asistio: false })).rejects.toThrow(/después/);
  });

  it("con una inasistencia sin reiterar, la próxima citación es su reiteración", async () => {
    const vera = await exp("VERA");
    const citacion = {
      expediente_id: vera.id,
      fecha: sumarDias(hoy, 7),
      hora: "10:00",
      motivo: "examen" as const,
      lugar: "UERT",
      detalle: "",
      reiteracion_de: null,
    };
    await expect(programarCitacion(ctx("medico"), citacion)).rejects.toThrow(/reiteración/);
    const { rows } = await db.query<{ id: number }>("select id from citaciones where expediente_id = $1 and estado = 'no_asistio'", [
      vera.id,
    ]);
    await programarCitacion(ctx("medico"), { ...citacion, reiteracion_de: rows[0].id });
  });
});

describe("Intercurrencia cargada en Mesa de entrada", () => {
  it("pasa directo al Área médica, como la que registra Seguimiento", async () => {
    const salvatierra = await exp("SALVATIERRA");
    const p = (await obtenerFicha(db, salvatierra.id))!.persona;
    const r = await crearDenuncia(ctx("mesa_entrada"), {
      tipo: "AT",
      cuil: p.cuil,
      dni: p.dni,
      apellido: p.apellido,
      nombres: p.nombres,
      fecha_nacimiento: "",
      sexo: "",
      telefono: "",
      email: "",
      domicilio: "",
      localidad_id: null,
      canal: "presencial",
      denunciante_tipo: "trabajador",
      denunciante_nombre: "",
      denunciante_email: "",
      denunciante_telefono: "",
      reparticion: salvatierra.reparticion,
      domicilio_laboral: "",
      localidad_laboral_id: null,
      puesto: "",
      ciuo: "",
      tareas: "",
      antiguedad_empresa: "",
      antiguedad_area: "",
      desvinculado: false,
      fecha_ocurrencia: hoy,
      hora_ocurrencia: "",
      lugar_ocurrencia: "",
      localidad_ocurrencia_id: null,
      descripcion: "Se cayó al salir de la sesión de kinesiología.",
      forma_accidente: "",
      agente_material: "",
      trayecto: "",
      pluriempleo: false,
      cuits_pluriempleo: [],
      obligada_pago: null,
      exposicion_desde: "",
      exposicion_hasta: "",
      diagnosticos: [],
      documentos: [],
      origen_id: salvatierra.id,
      es_intercurrencia: true,
      confirmo_hecho_distinto: false,
    });
    const nueva = (await obtenerFicha(db, r.id))!.expediente;
    expect(nueva.estado).toBe("evaluacion_medica");
    expect(nueva.es_intercurrencia).toBe(true);
    expect(nueva.relacion_laboral_verificada).toBe(true);
  });
});
