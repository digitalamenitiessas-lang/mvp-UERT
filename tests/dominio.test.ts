import { describe, expect, it } from "vitest";
import { diasHabilesRestantes, estadoPlazo, momentoArgentina, sumarDiasHabiles, fechaDe } from "@/lib/dominio/fechas";
import { numeroExpediente, numeroSiniestroSRT, parsearNumero } from "@/lib/dominio/numeracion";
import { cuilDesdeDni, dniCoincideConCuil, esCuilValido, esCuitValido, formatoCuil } from "@/lib/dominio/validaciones";
import { documentosFaltantes } from "@/lib/dominio/documentos";
import { puede } from "@/lib/dominio/permisos";
import { LARGO, desarmarLinea, generarArchivos, lineaAD, LAYOUT_AD, type RegistroDiagnostico } from "@/lib/srt/intercambio";
import { validarDenunciaFODEP, validarDiagnosticosFODEP, type DenunciaFODEP } from "@/lib/srt/fodep";

describe("CUIL / CUIT", () => {
  it("valida el CUIT de la Provincia de Santiago del Estero", () => {
    expect(esCuitValido("30999164990")).toBe(true);
    expect(esCuitValido("30999164991")).toBe(false);
  });
  it("arma CUIL válidos desde el DNI", () => {
    for (const dni of ["99000101", "99000102", "12345678", "7654321"]) {
      expect(esCuilValido(cuilDesdeDni(dni, "F"))).toBe(true);
      expect(esCuilValido(cuilDesdeDni(dni, "M"))).toBe(true);
    }
  });
  it("formatea", () => {
    expect(formatoCuil("20990001013")).toBe("20-99000101-3");
  });
  it("exige que el DNI coincida con los dígitos 3 a 10 del CUIL", () => {
    expect(dniCoincideConCuil("20-99400052-8", "99400052")).toBe(true);
    expect(dniCoincideConCuil("20-99400052-8", "99400053")).toBe(false);
    const cuil7 = cuilDesdeDni("7654321", "M");
    expect(dniCoincideConCuil(cuil7, "7654321")).toBe(true);
  });
});

describe("Días hábiles", () => {
  const feriados = new Set(["2026-12-08"]);
  it("cuenta desde el día hábil siguiente y saltea fines de semana y feriados", () => {
    // martes 24/11/2026 + 10 hábiles = martes 08/12 es feriado → miércoles 09/12
    expect(sumarDiasHabiles("2026-11-24", 10, feriados)).toBe("2026-12-09");
    // viernes + 1 hábil = lunes
    expect(sumarDiasHabiles("2026-11-27", 1, feriados)).toBe("2026-11-30");
  });
  it("calcula lo que falta y el atraso", () => {
    expect(diasHabilesRestantes("2026-11-24", "2026-11-26", feriados)).toBe(2);
    expect(diasHabilesRestantes("2026-11-26", "2026-11-26", feriados)).toBe(0);
    expect(diasHabilesRestantes("2026-11-30", "2026-11-26", feriados)).toBe(-2);
    expect(estadoPlazo("2026-11-24", "2026-11-26", { habiles: true, feriados }).nivel).toBe("proximo");
    expect(estadoPlazo("2026-11-27", "2026-11-26", { habiles: true, feriados }).nivel).toBe("vencido");
  });
  it("usa la hora de Argentina", () => {
    const m = momentoArgentina("2026-11-24", "23:30");
    expect(m.toISOString()).toBe("2026-11-25T02:30:00.000Z");
    expect(fechaDe(m)).toBe("2026-11-24");
  });
});

describe("Número de siniestro (Res. SRT 3326/14)", () => {
  it("tiene 20 posiciones: 8 libres + año + contador + sufijo", () => {
    const n = numeroSiniestroSRT(2026, 123, 1);
    expect(n).toHaveLength(20);
    expect(n).toBe("00050024" + "2026" + "000123" + "01");
    expect(numeroExpediente(2026, 123, 1)).toBe("2026-000123-01");
    expect(parsearNumero("2026-000123-01")).toEqual({ anio: 2026, contador: 123, sufijo: 1 });
  });
});

describe("Documentación por tipo de denuncia", () => {
  it("in itinere solo exige la Declaración Jurada de Trayecto", () => {
    expect(documentosFaltantes("IT", []).map((d) => d.clave)).toEqual(["dj_trayecto"]);
  });
  it("EP exige el FODEP firmado", () => {
    expect(documentosFaltantes("EP", ["dni"]).map((d) => d.clave)).toContain("fodep");
  });
});

describe("Permisos", () => {
  it("cada rol hace lo suyo", () => {
    expect(puede("mesa_entrada", "crear_denuncia")).toBe(true);
    expect(puede("medico", "crear_denuncia")).toBe(false);
    expect(puede("legal", "decidir_diagnostico", "dictamen_legal")).toBe(true);
    expect(puede("legal", "decidir_diagnostico", "evaluacion_medica")).toBe(false);
  });
});

