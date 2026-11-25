import Form from "next/form";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

/**
 * Formulario de la búsqueda unificada. Es un GET a /buscar: el resultado
 * queda en la URL y se puede compartir o volver atrás.
 */
export function FormularioBusqueda({ q }: { q: string }) {
  return (
    <Form action="/buscar" role="search" className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
      <InputGroup className="h-10 bg-background">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          key={q}
          name="q"
          type="search"
          defaultValue={q}
          autoComplete="off"
          placeholder="Apellido y nombre, DNI, CUIL o N° de siniestro"
          aria-label="Buscar por apellido y nombre, DNI, CUIL o número de siniestro"
        />
      </InputGroup>
      <Button type="submit" className="h-10 px-4">
        <SearchIcon />
        Buscar
      </Button>
    </Form>
  );
}
