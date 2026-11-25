"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { CampoCatalogo } from "@/components/comun/campo-catalogo";
import { Button } from "@/components/ui/button";
import type { Catalogo } from "@/lib/datos/catalogos";

/**
 * Varios códigos de un catálogo de la SRT (lesiones, zonas del cuerpo): se
 * agregan de a uno con el buscador y se quitan de la lista.
 */
export function ListaCodigos({
  id,
  catalogo,
  valor,
  onChange,
  descripciones,
  maximo,
  nombre,
  placeholder,
  invalido,
}: {
  id: string;
  catalogo: Catalogo;
  valor: string[];
  onChange: (codigos: string[]) => void;
  /** Descripciones de los códigos precargados. */
  descripciones: Record<string, string>;
  maximo: number;
  /** "lesión", "zona del cuerpo": para los textos de accesibilidad. */
  nombre: string;
  placeholder: string;
  invalido?: boolean;
}) {
  const [etiquetas, setEtiquetas] = useState(descripciones);
  return (
    <div className="flex flex-col gap-2">
      {valor.length ? (
        <ul className="flex flex-col gap-1">
          {valor.map((codigo) => (
            <li key={codigo} className="flex items-center gap-2 rounded-md border bg-muted/30 py-1 pr-1 pl-2 text-sm">
              <span className="font-mono text-xs font-semibold">{codigo}</span>
              <span className="min-w-0 flex-1 truncate">{etiquetas[codigo] ?? ""}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Quitar ${nombre} ${codigo}`}
                onClick={() => onChange(valor.filter((c) => c !== codigo))}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {valor.length < maximo ? (
        <CampoCatalogo
          id={id}
          catalogo={catalogo}
          valor={null}
          invalido={invalido}
          placeholder={placeholder}
          onChange={(codigo, opcion) => {
            if (!codigo || valor.includes(codigo)) return;
            setEtiquetas((e) => ({ ...e, [codigo]: opcion?.descripcion ?? codigo }));
            onChange([...valor, codigo]);
          }}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Llegaste al máximo de {maximo}.</p>
      )}
    </div>
  );
}
