"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { Catalogo, OpcionCatalogo } from "@/lib/datos/catalogos";
import { conBase } from "@/lib/rutas";
import { cn } from "@/lib/utils";

async function buscar(catalogo: Catalogo, q: string): Promise<OpcionCatalogo[]> {
  const r = await fetch(conBase(`/api/catalogos/${catalogo}?q=${encodeURIComponent(q)}`));
  if (!r.ok) return [];
  return r.json();
}

/**
 * Combo con buscador sobre un catálogo de la SRT (RF-31): busca por código o
 * por palabras, sin importar acentos. Para localidades el código es el id
 * (como string).
 */
export function CampoCatalogo({
  catalogo,
  valor,
  onChange,
  placeholder = "Buscar…",
  disabled,
  id,
  invalido,
  mostrarCodigo = true,
  className,
}: {
  catalogo: Catalogo;
  valor: string | null;
  onChange: (codigo: string | null, opcion: OpcionCatalogo | null) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  invalido?: boolean;
  mostrarCodigo?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [opciones, setOpciones] = useState<OpcionCatalogo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [etiquetas, setEtiquetas] = useState<Record<string, OpcionCatalogo>>({});
  const pedido = useRef(0);

  // Etiqueta del valor precargado (se busca una sola vez por código)
  useEffect(() => {
    if (!valor || etiquetas[valor]) return;
    let vigente = true;
    buscar(catalogo, valor).then((ops) => {
      const opcion = ops.find((o) => o.codigo === valor) ?? { codigo: valor, descripcion: valor };
      if (vigente) setEtiquetas((e) => ({ ...e, [valor]: opcion }));
    });
    return () => {
      vigente = false;
    };
  }, [valor, catalogo, etiquetas]);

  // Búsqueda con una pequeña espera mientras se escribe
  useEffect(() => {
    if (!abierto) return;
    const n = ++pedido.current;
    const t = setTimeout(async () => {
      const ops = await buscar(catalogo, consulta);
      if (n === pedido.current) {
        setOpciones(ops);
        setCargando(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [consulta, abierto, catalogo]);

  const seleccion = valor ? (etiquetas[valor] ?? { codigo: valor, descripcion: "…" }) : null;
  const etiqueta = (o: OpcionCatalogo) =>
    catalogo === "localidad" || !mostrarCodigo ? o.descripcion : `${o.codigo} · ${o.descripcion}`;

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Popover
        open={abierto}
        onOpenChange={(a) => {
          setAbierto(a);
          if (a) setCargando(true);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={abierto}
            aria-invalid={invalido || undefined}
            disabled={disabled}
            className="h-9 min-w-0 flex-1 justify-between font-normal"
          >
            <span className={cn("truncate", !seleccion && "text-muted-foreground")}>
              {seleccion ? etiqueta(seleccion) : placeholder}
            </span>
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Escribí un código o palabras…"
              value={consulta}
              onValueChange={(v) => {
                setConsulta(v);
                setCargando(true);
              }}
            />
            <CommandList>
              {cargando ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Spinner /> Buscando…
                </div>
              ) : (
                <>
                  <CommandEmpty>Sin resultados.</CommandEmpty>
                  <CommandGroup>
                    {opciones.map((o) => (
                      <CommandItem
                        key={o.codigo}
                        value={o.codigo}
                        onSelect={() => {
                          setEtiquetas((e) => ({ ...e, [o.codigo]: o }));
                          onChange(o.codigo, o);
                          setAbierto(false);
                        }}
                      >
                        <CheckIcon className={cn("mt-0.5 self-start", valor === o.codigo ? "opacity-100" : "opacity-0")} />
                        <div className="min-w-0">
                          <div className="line-clamp-2">
                            {catalogo !== "localidad" && mostrarCodigo ? (
                              <span className="mr-1.5 font-mono text-xs font-semibold">{o.codigo}</span>
                            ) : null}
                            {o.descripcion}
                          </div>
                          {o.detalle ? <div className="text-xs text-muted-foreground">{o.detalle}</div> : null}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {valor && !disabled ? (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar" onClick={() => onChange(null, null)}>
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
