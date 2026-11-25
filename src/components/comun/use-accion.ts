"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ResultadoAccion } from "@/app/acciones";

export interface ErrorDeAccion {
  error: string;
  detalles?: string[];
}

/**
 * Ejecuta una acción del servidor con estado de espera, aviso de éxito y
 * error (con detalles) para mostrar en el formulario.
 *
 *   const { ejecutar, pendiente, error } = useAccion();
 *   ejecutar(() => accionPasarALegal(id), { alTerminar: () => setAbierto(false) });
 */
export function useAccion() {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<ErrorDeAccion | null>(null);

  function ejecutar<T>(
    accion: () => Promise<ResultadoAccion<T>>,
    opciones: { exito?: string; alTerminar?: (datos: T) => void; silencioso?: boolean } = {},
  ) {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (r.ok) {
        if (!opciones.silencioso) toast.success(opciones.exito ?? r.mensaje ?? "Listo");
        opciones.alTerminar?.(r.datos);
      } else {
        setError({ error: r.error, detalles: r.detalles });
        toast.error(r.error, r.detalles?.length ? { description: r.detalles.slice(0, 4).join(" · ") } : undefined);
      }
    });
  }

  return { ejecutar, pendiente, error, limpiarError: () => setError(null) };
}
