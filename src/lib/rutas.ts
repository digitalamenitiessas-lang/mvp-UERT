/**
 * Prefijo de la app cuando se sirve debajo de una ruta (basePath de Next).
 * En la VPS es "/uert" (https://vps.marcorossi.com.ar/uert); en desarrollo
 * queda vacío. Se fija en el build con NEXT_PUBLIC_BASE_PATH.
 *
 * Link, redirect(), router.push() y next/form ya agregan el prefijo solos.
 * Hace falta a mano solo en fetch(), en <a> y <form> nativos.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Ruta interna de la app ("/api/…") con el prefijo, para fetch, <a> y <form>. */
export function conBase(ruta: string): string {
  return `${BASE_PATH}${ruta}`;
}