describe("Archivos de intercambio FODEP", () => {
  const base: RegistroDiagnostico = {
    numeroSiniestro: numeroSiniestroSRT(2026, 1, 0),
    extension: "EF",
    numeroUnico: 100000001,
    orden: 1,
    tipoOperacion: "A",
    cie10: "J38",
    fechaDiagnostico: "2026-11-20",
    codigoExamen: "F",
    desvinculado: false,
    idFodep: 7001,
    lesiones: [],
    zonas: [{ orden: 1, codigo: "071" }],
  };
  it(".AD respeta las posiciones del layout", () => {
    const linea = lineaAD(base, "00050");
    expect(linea).toHaveLength(LARGO.AD);
    const campos = Object.fromEntries(desarmarLinea(linea, LAYOUT_AD).map((c) => [c.campo, c.valor]));
    expect(campos["CART"]).toBe("00050");
    expect(campos["EXTENSION"]).toBe("EF");
    expect(campos["Número único de DIAGNÓSTICO"]).toBe("0100000001");
    expect(campos["ORDEN"]).toBe("001");
    expect(campos["CIE10"]).toBe("J38 ");
    expect(campos["Fecha de diagnóstico"]).toBe("20261120");
    expect(campos["Código examen de detección"]).toBe("F");
    expect(campos["Desvinculado"]).toBe("0");
    expect(campos["ID_FODEP"]).toBe("0000007001");
  });
  it("exige el ID_FODEP con código de examen F", () => {
    expect(() => lineaAD({ ...base, idFodep: null }, "00050")).toThrow(/ID_FODEP/);
    expect(lineaAD({ ...base, codigoExamen: "P", idFodep: null }, "00050")).toHaveLength(LARGO.AD);
  });
  it("genera .AL y .AZ con el número único como vínculo", () => {
    const at = { ...base, extension: "AT" as const, codigoExamen: null, idFodep: null, lesiones: [{ orden: 1, codigo: "11" }], zonas: [{ orden: 1, codigo: "044" }] };
    const [ad, al, az] = generarArchivos([at], "00050");
    expect(ad.registros).toBe(1);
    expect(al.contenido).toBe("00050" + "0100000001" + "001" + "A" + "11" + "\r\n");
    expect(az.contenido).toBe("00050" + "0100000001" + "001" + "A" + "044" + "\r\n");
    expect(ad.nombre).toBe("ART000501.AD1");
  });
});

describe("Validaciones del WS FODEP (simulado)", () => {
  const ok: DenunciaFODEP = {
    CuilTrabajador: cuilDesdeDni("99000101", "F"),
    NombreTrabajador: "GÓMEZ, María Luz",
    TelefonoTrabajador: "3855550101",
    EmailTrabajador: "maria@correo.example",
    CuitEmpleador: "30999164990",
    DomicilioEmpleador: "Av. Belgrano Sur 1450",
    LocalidadIdEmp: 3746,
    ProvinciaIdEmp: 14,
    Pluriempleo: false,
    AntArea: "9 años",
    AntEmpresa: "14 años",
    Puesto: "Docente",
    Tareas: "Clases",
    ExposicionDesde: "2012-03-01",
    RecepcionDenuncia: "2026-11-24",
  };
  it("acepta una denuncia completa", () => {
    expect(validarDenunciaFODEP(ok, "2026-11-24")).toEqual([]);
  });
  it("devuelve los códigos de error de la SRT", () => {
    const codigos = (d: Partial<DenunciaFODEP>) => validarDenunciaFODEP({ ...ok, ...d }, "2026-11-24").map((e) => e.codigo);
    expect(codigos({ CuilTrabajador: "20000000000" })).toContain("FO01");
    expect(codigos({ ExposicionHasta: "2010-01-01" })).toContain("FO09");
    expect(codigos({ RecepcionDenuncia: "2026-12-01" })).toContain("FO10");
    expect(codigos({ Pluriempleo: true })).toEqual(expect.arrayContaining(["FO28", "FO30"]));
    expect(codigos({ ObligadaPago: true })).toContain("FO31");
    expect(codigos({ Puesto: "" })).toContain("FO26");
  });
  it("controla la cantidad y los códigos de los diagnósticos", () => {
    const cat = { cie10: new Set(["J382"]), agentes: new Set(["80006"]) };
    const once = Array.from({ length: 11 }, () => ({ CIE10: "J382", AgenteCausante: "80006" }));
    expect(validarDiagnosticosFODEP(once, cat).map((e) => e.codigo)).toContain("FO23");
    expect(validarDiagnosticosFODEP([{ CIE10: "X999", AgenteCausante: "1" }], cat).map((e) => e.codigo)).toEqual(["FO18", "FO19"]);
  });
});
