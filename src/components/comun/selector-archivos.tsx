"use client";

import { useRef } from "react";
import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatoTamano } from "@/lib/formato";

export interface ArchivoElegido {
  nombre: string;
  tamano: number;
}

/** Aviso de la demo sobre los archivos (una vez por formulario, no por botón). */
export const AVISO_ARCHIVOS_DEMO = "Demo: se registran nombre y tamaño, el archivo no se sube.";

/**
 * Elegir varios archivos, en varias tandas y desde distintas carpetas
 * (RNF-03). En la demo se registran el nombre y el tamaño: los archivos no
 * se suben al servidor. Con varios selectores en la misma pantalla, el aviso
 * va una sola vez (AVISO_ARCHIVOS_DEMO) y cada botón lleva su `etiqueta`.
 */
export function SelectorArchivos({
  valor,
  onChange,
  multiple = true,
  textoBoton = "Elegir archivos",
  etiqueta,
  aviso = false,
  disabled,
}: {
  valor: ArchivoElegido[];
  onChange: (archivos: ArchivoElegido[]) => void;
  multiple?: boolean;
  textoBoton?: string;
  /** Nombre accesible del botón cuando el texto se repite ("Adjuntar Recibo de sueldo"). */
  etiqueta?: string;
  /** Mostrar al lado el aviso de la demo. */
  aviso?: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          multiple={multiple}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff,.doc,.docx"
          onChange={(e) => {
            const nuevos = Array.from(e.target.files ?? []).map((f) => ({ nombre: f.name, tamano: f.size }));
            onChange(multiple ? [...valor, ...nuevos] : nuevos.slice(0, 1));
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => input.current?.click()}
          disabled={disabled}
          aria-label={etiqueta}
        >
          <PaperclipIcon />
          {textoBoton}
        </Button>
        {aviso ? <span className="text-xs text-muted-foreground">{AVISO_ARCHIVOS_DEMO}</span> : null}
      </div>
      {valor.length ? (
        <ul className="flex flex-col gap-1">
          {valor.map((a, i) => (
            <li key={`${a.nombre}-${i}`} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-sm">
              <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
              <span className="text-xs text-muted-foreground">{formatoTamano(a.tamano)}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Quitar ${a.nombre}`}
                onClick={() => onChange(valor.filter((_, j) => j !== i))}
                disabled={disabled}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
