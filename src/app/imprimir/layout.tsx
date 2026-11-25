import { requerirUsuario } from "@/lib/sesion";

/**
 * Documentos para imprimir (constancia de recepción, citación, notificación de
 * rechazo): hoja blanca, sin la barra de la aplicación, y una sola regla de
 * página A4 para los tres.
 */
export default async function LayoutImprimir({ children }: { children: React.ReactNode }) {
  await requerirUsuario();
  return (
    <div className="min-h-screen bg-white pb-10 text-black print:bg-white print:pb-0">
      <style>{"@page { size: A4; margin: 16mm 15mm; }"}</style>
      {children}
    </div>
  );
}
