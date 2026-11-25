/**
 * Datos de la demo. TODOS FICTICIOS: nombres inventados, DNI de la serie
 * 99.000.xxx (no asignada), emails en el dominio reservado .example.
 *
 * Los expedientes se arman con las mismas operaciones del sistema, con el
 * reloj puesto en fechas pasadas relativas a "hoy". Así cada caso queda en un
 * estado coherente (plazos por vencer, citaciones sin asistencia, licencias,
 * rechazos, desistidos) y la demo siempre se ve "al día" al reiniciarla.
 */
import type { Db } from "@/lib/db";
import { documentosDeRecepcion } from "@/lib/dominio/documentos";
import { esHabil, fechaDe, momentoArgentina, sumarDias, sumarDiasHabiles, type FechaISO } from "@/lib/dominio/fechas";
import { cuilDesdeDni, digitoVerificador } from "@/lib/dominio/validaciones";
import type { Rol, TipoDenuncia } from "@/lib/dominio/constantes";
import type { NuevaDenunciaEntrada } from "@/lib/esquemas";
import {
  cerrarDictamen,
  crearDenuncia,
  crearReingreso,
  darAlta,
  decidirDiagnostico,
  definirBaja,
  evaluarDiagnostico,
  generarLoteIntercambio,
  pasarALegal,
  pasarAMedica,
  programarCitacion,
  registrarAsistencia,
  registrarIntercurrencia,
  registrarPresentacion,
  solicitarProrroga,
  verificarRelacionLaboral,
  type Ctx,
} from "@/lib/operaciones";
import type { Usuario } from "@/lib/tipos";
import { cargarCatalogos, cargarFeriados } from "./catalogos";

// ---------------------------------------------------------------------------
// Usuarios de la demo (uno por rol)
// ---------------------------------------------------------------------------
export const USUARIOS_DEMO: Array<{ nombre: string; rol: Rol; cargo: string; email: string }> = [
  { nombre: "Carla Benítez", rol: "mesa_entrada", cargo: "Mesa de entrada", email: "mesa@uert.example" },
  { nombre: "Dra. Silvina Herrera", rol: "medico", cargo: "Médica auditora", email: "medica@uert.example" },
  { nombre: "Dr. Esteban Maldonado", rol: "legal", cargo: "Asesor legal", email: "legal@uert.example" },
  { nombre: "Valeria Ruiz", rol: "seguimiento", cargo: "Seguimiento de licencias", email: "seguimiento@uert.example" },
  { nombre: "Lic. Laura Ibáñez", rol: "direccion", cargo: "Dirección", email: "direccion@uert.example" },
  { nombre: "Soporte UERT", rol: "admin", cargo: "Administración del sistema", email: "soporte@uert.example" },
];

// ---------------------------------------------------------------------------
// Personas (ficticias)
// ---------------------------------------------------------------------------
const SDE = 3746; // Santiago del Estero (capital)
const LA_BANDA = 12432;
const TERMAS = 3422;

interface PersonaDemo {
  apellido: string;
  nombres: string;
  sexo: "F" | "M";
  nacimiento: FechaISO;
  dni: string;
  localidad: number;
  domicilio: string;
  reparticion: string;
  domicilioLaboral: string;
  localidadLaboral: number;
  puesto: string;
  ciuo: string;
  tareas: string;
  antEmpresa: string;
  antArea: string;
}

