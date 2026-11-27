import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import { Simulado } from "@/components/comun/badges";
import { EncabezadoPagina } from "@/components/comun/pagina";
import { FormularioBusqueda } from "@/components/busqueda/formulario-busqueda";
import { ORIGEN_INFO, ResultadoPersona } from "@/components/busqueda/resultado-persona";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getDb } from "@/lib/db";
import { buscarIncidentes } from "@/lib/datos/busqueda";
import { listarExpedientes } from "@/lib/datos/expedientes";
import { UERT } from "@/lib/dominio/constantes";
import { parsearNumero } from "@/lib/dominio/numeracion";
import { plural } from "@/lib/formato";
import { requerirUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Búsqueda unificada" };

const EJEMPLOS = [
  { q: "juarez", texto: "Juárez", detalle: "en los dos sistemas" },
  { q: "99000106", texto: "DNI 99.000.106", detalle: "solo en el sistema actual" },
  { q: "toledo", texto: "Toledo", detalle: "con un reingreso" },
];

/**
 * Si la consulta es un número de siniestro lo devuelve como AAAA-NNNNNN-SS.
 * Acepta también los 12 dígitos sin guiones y el número de 20 posiciones de la
 * SRT (con el prefijo de la UERT).
 */
function comoNumeroSiniestro(q: string): string | null {
  if (parsearNumero(q)) return q;
  if (!/^[\d\s.-]+$/.test(q)) return null;
  const d = q.replace(/\D/g, "");
  const doce = d.length === 12 ? d : d.length === 20 && d.startsWith(UERT.prefijoSiniestro) ? d.slice(8) : null;
  return doce ? `${doce.slice(0, 4)}-${doce.slice(4, 10)}-${doce.slice(10)}` : null;
}

function Ejemplos() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {EJEMPLOS.map((e) => (
        <Link
          key={e.q}
          href={`/buscar?q=${encodeURIComponent(e.q)}`}
          className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <span className="font-medium">{e.texto}</span>
          <span className="text-xs text-muted-foreground">{e.detalle}</span>
        </Link>
      ))}
    </div>
  );
}

export default async function PaginaBuscar({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requerirUsuario();
  const sp = await searchParams;
  const q = ((Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "").trim().slice(0, 100);
  const db = await getDb();

  // Con un número de siniestro existente se va directo a la ficha.
  const numero = q ? comoNumeroSiniestro(q) : null;
  if (numero) {
    const filas = await listarExpedientes(db, { texto: numero, limite: 5 });
    const exacto = filas.find((f) => f.numero === numero);
    if (exacto) redirect(`/expedientes/${exacto.id}`);
  }

  const personas = q.length >= 3 ? await buscarIncidentes(db, q) : [];
  const incidentes = personas.flatMap((p) => p.incidentes);
  const nuevos = incidentes.filter((i) => i.origen === "nuevo").length;
  const actuales = incidentes.length - nuevos;

  // Descripción de los códigos CIE-10 del sistema nuevo (el actual ya trae el texto).
  const codigos = [
    ...new Set(
      incidentes
        .filter((i) => i.origen === "nuevo" && i.diagnostico)
        .flatMap((i) => (i.diagnostico ?? "").split(",").map((c) => c.trim()))
        .filter(Boolean),
    ),
  ];
  const descripciones: Record<string, string> = codigos.length
    ? Object.fromEntries(
        (
          await db.query<{ codigo: string; descripcion: string }>(
            "select codigo, descripcion from cat_cie10 where codigo = any($1)",
            [codigos],
          )
        ).rows.map((r) => [r.codigo, r.descripcion]),
      )
    : {};

  return (
    <>
      <EncabezadoPagina
        titulo="Búsqueda unificada"
        descripcion="Todos los siniestros de una persona, del sistema nuevo y del que la UERT usa hoy, agrupados por año. Buscá por apellido y nombre, DNI, CUIL o número de siniestro del sistema actual (por ejemplo, AT-2021-0233); con un número de este sistema (AAAA-NNNNNN-SS) se abre directamente el expediente."
      >
        <div data-recorrido="formulario-busqueda">
          <FormularioBusqueda q={q} />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-primary" />
            {ORIGEN_INFO.nuevo.nombre}: expedientes cargados en este sistema.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-stone-400" />
            {ORIGEN_INFO.actual.nombre}: siniestros del sistema que la UERT usa hoy.
          </span>
          <Simulado texto="Sistema actual simulado" />
        </p>
      </EncabezadoPagina>

      {!q ? (
        <Empty className="rounded-lg border border-dashed bg-background py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>¿A quién buscás?</EmptyTitle>
            <EmptyDescription>
              Escribí el apellido y nombre, el DNI o el CUIL de la persona. Probá con alguno de estos casos de la demo:
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-xl">
            <Ejemplos />
          </EmptyContent>
        </Empty>
      ) : q.length < 3 ? (
        <Empty className="rounded-lg border border-dashed bg-background py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>Escribí al menos 3 caracteres</EmptyTitle>
            <EmptyDescription>Con menos letras o números la búsqueda traería demasiados resultados.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
          {numero ? (
            <Alert className="border-amber-200 bg-amber-50/60">
              <TriangleAlertIcon className="text-amber-700" />
              <AlertTitle>No hay un expediente con el número {numero}</AlertTitle>
              <AlertDescription>
                Revisá el número o buscá por apellido, DNI o CUIL. Los números del sistema actual tienen otro formato (por
                ejemplo, AT-2021-0233) y también se pueden buscar.
              </AlertDescription>
            </Alert>
          ) : null}

          {personas.length ? (
            <>
              <p className="text-sm text-muted-foreground" role="status">
                {plural(personas.length, "persona")} con {plural(incidentes.length, "siniestro")} para «{q}»:{" "}
                {nuevos} en el sistema nuevo y {actuales} en el sistema actual.
              </p>
              {personas.map((p) => (
                <ResultadoPersona key={p.clave} persona={p} descripciones={descripciones} />
              ))}
            </>
          ) : numero ? null : (
            <Empty className="rounded-lg border border-dashed bg-background py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>Sin resultados para «{q}»</EmptyTitle>
                <EmptyDescription>
                  No hay personas con ese nombre, DNI, CUIL o número de siniestro en ninguno de los dos sistemas. Revisá cómo está escrito o
                  probá con otro dato.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="max-w-xl">
                <Ejemplos />
              </EmptyContent>
            </Empty>
          )}
        </div>
      )}
    </>
  );
}
