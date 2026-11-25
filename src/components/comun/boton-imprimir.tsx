"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Abre el diálogo de impresión del navegador. No sale en la hoja impresa. */
export function BotonImprimir({ texto = "Imprimir", className }: { texto?: string; className?: string }) {
  return (
    <Button type="button" onClick={() => window.print()} className={cn("no-imprimir", className)}>
      <PrinterIcon />
      {texto}
    </Button>
  );
}