const P: Record<string, PersonaDemo> = {
  gomez: {
    apellido: "GÓMEZ", nombres: "María Luz", sexo: "F", nacimiento: "1979-03-14", dni: "99000101", localidad: SDE,
    domicilio: "Pasaje Los Tilos 245", reparticion: "Ministerio de Educación · Escuela N° 412",
    domicilioLaboral: "Av. Belgrano Sur 1450", localidadLaboral: SDE, puesto: "Docente de nivel primario", ciuo: "3310",
    tareas: "Dictado de clases frente a alumnos en dos turnos, 30 horas semanales.", antEmpresa: "14 años", antArea: "9 años",
  },
  juarez: {
    apellido: "JUÁREZ", nombres: "Carlos Alberto", sexo: "M", nacimiento: "1971-08-02", dni: "99000102", localidad: LA_BANDA,
    domicilio: "Calle 9 de Julio 812", reparticion: "Dirección de Vialidad Provincial · Taller central",
    domicilioLaboral: "Ruta Nacional 34, km 2", localidadLaboral: LA_BANDA, puesto: "Mecánico de maquinaria vial", ciuo: "7233",
    tareas: "Reparación y prueba de motores de maquinaria vial en taller cerrado.", antEmpresa: "27 años", antArea: "27 años",
  },
  ledesma: {
    apellido: "LEDESMA", nombres: "Jorge Daniel", sexo: "M", nacimiento: "1983-11-20", dni: "99000103", localidad: SDE,
    domicilio: "Barrio Ejército Argentino, Mz. 12 Casa 4", reparticion: "Ministerio de Salud · Hospital Regional · Mantenimiento",
    domicilioLaboral: "Av. Belgrano Sur 2050", localidadLaboral: SDE, puesto: "Operario de mantenimiento edilicio", ciuo: "7137",
    tareas: "Mantenimiento edilicio, traslado de materiales y equipos pesados.", antEmpresa: "11 años", antArea: "6 años",
  },
  coronel: {
    apellido: "CORONEL", nombres: "Ana Belén", sexo: "F", nacimiento: "1990-05-09", dni: "99000104", localidad: LA_BANDA,
    domicilio: "Calle Mitre 330", reparticion: "Ministerio de Salud · Centro de Salud Barrio Norte",
    domicilioLaboral: "Calle Independencia 1100", localidadLaboral: SDE, puesto: "Enfermera", ciuo: "3231",
    tareas: "Atención de pacientes en consultorio y vacunación.", antEmpresa: "5 años", antArea: "3 años",
  },
  salvatierra: {
    apellido: "SALVATIERRA", nombres: "Miguel Ángel", sexo: "M", nacimiento: "1968-01-30", dni: "99000105", localidad: SDE,
    domicilio: "Calle Rivadavia 1520", reparticion: "Policía de la Provincia · Comisaría Seccional 3ra",
    domicilioLaboral: "Calle Salta 640", localidadLaboral: SDE, puesto: "Suboficial de calle", ciuo: "5162",
    tareas: "Patrullaje preventivo y atención de llamados.", antEmpresa: "30 años", antArea: "8 años",
  },
  paz: {
    apellido: "PAZ", nombres: "Rosa Elena", sexo: "F", nacimiento: "1975-06-18", dni: "99000106", localidad: SDE,
    domicilio: "Calle Libertad 77", reparticion: "Ministerio de Desarrollo Social · Comedor provincial",
    domicilioLaboral: "Calle Libertad 1200", localidadLaboral: SDE, puesto: "Cocinera", ciuo: "5122",
    tareas: "Preparación de alimentos para 300 raciones diarias.", antEmpresa: "16 años", antArea: "16 años",
  },
  sosa: {
    apellido: "SOSA", nombres: "Daniela Noemí", sexo: "F", nacimiento: "1986-09-25", dni: "99000107", localidad: TERMAS,
    domicilio: "Calle Sarmiento 455", reparticion: "Ministerio de Educación · Escuela N° 1050",
    domicilioLaboral: "Calle Caseros 300", localidadLaboral: TERMAS, puesto: "Profesora de música", ciuo: "3310",
    tareas: "Clases de música y coro en nivel primario, 25 horas semanales.", antEmpresa: "12 años", antArea: "12 años",
  },
  rojas: {
    apellido: "ROJAS", nombres: "Héctor Fabián", sexo: "M", nacimiento: "1977-12-11", dni: "99000108", localidad: SDE,
    domicilio: "Calle Belgrano 2201", reparticion: "Dirección General de Rentas · Atención al contribuyente",
    domicilioLaboral: "Calle Belgrano Sur 650", localidadLaboral: SDE, puesto: "Administrativo de atención al público", ciuo: "4190",
    tareas: "Carga de datos y digitalización de documentación, 7 horas diarias con teclado y mouse.", antEmpresa: "15 años", antArea: "15 años",
  },
  avila: {
    apellido: "ÁVILA", nombres: "Lucía Fernanda", sexo: "F", nacimiento: "1992-02-14", dni: "99000109", localidad: SDE,
    domicilio: "Calle Avellaneda 910", reparticion: "Ministerio de Salud · Hospital de Niños · Enfermería",
    domicilioLaboral: "Av. Roca 1580", localidadLaboral: SDE, puesto: "Enfermera de sala", ciuo: "3231",
    tareas: "Atención de pacientes internados y desinfección de material y superficies.", antEmpresa: "10 años", antArea: "7 años",
  },
  medina: {
    apellido: "MEDINA", nombres: "Ramón Alberto", sexo: "M", nacimiento: "1965-04-03", dni: "99000110", localidad: SDE,
    domicilio: "Barrio Smata, Calle 3 N° 120", reparticion: "Dirección de Arquitectura · Inspección de obras",
    domicilioLaboral: "Calle 24 de Septiembre 420", localidadLaboral: SDE, puesto: "Ayudante de obra", ciuo: "9313",
    tareas: "Tareas de refacción en edificios escolares.", antEmpresa: "22 años", antArea: "22 años",
  },
  carrizo: {
    apellido: "CARRIZO", nombres: "Silvia Graciela", sexo: "F", nacimiento: "1980-10-10", dni: "99000111", localidad: SDE,
    domicilio: "Calle Tucumán 1375", reparticion: "Ministerio de Educación · Escuela N° 88",
    domicilioLaboral: "Calle Jujuy 250", localidadLaboral: SDE, puesto: "Maestra de grado", ciuo: "3310",
    tareas: "Dictado de clases en jornada completa, 7 horas diarias frente a alumnos.", antEmpresa: "22 años", antArea: "18 años",
  },
  luna: {
    apellido: "LUNA", nombres: "Oscar Rubén", sexo: "M", nacimiento: "1974-07-07", dni: "99000112", localidad: SDE,
    domicilio: "Barrio Siglo XX, Mz. 4 Lote 9", reparticion: "Policía de la Provincia · Comisaría Seccional 1ra",
    domicilioLaboral: "Av. Belgrano Norte 300", localidadLaboral: SDE, puesto: "Cabo primero", ciuo: "5162",
    tareas: "Guardia de comisaría y atención al público.", antEmpresa: "24 años", antArea: "5 años",
  },
  figueroa: {
    apellido: "FIGUEROA", nombres: "Patricia Inés", sexo: "F", nacimiento: "1969-12-01", dni: "99000113", localidad: SDE,
    domicilio: "Calle Catamarca 590", reparticion: "Ministerio de Salud · Hospital Regional · Cocina",
    domicilioLaboral: "Av. Belgrano Sur 2050", localidadLaboral: SDE, puesto: "Cocinera", ciuo: "5122",
    tareas: "Preparación de dietas hospitalarias.", antEmpresa: "19 años", antArea: "12 años",
  },
  diaz: {
    apellido: "DÍAZ", nombres: "Gustavo Javier", sexo: "M", nacimiento: "1981-03-22", dni: "99000114", localidad: LA_BANDA,
    domicilio: "Calle Besares 1010", reparticion: "Dirección de Vialidad Provincial · Planta asfáltica",
    domicilioLaboral: "Ruta Nacional 34, km 5", localidadLaboral: LA_BANDA, puesto: "Operador de planta asfáltica", ciuo: "7233",
    tareas: "Operación y control de la planta asfáltica.", antEmpresa: "4 años", antArea: "4 años",
  },
  albarracin: {
    apellido: "ALBARRACÍN", nombres: "Mónica Beatriz", sexo: "F", nacimiento: "1973-05-29", dni: "99000115", localidad: SDE,
    domicilio: "Calle Alsina 433", reparticion: "Ministerio de Educación · Escuela N° 640",
    domicilioLaboral: "Calle Lavalle 1800", localidadLaboral: SDE, puesto: "Ordenanza", ciuo: "9132",
    tareas: "Limpieza de aulas y patios, traslado de mobiliario escolar.", antEmpresa: "17 años", antArea: "17 años",
  },
  toledo: {
    apellido: "TOLEDO", nombres: "Ricardo Emanuel", sexo: "M", nacimiento: "1988-08-16", dni: "99000116", localidad: SDE,
    domicilio: "Calle Pellegrini 670", reparticion: "Ministerio de Salud · Depósito central de insumos",
    domicilioLaboral: "Calle Moreno Sur 1200", localidadLaboral: SDE, puesto: "Auxiliar de depósito", ciuo: "9313",
    tareas: "Recepción, estiba y despacho de insumos médicos.", antEmpresa: "8 años", antArea: "8 años",
  },
  bravo: {
    apellido: "BRAVO", nombres: "Natalia Soledad", sexo: "F", nacimiento: "1994-01-19", dni: "99000117", localidad: SDE,
    domicilio: "Calle Urquiza 815", reparticion: "Ministerio de Justicia · Registro Civil, oficina central",
    domicilioLaboral: "Calle Libertad 545", localidadLaboral: SDE, puesto: "Empleada administrativa", ciuo: "4190",
    tareas: "Carga de actas y atención de ventanilla con uso intensivo de teclado.", antEmpresa: "7 años", antArea: "7 años",
  },
  vera: {
    apellido: "VERA", nombres: "Julio César", sexo: "M", nacimiento: "1979-06-06", dni: "99000118", localidad: TERMAS,
    domicilio: "Calle San Martín 1203", reparticion: "Dirección de Recursos Hídricos · Cuadrilla de canales",
    domicilioLaboral: "Calle Caseros 900", localidadLaboral: TERMAS, puesto: "Operario de cuadrilla", ciuo: "9313",
    tareas: "Limpieza de canales con pala, carga y descarga de bolsas de 50 kg.", antEmpresa: "25 años", antArea: "25 años",
  },
  acosta: {
    apellido: "ACOSTA", nombres: "Liliana Mabel", sexo: "F", nacimiento: "1970-11-11", dni: "99000119", localidad: SDE,
    domicilio: "Calle Mendoza 377", reparticion: "Ministerio de Salud · Hospital Regional · Archivo",
    domicilioLaboral: "Av. Belgrano Sur 2050", localidadLaboral: SDE, puesto: "Auxiliar administrativa", ciuo: "4190",
    tareas: "Archivo y traslado de historias clínicas.", antEmpresa: "28 años", antArea: "10 años",
  },
  oliva: {
    apellido: "OLIVA", nombres: "Fernando Daniel", sexo: "M", nacimiento: "1985-02-27", dni: "99000120", localidad: SDE,
    domicilio: "Calle Sáenz Peña 1490", reparticion: "Dirección General de Rentas · Mesa de entradas",
    domicilioLaboral: "Calle Belgrano Sur 650", localidadLaboral: SDE, puesto: "Ordenanza", ciuo: "9132",
    tareas: "Traslado de expedientes entre oficinas.", antEmpresa: "9 años", antArea: "9 años",
  },
};

