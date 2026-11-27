import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon, FolderSearchIcon } from "lucide-react";
import { Marca } from "@/components/app/marca";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página no encontrada" };

/** 404 de toda la aplicación (también se usa cuando una ruta llama a notFound()). */
export default function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Link href="/" aria-label="UERT · Ir al inicio">
        <Marca sobre="claro" />
      </Link>
      <div className="flex w-full flex-col items-center gap-3 rounded-xl border bg-background px-6 py-10 shadow-xs">
        <p className="font-mono text-5xl font-semibold tracking-tight text-primary">404</p>
        <h1 className="text-xl font-semibold tracking-tight">No encontramos esta página</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Puede que la dirección esté mal escrita o que lo que buscás ya no exista, por ejemplo si se reiniciaron los
          datos de la demo.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">
              <ArrowLeftIcon />
              Ir al inicio
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/expedientes">
              <FolderSearchIcon />
              Ver expedientes
            </Link>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Unidad Ejecutora de Riesgos del Trabajo · Provincia de Santiago del Estero
      </p>
    </main>
  );
}
