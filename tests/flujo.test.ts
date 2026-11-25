/**
 * Flujos completos sobre una base PGlite en memoria con los datos de la demo.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { crearPglite, type Db } from "@/lib/db";
import { migrar } from "@/lib/db/migrar";
import { sembrarDemo } from "@/lib/demo/sembrar";
import { listarExpedientes, obtenerFicha, plazosDe } from "@/lib/datos/expedientes";
import { buscarIncidentes } from "@/lib/datos/busqueda";
import { buscarEnCatalogo } from "@/lib/datos/catalogos";
import {
  adjuntarDocumento,
  cerrarDictamen,
  crearDenuncia,
  decidirDiagnostico,
  definirBaja,
  ErrorNegocio,
  evaluarDiagnostico,
  generarLoteIntercambio,
  pasarALegal,
  pasarAMedica,
  programarCitacion,
  registrarAsistencia,
  verificarRelacionLaboral,
  vistaPreviaIntercambio,
  type Ctx,
} from "@/lib/operaciones";
import { cargarFeriados } from "@/lib/operaciones/contexto";
import type { Expediente, Usuario } from "@/lib/tipos";
import { fechaDe, sumarDias } from "@/lib/dominio/fechas";

let db: Db;
let usuarios: Record<string, Usuario>;
const ahora = new Date();
const ctx = (rol: string, cuando: Date = new Date()): Ctx => ({ db, usuario: usuarios[rol], ahora: cuando });

async function expedienteDe(apellido: string, estado?: string): Promise<Expediente> {
  const { rows } = await db.query<Expediente>(
    `select e.* from expedientes e join personas p on p.id = e.persona_id
      where p.apellido = $1 ${estado ? "and e.estado = $2" : ""} order by e.id desc limit 1`,
    estado ? [apellido, estado] : [apellido],
  );
  return rows[0];
}

beforeAll(async () => {
  db = await crearPglite(":memory:");
  await migrar(db);
  await sembrarDemo(db, { ahora });
  const { rows } = await db.query<Usuario>("select * from usuarios");
  usuarios = Object.fromEntries(rows.map((u) => [u.rol, u]));
});

describe("Datos de la demo", () => {
  it("cubren todos los estados del circuito", async () => {
    const { rows } = await db.query<{ estado: string; n: number }>("select estado, count(*)::int as n from expedientes group by estado");
    const por = Object.fromEntries(rows.map((r) => [r.estado, r.n]));
    expect(por).toMatchObject({
      recepcion: 3,
      evaluacion_medica: 5,
      dictamen_legal: 3,
      licencia_activa: 4,
      sin_baja: 1,
      alta: 2,
      rechazado: 1,
      desistido: 1,
    });
  });

  it("dejan los plazos legales donde la demo los necesita", async () => {
    const feriados = await cargarFeriados(db);
    const coronel = await expedienteDe("CORONEL");
    const rojas = await expedienteDe("ROJAS");
    const [pc] = plazosDe(coronel, ahora, feriados);
    const [pr] = plazosDe(rojas, ahora, feriados);
    expect(pc.clave).toBe("legal");
    expect(pc.dias).toBe(2);
    expect(pr.nivel).toBe("vencido");
  });

  it("numeran el reingreso con el mismo número y sufijo 01", async () => {
    const { rows } = await db.query<{ numero: string; es_reingreso: boolean }>(
      "select e.numero, e.es_reingreso from expedientes e join personas p on p.id = e.persona_id where p.apellido = 'TOLEDO' order by e.sufijo",
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].numero.slice(0, 12)).toBe(rows[0].numero.slice(0, 12));
    expect(rows[1].numero.endsWith("-01")).toBe(true);
    expect(rows[1].es_reingreso).toBe(true);
  });

  it("registran la comunicación con la SRT de las EP", async () => {
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from srt_comunicaciones where canal = 'ws_fodep' and ok");
    expect(rows[0].n).toBeGreaterThan(5);
    const { rows: lotes } = await db.query<{ n: number }>("select count(*)::int as n from intercambio_lotes");
    expect(lotes[0].n).toBe(2);
  });

  it("informan a la SRT el desistimiento por falta de cobertura (estado FODEP 2)", async () => {
    const diaz = await expedienteDe("DÍAZ");
    expect(diaz.estado).toBe("desistido");
    expect(diaz.fodep_estado).toBe(2);
    const ficha = await obtenerFicha(db, diaz.id);
    expect(ficha!.comunicaciones.filter((c) => !c.ok)).toHaveLength(0);
  });
});

describe("Mesa de entrada", () => {
  it("no pasa al área médica sin verificar la cobertura ni con documentación faltante", async () => {
    const gomez = await expedienteDe("GÓMEZ");
    await expect(pasarAMedica(ctx("mesa_entrada"), { expediente_id: gomez.id })).rejects.toThrow(/relación laboral/);
    await verificarRelacionLaboral(ctx("mesa_entrada"), { expediente_id: gomez.id, verificada: true, motivo: null, observacion: "" });
    await expect(pasarAMedica(ctx("mesa_entrada"), { expediente_id: gomez.id })).rejects.toThrow(ErrorNegocio);
    await adjuntarDocumento(ctx("mesa_entrada"), {
      expediente_id: gomez.id,
      tipo: "antecedentes_medicos",
      nombre_archivo: "antecedentes.pdf",
      tamano_bytes: 1000,
      observacion: "",
    });
    const r = await pasarAMedica(ctx("mesa_entrada"), { expediente_id: gomez.id });
    expect(r.ok).toBe(true);
    const ficha = await obtenerFicha(db, gomez.id);
    expect(ficha!.expediente.estado).toBe("evaluacion_medica");
    expect(ficha!.expediente.fodep_numero).toBeTruthy();
    expect(ficha!.comunicaciones.some((c) => c.operacion === "AltaDenunciaEP" && c.ok)).toBe(true);
  });

  it("advierte siniestros abiertos de la persona (también del sistema actual)", async () => {
    const paz = await db.query<{ cuil: string }>("select cuil from legado_siniestros where abierto limit 1");
    const base = {
      tipo: "AT" as const,
      cuil: paz.rows[0].cuil,
      dni: paz.rows[0].cuil.slice(2, 10),
      apellido: "PAZ",
      nombres: "Rosa Elena",
      fecha_nacimiento: "",
      sexo: "F" as const,
      telefono: "",
      email: "",
      domicilio: "",
      localidad_id: null,
      canal: "presencial" as const,
      denunciante_tipo: "trabajador" as const,
      denunciante_nombre: "",
      denunciante_email: "",
      denunciante_telefono: "",
      reparticion: "Ministerio de Desarrollo Social",
      domicilio_laboral: "",
      localidad_laboral_id: null,
      puesto: "",
      ciuo: "",
      tareas: "",
      antiguedad_empresa: "",
      antiguedad_area: "",
      desvinculado: false,
      fecha_ocurrencia: fechaDe(ahora),
      hora_ocurrencia: "",
      lugar_ocurrencia: "",
      localidad_ocurrencia_id: null,
      descripcion: "Se cortó la mano con un cuchillo.",
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
      origen_id: null,
      es_intercurrencia: false,
      confirmo_hecho_distinto: false,
    };
    await expect(crearDenuncia(ctx("mesa_entrada"), base)).rejects.toThrow(/siniestros abiertos/);
    const creada = await crearDenuncia(ctx("mesa_entrada"), { ...base, confirmo_hecho_distinto: true });
    expect(creada.numero).toMatch(/^\d{4}-\d{6}-00$/);
  });

  it("solo Mesa de entrada carga denuncias", async () => {
    await expect(crearDenuncia(ctx("medico"), {} as never)).rejects.toThrow(/no puede/);
  });
});

describe("Área médica", () => {
  it("exige 72 h de anticipación para citar", async () => {
    const vera = await expedienteDe("VERA");
    await expect(
      programarCitacion(ctx("medico"), {
        expediente_id: vera.id,
        fecha: fechaDe(ahora),
        hora: "23:59",
        motivo: "examen",
        lugar: "UERT",
        detalle: "",
        reiteracion_de: null,
      }),
    ).rejects.toThrow(/72 horas/);
  });

  it("la segunda inasistencia hace caducar el trámite (Desistido, no rechazo)", async () => {
    const bravo = await expedienteDe("BRAVO");
    const { rows } = await db.query<{ id: number }>(
      "select id from citaciones where expediente_id = $1 and estado = 'programada'",
      [bravo.id],
    );
    const r = await registrarAsistencia(ctx("medico"), { citacion_id: rows[0].id, asistio: false });
    expect(r.caducidad).toBe(true);
    const ficha = await obtenerFicha(db, bravo.id);
    expect(ficha!.expediente.estado).toBe("desistido");
    expect(ficha!.expediente.desistido_motivo).toBe("incomparecencia");
    expect(ficha!.diagnosticos.every((d) => d.estado === "desistido")).toBe(true);
    expect(ficha!.comunicaciones.some((c) => c.operacion === "CambiarEstado")).toBe(true);
  });

  it("evalúa, define la baja y pasa al área legal con 10 días hábiles", async () => {
    const medina = await expedienteDe("MEDINA");
    await expect(pasarALegal(ctx("medico"), { expediente_id: medina.id })).rejects.toThrow(/Faltan evaluar/);
    const ficha = await obtenerFicha(db, medina.id);
    await evaluarDiagnostico(ctx("medico"), {
      diagnostico_id: ficha!.diagnosticos[0].id,
      cie10_adecuado: "",
      patologia_constatada: true,
      en_listado: null,
      fecha_diagnostico: fechaDe(ahora),
      codigo_examen: "",
      observacion_medica: "",
      lesiones: ["23"],
      zonas: ["044"],
    });
    await expect(
      definirBaja(ctx("medico"), {
        expediente_id: medina.id,
        con_baja: true,
        fecha_inicio_inasistencia: ficha!.expediente.fecha_ocurrencia!,
        estres_postraumatico: false,
      }),
    ).rejects.toThrow(/día siguiente/);
    await definirBaja(ctx("medico"), {
      expediente_id: medina.id,
      con_baja: true,
      fecha_inicio_inasistencia: sumarDias(ficha!.expediente.fecha_ocurrencia!, 1),
      estres_postraumatico: false,
    });
    await pasarALegal(ctx("medico"), { expediente_id: medina.id });
    const despues = await obtenerFicha(db, medina.id);
    expect(despues!.expediente.estado).toBe("dictamen_legal");
    expect(despues!.expediente.legal_vence! > fechaDe(ahora)).toBe(true);
    const vista = await vistaPreviaIntercambio(db, medina.id);
    expect(vista.archivos.find((a) => a.extension === "AL")!.registros).toBe(1);
  });
});

describe("Área legal", () => {
  it("rechaza por diagnóstico con motivos de EP y acepta el resto", async () => {
    const rojas = await expedienteDe("ROJAS");
    const ficha = await obtenerFicha(db, rojas.id);
    const [tunel, quervain] = ficha!.diagnosticos;
    await expect(
      decidirDiagnostico(ctx("legal"), {
        diagnostico_id: quervain.id,
        decision: "rechazado",
        motivo_rechazo: "R",
        fundamento: "x",
        estudios: "",
        cymat_adjunto: false,
      }),
    ).rejects.toThrow(/no corresponde/);
    await decidirDiagnostico(ctx("legal"), {
      diagnostico_id: quervain.id,
      decision: "rechazado",
      motivo_rechazo: "L",
      fundamento: "La tenosinovitis de De Quervain no figura en el Listado para el agente invocado.",
      estudios: "",
      cymat_adjunto: false,
    });
    await expect(cerrarDictamen(ctx("legal"), { expediente_id: rojas.id })).rejects.toThrow(/Falta decidir/);
    await decidirDiagnostico(ctx("legal"), {
      diagnostico_id: tunel.id,
      decision: "aceptado",
      motivo_rechazo: "",
      fundamento: "",
      estudios: "",
      cymat_adjunto: false,
    });
    await cerrarDictamen(ctx("legal"), { expediente_id: rojas.id });
    const despues = await obtenerFicha(db, rojas.id);
    expect(despues!.expediente.estado).toBe("licencia_activa");
    expect(despues!.comunicaciones.some((c) => c.canal === "ventanilla")).toBe(true);
    expect(despues!.movimientos.some((m) => m.accion === "notificacion_rechazo")).toBe(true);
  });
});

describe("Sistema de Intercambio y búsquedas", () => {
  it("genera un lote con lo nuevo", async () => {
    const lote = await generarLoteIntercambio(ctx("admin"));
    const ad = lote.archivos.find((a) => a.extension === "AD")!;
    expect(ad.registros).toBeGreaterThan(0);
    // Ojo: las líneas de accidentes terminan en espacios (ID_FODEP vacío): no usar trim()
    for (const linea of ad.contenido.split("\r\n").filter(Boolean)) expect(linea).toHaveLength(65);
    await expect(generarLoteIntercambio(ctx("admin"))).rejects.toThrow(/No hay diagnósticos/);
  });

  it("la búsqueda unificada junta el sistema nuevo y el actual", async () => {
    const r = await buscarIncidentes(db, "juarez");
    expect(r).toHaveLength(1);
    expect(r[0].incidentes.filter((i) => i.origen === "actual")).toHaveLength(2);
    expect(r[0].incidentes.filter((i) => i.origen === "nuevo")).toHaveLength(1);
  });

  it("los combos buscan por código o por palabras sin acentos", async () => {
    expect((await buscarEnCatalogo(db, "cie10", "J382"))[0].codigo).toBe("J382");
    expect((await buscarEnCatalogo(db, "cie10", "tunel carpiano")).map((o) => o.codigo)).toContain("G560");
    expect((await buscarEnCatalogo(db, "localidad", "termas")).length).toBeGreaterThan(0);
  });

  it("lista expedientes por texto", async () => {
    const r = await listarExpedientes(db, { texto: "salvatierra" });
    expect(r.length).toBe(2); // el siniestro y su intercurrencia
  });
});