function cuil(p: PersonaDemo): string {
  return cuilDesdeDni(p.dni, p.sexo);
}

function slug(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "");
}

function documentos(tipo: TipoDenuncia, p: PersonaDemo, excluir: string[] = [], sumar: string[] = []) {
  const claves = documentosDeRecepcion(tipo)
    .filter((d) => d.exigencia === "obligatorio")
    .map((d) => d.clave)
    .filter((c) => !excluir.includes(c))
    .concat(sumar);
  return claves.map((clave, i) => ({
    tipo: clave,
    nombre_archivo: `${clave}_${slug(p.apellido)}.pdf`,
    tamano_bytes: 180_000 + ((i * 37_123 + p.dni.length * 9_871) % 2_400_000),
  }));
}

function denuncia(tipo: TipoDenuncia, p: PersonaDemo, extra: Partial<NuevaDenunciaEntrada>): NuevaDenunciaEntrada {
  return {
    tipo,
    cuil: cuil(p),
    dni: p.dni,
    apellido: p.apellido,
    nombres: p.nombres,
    fecha_nacimiento: p.nacimiento,
    sexo: p.sexo,
    telefono: `385 555-${p.dni.slice(-4)}`,
    email: `${slug(p.nombres.split(" ")[0]).toLowerCase()}.${slug(p.apellido).toLowerCase()}@correo.example`,
    domicilio: p.domicilio,
    localidad_id: p.localidad,
    canal: "presencial",
    denunciante_tipo: "trabajador",
    denunciante_nombre: "",
    denunciante_email: "",
    denunciante_telefono: "",
    reparticion: p.reparticion,
    domicilio_laboral: p.domicilioLaboral,
    localidad_laboral_id: p.localidadLaboral,
    puesto: p.puesto,
    ciuo: p.ciuo,
    tareas: p.tareas,
    antiguedad_empresa: p.antEmpresa,
    antiguedad_area: p.antArea,
    desvinculado: false,
    fecha_ocurrencia: "",
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
    exposicion_desde: "",
    exposicion_hasta: "",
    diagnosticos: [],
    documentos: documentos(tipo, p),
    origen_id: null,
    es_intercurrencia: false,
    confirmo_hecho_distinto: false,
    ...extra,
  };
}

