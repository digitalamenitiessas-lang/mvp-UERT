import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LockIcon } from "lucide-react";
import { EstadoBadge } from "@/components/comun/badges";
import { EncabezadoPagina } from "@/components/comun/pagina";
import { FormularioDenuncia } from "@/components/mesa/formulario-denuncia";
import { claveEtiqueta, type Entrada } from "@/components/mesa/modelo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { obtenerFicha, type ExpedienteFicha } from "@/lib/datos/expedientes";
import { ESTADO_INFO } from "@/lib/dominio/constantes";
import { hoy } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { formatoCuil } from "@/lib/dominio/validaciones";
import { requerirUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Editar denuncia" };

/** Valores del formulario a partir de la ficha del expediente. */
function valoresDe(ficha: ExpedienteFicha): Entrada {
  const e = ficha.expediente;
  const p = ficha.persona;
  const conDenunciante = e.denunciante_tipo !== "trabajador";
  return {
    tipo: e.tipo,
    cuil: formatoCuil(p.cuil),
    dni: p.dni,
    apellido: p.apellido,
    nombres: p.nombres,
    fecha_nacimiento: p.fecha_nacimiento ?? "",
    sexo: p.sexo ?? "",
    telefono: p.telefono ?? "",
    email: p.email ?? "",
    domicilio: p.domicilio ?? "",
    localidad_id: p.localidad_id,
    canal: e.canal,
    denunciante_tipo: e.denunciante_tipo,
    denunciante_nombre: conDenunciante ? (e.denunciante_nombre ?? "") : "",
    denunciante_email: conDenunciante ? (e.denunciante_email ?? "") : "",
    denunciante_telefono: conDenunciante ? (e.denunciante_telefono ?? "") : "",
    reparticion: e.reparticion,
    domicilio_laboral: e.domicilio_laboral ?? "",
    localidad_laboral_id: e.localidad_laboral_id,
    puesto: e.puesto ?? "",
    ciuo: e.ciuo ?? "",
    tareas: e.tareas ?? "",
    antiguedad_empresa: e.antiguedad_empresa ?? "",
    antiguedad_area: e.antiguedad_area ?? "",
    desvinculado: e.desvinculado,
    fecha_ocurrencia: e.fecha_ocurrencia ?? "",
    hora_ocurrencia: e.hora_ocurrencia ? e.hora_ocurrencia.slice(0, 5) : "",
    lugar_ocurrencia: e.lugar_ocurrencia ?? "",
    localidad_ocurrencia_id: e.localidad_ocurrencia_id,
    descripcion: e.descripcion ?? "",
    forma_accidente: e.forma_accidente ?? "",
    agente_material: e.agente_material ?? "",
    trayecto: e.trayecto ?? "",
    pluriempleo: !!e.pluriempleo,
    cuits_pluriempleo: (e.cuits_pluriempleo ?? []).map((c) => formatoCuil(c)),
    obligada_pago: e.pluriempleo ? e.obligada_pago : null,
    exposicion_desde: e.exposicion_desde ?? "",
    exposicion_hasta: e.exposicion_hasta ?? "",
    // En recepción todos los diagnósticos están invocados: la edición los reemplaza.
    diagnosticos: ficha.diagnosticos
      .filter((d) => d.estado === "invocado")
      .map((d) => ({ cie10: d.cie10, agente_causante: d.agente_causante ?? "" })),
    documentos: [],
    // La edición no cambia el vínculo con otro siniestro.
    origen_id: e.es_intercurrencia ? e.origen_id : null,
    es_intercurrencia: e.es_intercurrencia,
    confirmo_hecho_distinto: true,
  };
}

/** Descripciones de los códigos ya cargados, para mostrarlas sin volver a buscarlas. */
function etiquetasDe(ficha: ExpedienteFicha): Record<string, string> {
  const e = ficha.expediente;
  const p = ficha.persona;
  const etiquetas: Record<string, string> = {};
  const poner = (catalogo: string, codigo: string | number | null, descripcion: string | null) => {
    if (codigo !== null && codigo !== "" && descripcion) etiquetas[claveEtiqueta(catalogo, codigo)] = descripcion;
  };
  poner("localidad", p.localidad_id, p.localidad);
  poner("localidad", e.localidad_laboral_id, ficha.localidad_laboral);
  poner("localidad", e.localidad_ocurrencia_id, ficha.localidad_ocurrencia);
  poner("ciuo88", e.ciuo, ficha.ciuo_descripcion);
  poner("forma_accidente", e.forma_accidente, ficha.forma_accidente_descripcion);
  poner("agente_material", e.agente_material, ficha.agente_material_descripcion);
  for (const d of ficha.diagnosticos) {
    poner("cie10", d.cie10, d.cie10_descripcion);
    poner("agente_causante", d.agente_causante, d.agente_descripcion);
  }
  return etiquetas;
}

/** Corrección de los datos de una denuncia mientras está en Mesa de entrada (RNF-01). */
export default async function EditarDenuncia({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requerirUsuario();
  // Entero positivo que entra en un int de Postgres (igual que la ficha)
  const numero = /^\d{1,9}$/.test(id) ? Number(id) : 0;
  if (numero <= 0) notFound();
  const ficha = await obtenerFicha(await getDb(), numero);
  if (!ficha) notFound();
  const exp = ficha.expediente;
  const volver = { href: `/expedientes/${exp.id}`, texto: `Volver al expediente ${exp.numero}` };

  if (!puede(usuario.rol, "editar_denuncia", exp.estado)) {
    return (
      <>
        <EncabezadoPagina titulo={`Editar denuncia ${exp.numero}`} volver={volver} />
        <Alert className="max-w-2xl">
          <LockIcon />
          <AlertTitle>Esta denuncia no se puede editar</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            {usuario.rol !== "mesa_entrada" ? (
              <p>Los datos de la denuncia los corrige Mesa de entrada.</p>
            ) : (
              <p className="flex flex-wrap items-center gap-1.5">
                Los datos se corrigen solo mientras la denuncia está en Mesa de entrada. Este expediente está en
                estado <EstadoBadge estado={exp.estado} />.
              </p>
            )}
            <div>
              <Link href={volver.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Ir a la ficha
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const vinculo = ficha.origen
    ? `${exp.es_reingreso ? "Reingreso" : exp.es_intercurrencia ? "Intercurrencia" : "Vinculado"} del siniestro ${ficha.origen.numero}`
    : null;

  return (
    <>
      <EncabezadoPagina
        titulo={`Editar denuncia ${exp.numero}`}
        descripcion={`${ficha.persona.apellido}, ${ficha.persona.nombres} · ${ESTADO_INFO[exp.estado].descripcion}`}
        volver={volver}
      />
      <FormularioDenuncia
        modo="editar"
        hoy={hoy()}
        expedienteId={exp.id}
        valoresIniciales={valoresDe(ficha)}
        etiquetasIniciales={etiquetasDe(ficha)}
        vinculo={vinculo}
      />
    </>
  );
}
