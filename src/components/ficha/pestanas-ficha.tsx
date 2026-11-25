"use client";

import { Tabs } from "@/components/ui/tabs";

/**
 * Solapas de la ficha. El contenido de cada solapa se arma en el servidor y
 * llega como children; acá solo se recuerda la solapa elegida en la URL
 * (?tab=…) para que un recargo o un enlace abran la misma.
 */
export function PestanasFicha({
  inicial,
  porDefecto = "resumen",
  children,
  className,
}: {
  inicial: string;
  porDefecto?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tabs
      defaultValue={inicial}
      className={className}
      onValueChange={(valor) => {
        const url = new URL(window.location.href);
        if (valor === porDefecto) url.searchParams.delete("tab");
        else url.searchParams.set("tab", valor);
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }}
    >
      {children}
    </Tabs>
  );
}