/** CUIT válido de una empresa ficticia (para el ejemplo de pluriempleo). */
function cuitEmpresa(base: string): string {
  for (let i = 0; i < 50; i++) {
    const diez = "30" + String(Number(base) + i).padStart(8, "0");
    const dv = digitoVerificador(diez);
    if (dv !== null) return diez + dv;
  }
  throw new Error("No se pudo armar un CUIT de ejemplo");
}

// ---------------------------------------------------------------------------
// Limpieza
// ---------------------------------------------------------------------------
async function limpiar(db: Db): Promise<void> {
  await db.exec(`
    truncate table movimientos, srt_comunicaciones, intercambio_lotes, presentaciones, citaciones, documentos,
      diagnostico_lesiones, diagnostico_zonas, diagnosticos, expedientes, personas, legado_siniestros,
      contadores, usuarios restart identity cascade;
    alter sequence numero_unico_diagnostico_seq restart with 100000001;
    alter sequence fodep_codigo_seq restart with 7001;
    alter sequence fodep_numero_seq restart with 2026000101;
  `);
}

// ---------------------------------------------------------------------------
// Siembra
// ---------------------------------------------------------------------------
export async function sembrarDemo(db: Db, opciones: { ahora: Date }): Promise<void> {
  const ahora = opciones.ahora;
  await limpiar(db);
  await cargarCatalogos(db);
  await cargarFeriados(db);

  // Usuarios
  const usuarios = {} as Record<Rol, Usuario>;
  for (const [i, u] of USUARIOS_DEMO.entries()) {
    const { rows } = await db.query<Usuario>(
      "insert into usuarios (nombre, rol, cargo, email, orden) values ($1, $2, $3, $4, $5) returning *",
      [u.nombre, u.rol, u.cargo, u.email, i + 1],
    );
    usuarios[u.rol] = rows[0];
  }

  const { rows: fer } = await db.query<{ fecha: string }>("select fecha from feriados");
  const feriados = new Set(fer.map((f) => f.fecha));
  const H = fechaDe(ahora);
  /** n días corridos antes de hoy. */
  const D = (n: number) => sumarDias(H, -n);
  /** Día hábil igual o anterior a n días corridos antes de hoy. */
  const L = (n: number) => {
    let f = D(n);
    while (!esHabil(f, feriados)) f = sumarDias(f, -1);
    return f;
  };
  /** n días hábiles antes de hoy. */
  const B = (n: number) => {
    let f = H;
    let k = 0;
    while (k < n) {
      f = sumarDias(f, -1);
      if (esHabil(f, feriados)) k++;
    }
    return f;
  };
  /** n días hábiles después de una fecha. */
  const masHabiles = (f: FechaISO, n: number) => sumarDiasHabiles(f, n, feriados);

  // Cola de pasos ordenada por fecha: los números de siniestro salen en orden cronológico
  type Paso = { cuando: Date; orden: number; fn: (ctx: Ctx) => Promise<unknown>; rol: Rol };
  const pasos: Paso[] = [];
  let orden = 0;
  const en = (fecha: FechaISO, hora: string, rol: Rol, fn: (ctx: Ctx) => Promise<unknown>) => {
    let cuando = momentoArgentina(fecha, hora);
    if (cuando > ahora) cuando = new Date(ahora.getTime() - 5 * 60_000);
    pasos.push({ cuando, orden: orden++, fn, rol });
  };
  /** El día anterior (fecha del accidente cuando la denuncia entra al día siguiente). */
  const antes = (f: FechaISO) => sumarDias(f, -1);
  const ids: Record<string, number> = {};
  const diagnosticosDe = async (expedienteId: number) =>
    (await db.query<{ id: number; orden: number }>("select id, orden from diagnosticos where expediente_id = $1 order by orden", [
      expedienteId,
    ])).rows;

  /** Recepción completa: alta, verificación y pase al área médica. */
  const recibir = (clave: string, fecha: FechaISO, datos: NuevaDenunciaEntrada, opciones: { pasar?: boolean; verificar?: boolean } = {}) => {
    const { pasar = true, verificar = true } = opciones;
    en(fecha, "09:00", "mesa_entrada", async (ctx) => {
      ids[clave] = (await crearDenuncia(ctx, datos)).id;
    });
    if (verificar) {
      en(fecha, "09:20", "mesa_entrada", (ctx) => verificarRelacionLaboral(ctx, { expediente_id: ids[clave], verificada: true, motivo: null, observacion: "" }));
    }
    if (pasar) {
      en(fecha, "09:40", "mesa_entrada", async (ctx) => {
        const r = await pasarAMedica(ctx, { expediente_id: ids[clave] });
        if (!r.ok) throw new Error(`Demo ${clave}: ${r.mensaje} ${JSON.stringify(r.errores)}`);
      });
    }
  };

  /** Evaluación médica de todos los diagnósticos invocados. */
  const evaluar = (
    clave: string,
    fecha: FechaISO,
    por: Array<{ lesiones?: string[]; zonas: string[]; en_listado?: boolean; constatada?: boolean; adecuado?: string; obs?: string }>,
  ) =>
    en(fecha, "10:30", "medico", async (ctx) => {
      const dxs = await diagnosticosDe(ids[clave]);
      for (const [i, dx] of dxs.entries()) {
        const e = por[i] ?? por[0];
        await evaluarDiagnostico(ctx, {
          diagnostico_id: dx.id,
          cie10_adecuado: e.adecuado ?? "",
          patologia_constatada: e.constatada ?? true,
          en_listado: e.en_listado ?? null,
          fecha_diagnostico: fecha,
          codigo_examen: "",
          observacion_medica: e.obs ?? "",
          lesiones: e.lesiones ?? [],
          zonas: e.zonas,
        });
      }
    });

  const baja = (clave: string, fecha: FechaISO, inicio: FechaISO | null, estres = false) =>
    en(fecha, "11:00", "medico", (ctx) =>
      definirBaja(ctx, {
        expediente_id: ids[clave],
        con_baja: inicio !== null,
        fecha_inicio_inasistencia: inicio ?? "",
        estres_postraumatico: estres,
      }),
    );

  const aLegal = (clave: string, fecha: FechaISO) => en(fecha, "11:30", "medico", (ctx) => pasarALegal(ctx, { expediente_id: ids[clave] }));

  const decidir = (
    clave: string,
    fecha: FechaISO,
    decisiones: Array<"aceptado" | { motivo: "R" | "D" | "E" | "P" | "L"; fundamento: string; estudios?: string }>,
    cerrar = true,
  ) => {
    en(fecha, "12:00", "legal", async (ctx) => {
      const dxs = await diagnosticosDe(ids[clave]);
      for (const [i, dx] of dxs.entries()) {
        const d = decisiones[i] ?? decisiones[0];
        await decidirDiagnostico(ctx, {
          diagnostico_id: dx.id,
          decision: d === "aceptado" ? "aceptado" : "rechazado",
          motivo_rechazo: d === "aceptado" ? "" : d.motivo,
          fundamento: d === "aceptado" ? "" : d.fundamento,
          estudios: d === "aceptado" ? "" : (d.estudios ?? ""),
          cymat_adjunto: d !== "aceptado" && d.motivo === "E",
        });
      }
    });
    if (cerrar) en(fecha, "12:30", "legal", (ctx) => cerrarDictamen(ctx, { expediente_id: ids[clave] }));
  };

  const citar = (clave: string, fecha: FechaISO, opciones: { reiteracionDe?: string } = {}) => {
    // Se programa después del pase al área médica (09:40) y con más de 72 h de anticipación
    const cita = masHabiles(fecha, 3);
    en(fecha, "10:05", "medico", async (ctx) => {
      let reiteracion_de: number | null = null;
      if (opciones.reiteracionDe) {
        const { rows } = await db.query<{ id: number }>(
          "select id from citaciones where expediente_id = $1 and estado = 'no_asistio' order by id desc limit 1",
          [ids[clave]],
        );
        reiteracion_de = rows[0].id;
      }
      await programarCitacion(ctx, {
        expediente_id: ids[clave],
        fecha: cita,
        hora: "10:30",
        motivo: "examen",
        lugar: "Consultorio de la UERT, Av. Belgrano Sur 1150",
        detalle: "Traer estudios y certificados previos.",
        reiteracion_de,
      });
    });
    return cita;
  };

  const asistencia = (clave: string, fecha: FechaISO, asistio: boolean) =>
    en(fecha, "13:00", "medico", async (ctx) => {
      const { rows } = await db.query<{ id: number }>(
        "select id from citaciones where expediente_id = $1 and estado = 'programada' order by id desc limit 1",
        [ids[clave]],
      );
      await registrarAsistencia(ctx, { citacion_id: rows[0].id, asistio });
    });

  const presentacion = (clave: string, fecha: FechaISO, detalle: string, proxima: FechaISO | null, docs: string[] = ["certificado_control"]) =>
    en(fecha, "10:00", "seguimiento", (ctx) =>
      registrarPresentacion(ctx, {
        expediente_id: ids[clave],
        fecha,
        detalle,
        proxima_fecha: proxima ?? "",
        documentos: docs.map((tipo, i) => ({ tipo, nombre_archivo: `${tipo}_${clave}_${fecha}_${i + 1}.pdf`, tamano_bytes: 240_000 })),
      }),
    );

  // -------------------------------------------------------------------------
  // Escenarios
  // -------------------------------------------------------------------------

  // TOLEDO: accidente con alta hace meses y reingreso (sufijo 01) con licencia activa
  recibir("toledo", L(200), denuncia("AT", P.toledo, {
    fecha_ocurrencia: antes(L(200)), hora_ocurrencia: "07:45", lugar_ocurrencia: "Depósito central de insumos", localidad_ocurrencia_id: SDE,
    descripcion: "Al descender de una escalera portátil apoyó mal el pie derecho y sufrió una torsión del tobillo.",
    forma_accidente: "101", agente_material: "31401", diagnosticos: [{ cie10: "S826", agente_causante: "" }],
  }));
  evaluar("toledo", L(199), [{ lesiones: ["11"], zonas: ["044"] }]);
  baja("toledo", L(199), L(200));
  aLegal("toledo", L(199));
  decidir("toledo", L(197), ["aceptado"]);
  presentacion("toledo", L(184), "Control traumatológico: continúa con inmovilización.", D(150));
  presentacion("toledo", L(150), "Retiro de yeso. Indicación de 20 sesiones de kinesiología.", D(110), ["certificado_control", "orden_practicas"]);
  en(L(95), "10:00", "seguimiento", (ctx) => darAlta(ctx, { expediente_id: ids.toledo, fecha_alta: L(95), motivo_cese_ilt: "L" }));
  en(L(30), "08:30", "mesa_entrada", async (ctx) => {
    ids.toledo_re = (await crearReingreso(ctx, {
      origen_id: ids.toledo,
      fecha_ocurrencia: antes(L(30)),
      descripcion: "Dolor e inflamación persistente en el tobillo operado; el traumatólogo indica nueva inmovilización.",
    })).id;
  });
  en(L(30), "08:50", "mesa_entrada", (ctx) => verificarRelacionLaboral(ctx, { expediente_id: ids.toledo_re, verificada: true, motivo: null, observacion: "" }));
  en(L(30), "09:10", "mesa_entrada", (ctx) => pasarAMedica(ctx, { expediente_id: ids.toledo_re }));
  evaluar("toledo_re", L(29), [{ lesiones: ["11"], zonas: ["044"], obs: "Consolidación viciosa: requiere nueva inmovilización." }]);
  baja("toledo_re", L(29), L(30));
  aLegal("toledo_re", L(28));
  decidir("toledo_re", L(25), ["aceptado"]);
  presentacion("toledo_re", L(10), "Control: buena evolución con bota ortopédica.", sumarDias(H, 12));

  // FIGUEROA: accidente con alta médica (se puede cargar un reingreso)
  recibir("figueroa", L(120), denuncia("AT", P.figueroa, {
    fecha_ocurrencia: antes(L(120)), hora_ocurrencia: "11:20", lugar_ocurrencia: "Cocina del Hospital Regional", localidad_ocurrencia_id: SDE,
    descripcion: "Resbaló en el piso húmedo de la cocina y cayó sobre el codo izquierdo.",
    forma_accidente: "103", agente_material: "50201", diagnosticos: [{ cie10: "S521", agente_causante: "" }],
  }));
  evaluar("figueroa", L(119), [{ lesiones: ["11"], zonas: ["032"] }]);
  baja("figueroa", L(119), L(120));
  aLegal("figueroa", L(119));
  decidir("figueroa", L(116), ["aceptado"]);
  presentacion("figueroa", L(100), "Control traumatológico: buena evolución.", D(70));
  presentacion("figueroa", L(70), "Kinesiología: recupera la movilidad del codo.", D(40), ["certificado_control", "orden_practicas"]);
  presentacion("figueroa", L(40), "Control final pendiente.", D(21));
  en(L(20), "10:30", "seguimiento", (ctx) => darAlta(ctx, { expediente_id: ids.figueroa, fecha_alta: L(20), motivo_cese_ilt: "L" }));

  // CARRIZO: EP con licencia activa, presentación vencida y tope de la ILT cercano
  recibir("carrizo", L(60), denuncia("EP", P.carrizo, {
    fecha_ocurrencia: D(340), exposicion_desde: "2004-03-01",
    diagnosticos: [{ cie10: "J382", agente_causante: "80006" }],
    documentos: documentos("EP", P.carrizo, [], ["regimen_incompatibilidad"]),
  }));
  {
    const cita = citar("carrizo", L(59));
    asistencia("carrizo", cita, true);
    const ev = masHabiles(cita, 1);
    evaluar("carrizo", ev, [{ zonas: ["071"], en_listado: true, obs: "Nódulos bilaterales en videolaringoscopia." }]);
    baja("carrizo", ev, D(57));
    aLegal("carrizo", masHabiles(ev, 1));
    decidir("carrizo", masHabiles(ev, 3), ["aceptado"]);
  }
  presentacion("carrizo", L(36), "Certificado de fonoaudiología: reposo vocal y 10 sesiones de foniatría.", D(3), ["certificado_control", "orden_practicas"]);

  // ÁVILA: EP rechazada por ausencia de exposición, con relevamiento CYMAT
  recibir("avila", L(45), denuncia("EP", P.avila, {
    fecha_ocurrencia: D(70), exposicion_desde: "2016-06-01",
    diagnosticos: [{ cie10: "J450", agente_causante: "40105" }],
  }));
  {
    const cita = citar("avila", L(44));
    asistencia("avila", cita, true);
    const ev = masHabiles(cita, 1);
    evaluar("avila", ev, [{ zonas: ["070"], en_listado: true, obs: "Espirometría con patrón obstructivo reversible." }]);
    baja("avila", ev, null);
    aLegal("avila", masHabiles(ev, 1));
    decidir("avila", masHabiles(ev, 6), [
      {
        motivo: "E",
        fundamento:
          "El relevamiento CYMAT del puesto (sala de internación pediátrica) no identificó exposición a hipocloritos alcalinos en concentraciones idóneas: la desinfección la realiza el personal de limpieza con productos diluidos y en otro sector.",
      },
    ]);
  }

  // ALBARRACÍN: EP aceptada sin baja: 20 días hábiles para la Comisión Médica (vence en 8)
  recibir("albarracin", B(22), denuncia("EP", P.albarracin, {
    fecha_ocurrencia: D(90), exposicion_desde: "2009-03-01",
    diagnosticos: [{ cie10: "M751", agente_causante: "80004" }],
  }));
  evaluar("albarracin", B(18), [{ zonas: ["030"], en_listado: true, obs: "Ecografía: tendinopatía del supraespinoso." }]);
  baja("albarracin", B(18), null);
  aLegal("albarracin", B(17));
  decidir("albarracin", B(12), ["aceptado"]);

  // SALVATIERRA: AT con licencia activa (presentación en 2 días) e intercurrencia
  recibir("salvatierra", L(40), denuncia("AT", P.salvatierra, {
    fecha_ocurrencia: antes(L(40)), hora_ocurrencia: "06:40", lugar_ocurrencia: "Vía pública, durante un patrullaje", localidad_ocurrencia_id: SDE,
    descripcion: "Al descender del móvil policial pisó un desnivel del cordón y cayó; sufrió una fractura de la pierna derecha.",
    forma_accidente: "103", agente_material: "50102", diagnosticos: [{ cie10: "S822", agente_causante: "" }],
  }));
  evaluar("salvatierra", L(39), [{ lesiones: ["11"], zonas: ["043"] }]);
  baja("salvatierra", L(39), L(40));
  aLegal("salvatierra", L(39));
  decidir("salvatierra", L(36), ["aceptado"]);
  presentacion("salvatierra", L(21), "Control traumatológico: callo óseo en formación. Indicación de kinesiología.", sumarDias(H, 2), [
    "certificado_control",
    "orden_practicas",
  ]);
  en(L(4), "10:00", "seguimiento", async (ctx) => {
    ids.salvatierra_ic = (await registrarIntercurrencia(ctx, {
      expediente_id: ids.salvatierra,
      fecha_ocurrencia: antes(L(4)),
      descripcion: "Al salir de la sesión de kinesiología tropezó en la vereda del centro de rehabilitación y se golpeó la rodilla izquierda.",
      cie10: "S800",
    })).id;
  });

  // LUNA: in itinere con licencia activa
  recibir("luna", L(25), denuncia("IT", P.luna, {
    fecha_ocurrencia: antes(L(25)), hora_ocurrencia: "07:10", lugar_ocurrencia: "Av. Belgrano y calle Pellegrini", localidad_ocurrencia_id: SDE,
    descripcion: "Camino al trabajo en motocicleta, un automóvil lo embistió en una intersección.",
    forma_accidente: "907", agente_material: "20007",
    trayecto: "Desde su domicilio en barrio Siglo XX hasta la Comisaría Seccional 1ra, recorrido habitual por Av. Belgrano.",
    diagnosticos: [{ cie10: "S420", agente_causante: "" }],
  }));
  evaluar("luna", L(24), [{ lesiones: ["11"], zonas: ["030"] }]);
  baja("luna", L(24), L(25));
  aLegal("luna", L(24));
  decidir("luna", L(20), ["aceptado"]);
  presentacion("luna", L(5), "Control: buena evolución, continúa con cabestrillo.", sumarDias(H, 10));

  // ACOSTA: AT en dictamen legal, con prórroga
  {
    const dia = B(17);
    recibir("acosta", dia, denuncia("AT", P.acosta, {
      fecha_ocurrencia: sumarDias(dia, -1), hora_ocurrencia: "10:15", lugar_ocurrencia: "Archivo del Hospital Regional", localidad_ocurrencia_id: SDE,
      descripcion: "Mientras trasladaba cajas con historias clínicas al archivo, perdió el equilibrio en la escalera y cayó sobre el hombro derecho.",
      forma_accidente: "501", agente_material: "30911", diagnosticos: [{ cie10: "S420", agente_causante: "" }],
    }));
    evaluar("acosta", B(16), [{ lesiones: ["11"], zonas: ["030"] }]);
    baja("acosta", B(16), dia);
    aLegal("acosta", B(14));
    en(B(5), "10:00", "legal", (ctx) => solicitarProrroga(ctx, { expediente_id: ids.acosta }));
  }

  // CORONEL: in itinere en dictamen legal, vence en 2 días hábiles
  {
    const dia = B(10);
    recibir("coronel", dia, denuncia("IT", P.coronel, {
      fecha_ocurrencia: sumarDias(dia, -1), hora_ocurrencia: "07:30", lugar_ocurrencia: "Av. Libertad, a dos cuadras del centro de salud", localidad_ocurrencia_id: SDE,
      descripcion: "Se dirigía al trabajo en bicicleta; un colectivo la rozó y cayó sobre la mano derecha.",
      forma_accidente: "906", agente_material: "20010",
      trayecto: "Desde su domicilio en La Banda hasta el Centro de Salud Barrio Norte, en bicicleta por Av. Libertad.",
      diagnosticos: [{ cie10: "S525", agente_causante: "" }],
    }));
    evaluar("coronel", B(9), [{ lesiones: ["11"], zonas: ["034"] }]);
    baja("coronel", B(9), dia);
    aLegal("coronel", B(8));
  }

  // ROJAS: EP en dictamen legal VENCIDO, con dos diagnósticos (uno fuera del Listado)
  recibir("rojas", B(20), denuncia("EP", P.rojas, {
    fecha_ocurrencia: D(150), exposicion_desde: "2011-04-01",
    diagnosticos: [
      { cie10: "G560", agente_causante: "80004" },
      { cie10: "M654", agente_causante: "80004" },
    ],
  }));
  {
    const cita = citar("rojas", B(20));
    asistencia("rojas", cita, true);
    evaluar("rojas", B(14), [
      { zonas: ["034"], en_listado: true, obs: "Electromiograma compatible con síndrome del túnel carpiano moderado." },
      { zonas: ["034"], en_listado: false, obs: "Tenosinovitis de De Quervain constatada por ecografía." },
    ]);
    baja("rojas", B(14), B(15));
    aLegal("rojas", B(12));
  }

  // MEDINA: AT en evaluación médica (diagnóstico pendiente)
  recibir("medina", L(3), denuncia("AT", P.medina, {
    fecha_ocurrencia: antes(L(3)), hora_ocurrencia: "15:20", lugar_ocurrencia: "Obra de refacción de la Escuela N° 33", localidad_ocurrencia_id: SDE,
    descripcion: "Al bajar de un andamio apoyó mal el pie izquierdo y sufrió una torsión de tobillo.",
    forma_accidente: "101", agente_material: "50204", diagnosticos: [{ cie10: "S934", agente_causante: "" }],
  }));

  // JUÁREZ: EP en evaluación médica, con citación programada y pluriempleo
  recibir("juarez", B(6), denuncia("EP", P.juarez, {
    fecha_ocurrencia: D(200), exposicion_desde: "1998-05-01",
    pluriempleo: true, cuits_pluriempleo: [cuitEmpresa("71234560")], obligada_pago: false,
    diagnosticos: [{ cie10: "H833", agente_causante: "90001" }],
  }));
  citar("juarez", B(2));

  // VERA: EP en evaluación médica, no asistió a la citación: hay que reiterarla
  recibir("vera", B(14), denuncia("EP", P.vera, {
    fecha_ocurrencia: D(120), exposicion_desde: "2001-08-01",
    diagnosticos: [{ cie10: "M511", agente_causante: "80011" }],
  }));
  {
    const cita = citar("vera", B(13));
    asistencia("vera", cita, false);
  }

  // BRAVO: EP con la reiteración vencida sin resultado (si no asistió, caduca)
  recibir("bravo", B(20), denuncia("EP", P.bravo, {
    fecha_ocurrencia: D(100), exposicion_desde: "2015-02-01",
    diagnosticos: [{ cie10: "G560", agente_causante: "80004" }],
  }));
  {
    const cita = citar("bravo", B(19));
    asistencia("bravo", cita, false);
    citar("bravo", masHabiles(cita, 1), { reiteracionDe: "bravo" });
  }

  // DÍAZ: EP desistida por falta de cobertura
  recibir("diaz", L(9), denuncia("EP", P.diaz, {
    fecha_ocurrencia: D(60), exposicion_desde: "2018-01-01",
    diagnosticos: [{ cie10: "H903", agente_causante: "90001" }],
  }), { verificar: false, pasar: false });
  en(L(8), "10:00", "mesa_entrada", (ctx) =>
    verificarRelacionLaboral(ctx, {
      expediente_id: ids.diaz,
      verificada: false,
      motivo: "falta_cobertura",
      observacion: "El CUIL no figura en la nómina de la UERT: revista en una empresa contratista con ART propia.",
    }),
  );

  // LEDESMA: EP denunciada por el empleador, lista para pasar al área médica
  recibir("ledesma", L(2), denuncia("EP", P.ledesma, {
    denunciante_tipo: "empleador",
    denunciante_nombre: "Servicio de Medicina Laboral · Hospital Regional",
    denunciante_email: "medicinalaboral@hospital.example",
    denunciante_telefono: "385 555-0190",
    fecha_ocurrencia: D(45), exposicion_desde: "2014-07-01",
    diagnosticos: [{ cie10: "M545", agente_causante: "80011" }],
  }), { pasar: false });

  // OLIVA: AT recibido ayer, verificado y con la documentación completa
  recibir("oliva", L(1), denuncia("AT", P.oliva, {
    fecha_ocurrencia: antes(L(1)), hora_ocurrencia: "08:30", lugar_ocurrencia: "Escalera del edificio central de Rentas", localidad_ocurrencia_id: SDE,
    descripcion: "Al bajar la escalera con cajas de expedientes resbaló y cayó sobre la muñeca izquierda.",
    forma_accidente: "101", agente_material: "50203",
  }), { pasar: false });

  // GÓMEZ: EP recibida hoy por el canal digital; falta un documento y verificar la cobertura
  recibir("gomez", H, denuncia("EP", P.gomez, {
    canal: "digital",
    fecha_ocurrencia: D(40), exposicion_desde: "2012-03-01",
    diagnosticos: [
      { cie10: "J382", agente_causante: "80006" },
      { cie10: "R490", agente_causante: "80006" },
    ],
    documentos: documentos("EP", P.gomez, ["antecedentes_medicos"], ["regimen_incompatibilidad"]),
  }), { verificar: false, pasar: false });

  // Lotes del Sistema de Intercambio ya enviados
  en(L(31), "18:00", "admin", (ctx) => generarLoteIntercambio(ctx));
  en(L(1), "18:00", "admin", (ctx) => generarLoteIntercambio(ctx));

  // Ejecutar en orden cronológico
  pasos.sort((a, b) => a.cuando.getTime() - b.cuando.getTime() || a.orden - b.orden);
  for (const paso of pasos) {
    await paso.fn({ db, usuario: usuarios[paso.rol], ahora: paso.cuando });
  }

  await sembrarLegado(db);
}

