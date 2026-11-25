import Link from "next/link";
import { FolderSearchIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** Expediente inexistente (o borrado al reiniciar los datos de la demo). */
export default function ExpedienteNoEncontrado() {
  return (
    <Empty className="rounded-xl border border-dashed bg-background py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderSearchIcon />
        </EmptyMedia>
        <EmptyTitle className="text-base">No encontramos ese expediente</EmptyTitle>
        <EmptyDescription>
          Puede que el número de la dirección esté mal escrito o que el expediente ya no exista, por ejemplo si se
          reiniciaron los datos de la demo.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        <Button asChild>
          <Link href="/expedientes">
            <FolderSearchIcon />
            Ver todos los expedientes
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/buscar">
            <SearchIcon />
            Búsqueda unificada
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
