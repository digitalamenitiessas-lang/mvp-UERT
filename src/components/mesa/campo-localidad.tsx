"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { OpcionCatalogo } from "@/lib/datos/catalogos";
import { conBase } from "@/lib/rutas";
import { cn } from "@/lib/utils";

async function buscarLocalidades(q: string): Promise<OpcionCatalogo[]> {
  const r = await fetch(conBase(`/api/catalogos/localidad?q=${encodeURIComponent(q)}`));
  if (!r.ok) return [];
  return r.json();
}

async function nombreLocalidad(id: number): Promise<string | null> {
  const r = await fetch(conBase(`/mesa/localidades/${id}`));
  if (!r.ok) return null;
  const opcion = (await r.json()) as OpcionCatalogo;
  return opcion.descripcion ?? null;
}

/**
 * Combo con buscador de localidades (catálogo de la SRT). Igual que
 * CampoCatalogo con catalogo="localidad", pero muestra el nombre de una
 * localidad precargada por id (persona ya registrada o denuncia en edición).
 */
export function CampoLocalidad({
  id,
  valor,
  etiqueta,
  onChange,
  onEtiqueta,
  invalido,
  disabled,
  placeholder = "Buscar localidad…",
}: {
  id?: string;
  valor: number | null;
  /** Nombre ya conocido de la localidad elegida. */
  etiqueta?: string | null;
  onChange: (id: number | null, nombre: string | null) => void;
  /** Avisa el nombre de una localidad precargada cuando se obtiene. */
  onEtiqueta?: (id: number, nombre: string) => void;
  invalido?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [opciones, setOpciones] = useState<OpcionCatalogo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [resueltas, setResueltas] = useState<Record<number, string>>({});
  const pedido = useRef(0);

  const nombre = valor === null ? null : (etiqueta ?? resueltas[valor] ?? null);

  // Nombre de la localidad precargada
  useEffect(() => {
    if (valor === null || nombre) return;
    let vigente = true;
    nombreLocalidad(valor)
      .then((n) => {
        if (!vigente || !n) return;
        setResueltas((r) => ({ ...r, [valor]: n }));
        onEtiqueta?.(valor, n);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [valor, nombre, onEtiqueta]);

  // Búsqueda con una pequeña espera mientras se escribe
  useEffect(() => {
    if (!abierto) return;
    const n = ++pedido.current;
    const t = setTimeout(async () => {
      const ops = await buscarLocalidades(consulta).catch(() => []);
      if (n === pedido.current) {
        setOpciones(ops);
        setCargando(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [consulta, abierto]);

  return (
    <div className="flex min-w-0 items-center gap-1">
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
            <span className={cn("truncate", !nombre && "text-muted-foreground")}>
              {valor === null ? placeholder : (nombre ?? "Cargando…")}
            </span>
            <ChevronsUpDownIcon className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Escribí el nombre o el código postal…"
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
                    {opciones.map((o) => {
                      const idOpcion = Number(o.codigo);
                      return (
                        <CommandItem
                          key={o.codigo}
                          value={o.codigo}
                          onSelect={() => {
                            setResueltas((r) => ({ ...r, [idOpcion]: o.descripcion }));
                            onChange(idOpcion, o.descripcion);
                            setAbierto(false);
                          }}
                        >
                          <CheckIcon className={cn("mt-0.5 self-start", valor === idOpcion ? "opacity-100" : "opacity-0")} />
                          <div className="min-w-0">
                            <div className="line-clamp-2">{o.descripcion}</div>
                            {o.detalle ? <div className="text-xs text-muted-foreground">{o.detalle}</div> : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {valor !== null && !disabled ? (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Quitar la localidad" onClick={() => onChange(null, null)}>
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