/** Siniestros del "sistema actual" (simulado) para la búsqueda unificada. */
async function sembrarLegado(db: Db): Promise<void> {
  const filas: Array<[PersonaDemo | { apellido: string; nombres: string; dni: string; sexo: "F" | "M" }, string, number, string, string, boolean, FechaISO, string, string]> = [
    [P.gomez, "AT-2023-0412", 2023, "Accidente de trabajo", "Alta médica", false, "2023-06-12", "S934 Esguince de tobillo", "Escuela N° 412"],
    [P.juarez, "AT-2019-0088", 2019, "Accidente de trabajo", "Cerrado", false, "2019-09-03", "S610 Herida de dedo de la mano", "Vialidad Provincial"],
    [P.juarez, "AT-2021-0233", 2021, "Accidente de trabajo", "Alta médica", false, "2021-04-19", "S800 Contusión de rodilla", "Vialidad Provincial"],
    [P.paz, "AT-2026-0611", 2026, "Accidente de trabajo", "En trámite · licencia activa", true, "2026-10-21", "S420 Fractura de clavícula", "Desarrollo Social"],
    [P.figueroa, "EP-2022-0034", 2022, "Enfermedad profesional", "Rechazado", false, "2022-08-30", "L24 Dermatitis de contacto", "Hospital Regional"],
    [P.sosa, "IT-2025-0377", 2025, "Accidente in itinere", "Alta médica", false, "2025-05-14", "S934 Esguince de tobillo", "Escuela N° 1050"],
    [{ apellido: "QUIROGA", nombres: "Elsa Raquel", dni: "99000201", sexo: "F" }, "AT-2020-0150", 2020, "Accidente de trabajo", "Alta médica", false, "2020-02-11", "S525 Fractura de radio", "Ministerio de Salud"],
    [{ apellido: "ROMANO", nombres: "Pedro Luis", dni: "99000202", sexo: "M" }, "IT-2024-0291", 2024, "Accidente in itinere", "Alta médica", false, "2024-07-30", "S800 Contusión de rodilla", "Policía de la Provincia"],
  ];
  for (const [p, numero, anio, tipo, estado, abierto, fecha, diagnostico, reparticion] of filas) {
    await db.query(
      `insert into legado_siniestros (cuil, dni, apellido_nombre, numero, anio, tipo, estado, abierto, fecha_ocurrencia, diagnostico, reparticion)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [cuilDesdeDni(p.dni, p.sexo), p.dni, `${p.apellido}, ${p.nombres}`, numero, anio, tipo, estado, abierto, fecha, diagnostico, reparticion],
    );
  }
}
