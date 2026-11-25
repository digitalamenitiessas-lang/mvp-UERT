/** Formatos de presentación que sirven en servidor y en cliente. */

export function formatoTamano(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "1 diagnóstico" / "3 diagnósticos". */
export function plural(n: number, singular: string, pluralTexto = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

/** JSON legible para mostrar requests y responses simulados. */
export function jsonLegible(valor: unknown): string {
  return JSON.stringify(valor, null, 2);
}
