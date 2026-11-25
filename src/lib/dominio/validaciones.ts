/**
 * Validaciones de identificadores argentinos y helpers de formato.
 */

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Dígito verificador de CUIT/CUIL para los 10 primeros dígitos (null si no existe). */
export function digitoVerificador(diez: string): number | null {
  if (!/^\d{10}$/.test(diez)) return null;
  const suma = PESOS_CUIT.reduce((acc, peso, i) => acc + peso * Number(diez[i]), 0);
  const resto = 11 - (suma % 11);
  if (resto === 11) return 0;
  if (resto === 10) return null; // la AFIP cambia el prefijo en ese caso
  return resto;
}

function validarClave(clave: string, prefijos: readonly string[]): boolean {
  const limpia = soloDigitos(clave);
  if (!/^\d{11}$/.test(limpia)) return false;
  if (!prefijos.includes(limpia.slice(0, 2))) return false;
  return digitoVerificador(limpia.slice(0, 10)) === Number(limpia[10]);
}

/** CUIL de una persona humana (prefijos 20, 23, 24, 27). */
export function esCuilValido(cuil: string): boolean {
  return validarClave(cuil, ["20", "23", "24", "27"]);
}

/** CUIT (personas humanas o jurídicas). */
export function esCuitValido(cuit: string): boolean {
  return validarClave(cuit, ["20", "23", "24", "27", "30", "33", "34"]);
}

/** Arma un CUIL válido a partir de DNI y sexo (útil para datos de prueba). */
export function cuilDesdeDni(dni: string, sexo: "F" | "M" | "X"): string {
  const doc = soloDigitos(dni).padStart(8, "0");
  for (const prefijo of sexo === "F" ? ["27", "23"] : ["20", "23"]) {
    const dv = digitoVerificador(prefijo + doc);
    if (dv !== null) return prefijo + doc + dv;
  }
  // Con 23 siempre existe un dígito para alguna variante; último recurso:
  return "24" + doc + (digitoVerificador("24" + doc) ?? 0);
}

/**
 * El DNI coincide con los dígitos 3 a 10 del CUIL (sin importar los ceros a
 * la izquierda de un DNI de 7 dígitos). Si alguno de los dos no está completo
 * no se compara: de eso se ocupan sus propias validaciones.
 */
export function dniCoincideConCuil(cuil: string, dni: string): boolean {
  const c = soloDigitos(cuil);
  const d = soloDigitos(dni);
  if (c.length !== 11 || !/^\d{7,8}$/.test(d)) return true;
  return c.slice(2, 10) === d.padStart(8, "0");
}

export const MENSAJE_DNI_CUIL = "El DNI no coincide con el CUIL (dígitos 3 a 10). Revisá los dos números.";

export function soloDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** '20990000013' → '20-99000001-3'. */
export function formatoCuil(cuil: string | null | undefined): string {
  const d = soloDigitos(cuil ?? "");
  if (d.length !== 11) return cuil ?? "—";
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** '99000001' → '99.000.001'. */
export function formatoDni(dni: string | null | undefined): string {
  const d = soloDigitos(dni ?? "");
  if (!d) return "—";
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Código CIE-10 como lo publica la SRT: letra + 2 o 3 dígitos (p. ej. 'J45', 'M545'). */
export function esCodigoCie10(codigo: string): boolean {
  return /^[A-Z]\d{2,3}$/.test(codigo);
}
