import type { Metadata } from "next";
import Link from "next/link";
import { LockIcon } from "lucide-react";
import { EncabezadoPagina } from "@/components/comun/pagina";
import { FormularioDenuncia } from "@/components/mesa/formulario-denuncia";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ROL_INFO } from "@/lib/dominio/constantes";
import { hoy } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { requerirUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Nueva denuncia" };

/** Carga de una denuncia nueva (Mesa de entrada). */
export default async function NuevaDenuncia() {
  const usuario = await requerirUsuario();

  if (!puede(usuario.rol, "crear_denuncia")) {
    return (
      <>
        <EncabezadoPagina titulo="Nueva denuncia" volver={{ href: ROL_INFO[usuario.rol].inicio, texto: "Volver" }} />
        <Alert className="max-w-2xl">
          <LockIcon />
          <AlertTitle>Las denuncias las carga Mesa de entrada</AlertTitle>
          <AlertDescription>
            <p>
              Estás viendo el sistema como {ROL_INFO[usuario.rol].nombre}. Para cargar una denuncia cambiá a Mesa de
              entrada desde el selector “Viendo como”, arriba a la derecha, o volvé a{" "}
              <Link href={ROL_INFO[usuario.rol].inicio}>tu bandeja</Link>.
            </p>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Nueva denuncia"
        descripcion="Cargá la denuncia en un único formulario con solapas. Al registrarla se asigna el número de siniestro y se emite la constancia de recepción."
        volver={{ href: "/mesa", texto: "Volver a la bandeja" }}
      />
      <FormularioDenuncia modo="nueva" hoy={hoy()} />
    </>
  );
}
