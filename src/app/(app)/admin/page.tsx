import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, DatabaseIcon, FileStackIcon, InfoIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { ReiniciarDemo } from "@/components/admin/reiniciar-demo";
import { ListaFeriados, Parametros, TablaCatalogos, TablaUsuarios } from "@/components/admin/secciones";
import { Simulado } from "@/components/comun/badges";
import { EncabezadoPagina, Seccion } from "@/components/comun/pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { contarCatalogos } from "@/lib/datos/catalogos";
import { listarLotes } from "@/lib/datos/srt";
import { listarUsuarios } from "@/lib/datos/usuarios";
import { ROL_INFO } from "@/lib/dominio/constantes";
import { hoy, type FechaISO } from "@/lib/dominio/fechas";
import { ACCIONES, puede } from "@/lib/dominio/permisos";
import { plural } from "@/lib/formato";
import { pendientesDeIntercambio } from "@/lib/operaciones";
import { requerirUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Administración" };

function Cifra({ valor, etiqueta }: { valor: React.ReactNode; etiqueta: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border bg-muted/30 px-3 py-2">
      <span className="text-xl font-semibold tracking-tight">{valor}</span>
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
    </div>
  );
}

export default async function PaginaAdmin() {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const [usuarios, catalogos, legado, feriados, expedientes, lotes, pendientes] = await Promise.all([
    listarUsuarios(db),
    contarCatalogos(db),
    db.query<{
      total: number;
      abiertos: number;
      personas: number;
      compartidas: number;
      desde: number | null;
      hasta: number | null;
    }>(
      `select count(*)::int as total,
              count(*) filter (where abierto)::int as abiertos,
              count(distinct coalesce(cuil, dni, apellido_nombre))::int as personas,
              count(distinct coalesce(cuil, dni)) filter (
                where exists (select 1 from personas p where p.cuil = l.cuil or p.dni = l.dni)
              )::int as compartidas,
              min(anio)::int as desde,
              max(anio)::int as hasta
         from legado_siniestros l`,
    ),
    db.query<{ fecha: FechaISO; descripcion: string }>("select fecha, descripcion from feriados order by fecha"),
    db.query<{ n: number }>("select count(*)::int as n from expedientes"),
    listarLotes(db),
    pendientesDeIntercambio(db),
  ]);

  const sistemaActual = legado.rows[0];
  const puedeReiniciar = puede(usuario.rol, "reiniciar_demo");
  const quienesReinician = ACCIONES.reiniciar_demo.roles.map((r) => ROL_INFO[r].nombre).join(" o ");
  const totalCatalogos = catalogos.reduce((n, c) => n + c.registros, 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Administración"
        descripcion="Usuarios de la demo, catálogos de la SRT, parámetros del sistema y feriados. Todo es de solo lectura, salvo reiniciar los datos de la demo."
      />

      <div className="flex flex-col gap-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-background md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcwIcon className="size-4 text-muted-foreground" aria-hidden />
                Reiniciar la demo
              </CardTitle>
              <CardDescription>
                Vuelve a armar los 20 expedientes de ejemplo con fechas relativas a hoy, para que los plazos, las
                citaciones y las licencias se vean siempre al día. Conviene hacerlo antes de cada presentación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {[
                  "Expedientes en todas las etapas del circuito",
                  "Plazos vencidos, que vencen hoy y próximos",
                  "Citaciones, licencias, rechazos y desistidos",
                  "Comunicaciones con la SRT y dos lotes de intercambio",
                  "Siniestros del sistema actual para la búsqueda",
                  "Los seis usuarios de la demo, uno por rol",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="mt-auto flex-wrap justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Hoy hay {plural(expedientes.rows[0].n, "expediente cargado", "expedientes cargados")}.
              </span>
              {puedeReiniciar ? (
                <ReiniciarDemo expedientes={expedientes.rows[0].n} />
              ) : (
                <span className="text-sm text-muted-foreground">Solo {quienesReinician} puede reiniciar la demo.</span>
              )}
            </CardFooter>
          </Card>

          <Card className="bg-background">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileStackIcon className="size-4 text-muted-foreground" aria-hidden />
                Lotes de intercambio
              </CardTitle>
              <CardDescription>Archivos .AD, .AL y .AZ que se informan a la SRT.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Cifra valor={lotes.length} etiqueta={lotes.length === 1 ? "lote generado" : "lotes generados"} />
              <Cifra valor={pendientes} etiqueta="diagnósticos por informar" />
            </CardContent>
            <CardFooter className="mt-auto">
              <Button asChild variant="outline" size="sm">
                <Link href="/srt?tab=intercambio">
                  Ver los lotes
                  <ArrowRightIcon />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <Seccion
          titulo="Usuarios de la demo"
          descripcion="Un usuario por rol. No hay contraseñas: se elige con quién entrar y se cambia desde el selector «Viendo como»."
        >
          <TablaUsuarios usuarios={usuarios} actualId={usuario.id} />
          <Alert>
            <InfoIcon />
            <AlertTitle>En el sistema real</AlertTitle>
            <AlertDescription>
              Cada persona tiene su usuario con contraseña, y un administrador da de alta y de baja a los usuarios y les
              cambia el rol y el área.
            </AlertDescription>
          </Alert>
        </Seccion>

        <div className="grid gap-8 lg:grid-cols-2">
          <Seccion
            titulo="Catálogos de la SRT"
            descripcion={`Tablas de referencia publicadas por la SRT, copiadas del sistema anterior (${totalCatalogos.toLocaleString("es-AR")} registros). Las localidades son solo de Santiago del Estero.`}
          >
            <TablaCatalogos catalogos={catalogos} />
          </Seccion>

          <Seccion
            titulo={
              <span className="inline-flex flex-wrap items-center gap-2">
                Sistema actual <Simulado />
              </span>
            }
            descripcion="Siniestros registrados en el sistema que la UERT usa hoy."
          >
            <Card className="bg-background">
              <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Cifra valor={sistemaActual.total} etiqueta={sistemaActual.total === 1 ? "siniestro" : "siniestros"} />
                  <Cifra valor={sistemaActual.abiertos} etiqueta={sistemaActual.abiertos === 1 ? "abierto" : "abiertos"} />
                  <Cifra valor={sistemaActual.personas} etiqueta={sistemaActual.personas === 1 ? "persona" : "personas"} />
                  <Cifra
                    valor={
                      sistemaActual.desde && sistemaActual.hasta
                        ? sistemaActual.desde === sistemaActual.hasta
                          ? sistemaActual.desde
                          : `${sistemaActual.desde}–${String(sistemaActual.hasta).slice(2)}`
                        : "—"
                    }
                    etiqueta="años"
                  />
                </div>
                <div className="flex gap-3 text-sm">
                  <DatabaseIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex flex-col gap-2">
                    <p>
                      Los siniestros del sistema actual se consultan
                      desde el sistema nuevo, y la búsqueda unificada los muestra junto a los nuevos, por persona y
                      agrupados por año. Al cargar una denuncia, Mesa de entrada ve los siniestros abiertos de la persona
                      en los dos sistemas.
                    </p>
                    <p className="text-muted-foreground">
                      En la demo, el sistema actual está simulado con {plural(sistemaActual.total, "siniestro")}{" "}
                      {sistemaActual.total === 1 ? "ficticio" : "ficticios"}
                      {sistemaActual.compartidas
                        ? `; ${plural(sistemaActual.compartidas, "persona tiene", "personas tienen")} también expedientes en el sistema nuevo`
                        : ""}
                      .
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" size="sm">
                  <Link href="/buscar?q=juarez">
                    <SearchIcon />
                    Probar la búsqueda unificada
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </Seccion>
        </div>

        <Seccion
          titulo="Parámetros"
          descripcion="Valores con los que el sistema calcula los plazos y arma los datos que se informan a la SRT. Son de solo lectura: los marcados «A confirmar» están pendientes de validación con la UERT o la SRT."
        >
          <Parametros />
        </Seccion>

        <Seccion
          titulo="Feriados cargados"
          descripcion={`${plural(feriados.rows.length, "feriado")} para contar los días hábiles de los plazos (área legal, Comisión Médica).`}
        >
          <Alert className="border-amber-200 bg-amber-50/60">
            <InfoIcon className="text-amber-700" />
            <AlertTitle>Faltan los feriados trasladables</AlertTitle>
            <AlertDescription>
              Solo se cargaron los feriados nacionales de fecha fija, Carnaval y Viernes Santo. Hay que sumar los
              trasladables de cada año para que los plazos en días hábiles sean exactos.
            </AlertDescription>
          </Alert>
          <ListaFeriados feriados={feriados.rows} hoy={hoy()} />
        </Seccion>
      </div>
    </>
  );
}
