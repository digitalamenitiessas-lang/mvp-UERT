"use client";

import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/** Búsqueda unificada desde cualquier pantalla (RF-02). */
export function Buscador() {
  const router = useRouter();
  return (
    <form
      role="search"
      className="w-full max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        if (q) router.push(`/buscar?q=${encodeURIComponent(q)}`);
      }}
    >
      <InputGroup className="h-9 bg-background">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput name="q" placeholder="Nombre, DNI, CUIL o N° de siniestro" aria-label="Buscar" />
      </InputGroup>
    </form>
  );
}
