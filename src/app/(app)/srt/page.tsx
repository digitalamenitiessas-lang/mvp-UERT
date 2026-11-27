import type { Metadata } from "next";
import Link from "next/link";
import {
  BellIcon,
  CalendarClockIcon,
  FileStackIcon,
  KeyRoundIcon,
  ListChecksIcon,
  ServerIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { Simulado } from "@/components/comun/badges";
import { EncabezadoPagina, Seccion } from "@/components/comun/pagina";
import { BotonGenerarLote } from "@/components/srt/boton-generar-lote";
import { CANAL_SRT } from "@/components/srt/canales";
import { ARCHIVO_INFO, EjemploRegistro, TablaLayout, TarjetaLote } from "@/components/srt/intercambio";
import { ListaNotificaciones, ListaWebService } from "@/components/srt/lista-comunicaciones";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDb } from "@/lib/db";
import { listarComunicaciones, listarLotes, type ComunicacionFila } from "@/lib/datos/srt";
import { FODEP_ESTADOS, MAX_DIAGNOSTICOS_EP, ROL_INFO, UERT } from "@/lib/dominio/constantes";
import { ACCIONES, puede } from "@/lib/dominio/permisos";
import { pendientesDeIntercambio } from "@/lib/operaciones";
import { requerirUsuario } from "@/lib/sesion";
import { ERRORES_FODEP } from "@/lib/srt/fodep";
import { LARGO, LAYOUT_AD, LAYOUT_AL, LAYOUT_AZ, nombreArchivo } from "@/lib/srt/intercambio";
import type { ComunicacionSRT } from "@/lib/tipos";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Comunicación con la SRT" };

type Pestana = "ws" | "notificaciones" | "intercambio";
const PESTANAS: readonly string[] = ["ws", "notificaciones", "intercambio"];

function valor(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Link de filtro con estilo de "chip"; el activo queda marcado para lectores de pantalla. */
function Filtro({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors",
        activo
          ? "border-primary/30 bg-primary/10 font-medium text-primary"
          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function Contador({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn("rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums", className)}>
      {n}
    </span>
  );
}

function TarjetaInfo({
  icono: Icono,
  titulo,
  children,
}: {
  icono: LucideIcon;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm" className="bg-background">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icono className="size-4 text-muted-foreground" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

type ConteoCanal = { canal: ComunicacionSRT["canal"]; total: number; errores: number };

export default async function PaginaSrt({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const usuario = await requerirUsuario();
  const sp = await searchParams;
  const pestana: Pestana = PESTANAS.includes(valor(sp.tab)) ? (valor(sp.tab) as Pestana) : "ws";
  const soloErrores = valor(sp.errores) === "1";
  const canalNotif = ["eservicios", "ventanilla"].includes(valor(sp.canal))
    ? (valor(sp.canal) as "eservicios" | "ventanilla")
    : null;

  // Acá solo los contadores de las solapas: cada solapa lee sus datos cuando es la elegida.
  const db = await getDb();
  const [conteosFilas, cantidadLotes] = await Promise.all([
    db.query<ConteoCanal>(
      `select canal, count(*)::int as total, count(*) filter (where not ok)::int as errores
         from srt_comunicaciones group by canal`,
    ),
    db.query<{ n: number }>("select count(*)::int as n from intercambio_lotes"),
  ]);
  const conteo = (canal: ComunicacionSRT["canal"]): ConteoCanal =>
    conteosFilas.rows.find((r) => r.canal === canal) ?? { canal, total: 0, errores: 0 };
  const wsConteo = conteo("ws_fodep");
  const notificaciones = { eservicios: conteo("eservicios").total, ventanilla: conteo("ventanilla").total };
  const totalNotificaciones = notificaciones.eservicios + notificaciones.ventanilla;

  return (
    <>
      <EncabezadoPagina
        titulo={
          <span className="inline-flex flex-wrap items-center gap-2">
            Comunicación con la SRT <Simulado />
          </span>
        }
        descripcion="Todo lo que el sistema informa a la SRT y notifica al trabajador y al empleador. En la demo no hay conexión real: se arma el mismo contenido que se enviaría, se valida con las reglas publicadas por la SRT y queda registrado acá."
      />

      {/* Cada solapa es un link a ?tab=: se arma solo la que se está viendo */}
      <Tabs value={pestana} className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit" data-recorrido="pestanas-srt">
          <TabsTrigger value="ws" className="px-2.5" asChild>
            <Link href="/srt?tab=ws" scroll={false}>
              <ServerIcon className="hidden size-4 sm:block" aria-hidden />
              <span className="sm:hidden">WS FODEP</span>
              <span className="hidden sm:inline">Web Service FODEP</span>
              <Contador n={wsConteo.total} className="hidden sm:inline" />
            </Link>
          </TabsTrigger>
          <TabsTrigger value="notificaciones" className="px-2.5" asChild>
            <Link href="/srt?tab=notificaciones" scroll={false}>
              <BellIcon className="hidden size-4 sm:block" aria-hidden />
              Notificaciones
              <Contador n={totalNotificaciones} className="hidden sm:inline" />
            </Link>
          </TabsTrigger>
          <TabsTrigger value="intercambio" className="px-2.5" asChild>
            <Link href="/srt?tab=intercambio" scroll={false}>
              <FileStackIcon className="hidden size-4 sm:block" aria-hidden />
              <span className="sm:hidden">Intercambio</span>
              <span className="hidden sm:inline">Sistema de Intercambio</span>
              <Contador n={cantidadLotes.rows[0]?.n ?? 0} className="hidden sm:inline" />
            </Link>
          </TabsTrigger>
        </TabsList>

        {pestana === "ws" ? (
          <PestanaWebService soloErrores={soloErrores} conteo={wsConteo} />
        ) : pestana === "notificaciones" ? (
          <PestanaNotificaciones canal={canalNotif} conteos={notificaciones} />
        ) : (
          <PestanaIntercambio puedeGenerar={puede(usuario.rol, "generar_intercambio")} />
        )}
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------------------
// Web Service FODEP
// ---------------------------------------------------------------------------
async function PestanaWebService({ soloErrores, conteo: wsConteo }: { soloErrores: boolean; conteo: ConteoCanal }) {
  const ws = await listarComunicaciones(await getDb(), { canal: "ws_fodep", soloErrores, limite: 200 });
  return (
    <TabsContent value="ws" className="flex flex-col gap-6 pt-2">
      <div className="grid gap-3 md:grid-cols-3">
        <TarjetaInfo icono={ServerIcon} titulo="Ambientes de la SRT">
          <dl className="flex flex-col gap-2">
            <div>
              <dt className="text-xs text-muted-foreground">Prueba</dt>
              <dd className="font-mono text-sm">testws.srt.gob.ar</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Producción</dt>
              <dd className="font-mono text-sm">serviciosweb.srt.gob.ar</dd>
            </div>
          </dl>
        </TarjetaInfo>
        <TarjetaInfo icono={KeyRoundIcon} titulo="Autenticación">
          <p>Certificado digital x.509 de la UERT y ticket de acceso.</p>
          <p className="mt-2 text-muted-foreground">
            Todavía faltan el certificado y el WSDL definitivo: por eso la demo simula las respuestas con las
            validaciones de la especificación (WS FODEP v1.0).
          </p>
        </TarjetaInfo>
        <TarjetaInfo icono={ListChecksIcon} titulo="Operaciones que usa el sistema">
          <ul className="flex flex-col gap-1.5">
            <li>
              <span className="font-mono text-xs font-medium">AltaDenunciaEP</span>
              <span className="block text-muted-foreground">Alta de la denuncia; devuelve el N° de formulario FODEP.</span>
            </li>
            <li>
              <span className="font-mono text-xs font-medium">AltaDiagnosticosEP</span>
              <span className="block text-muted-foreground">
                Diagnósticos con su agente causante (hasta {MAX_DIAGNOSTICOS_EP}).
              </span>
            </li>
            <li>
              <span className="font-mono text-xs font-medium">CambiarEstado</span>
              <span className="block text-muted-foreground">
                Estado del formulario ({Object.values(FODEP_ESTADOS).length} estados simulados: falta la tabla oficial).
              </span>
            </li>
          </ul>
        </TarjetaInfo>
      </div>

      <Seccion
        recorrido="llamadas-ws"
        titulo="Llamadas al Web Service"
        descripcion={`${CANAL_SRT.ws_fodep.descripcion} Las denuncias rechazadas quedan registradas con el código de error FO de la SRT.`}
        acciones={
          <nav aria-label="Filtrar llamadas al Web Service" className="flex flex-wrap gap-1.5">
            <Filtro href="/srt?tab=ws" activo={!soloErrores}>
              Todas <Contador n={wsConteo.total} />
            </Filtro>
            <Filtro href="/srt?tab=ws&errores=1" activo={soloErrores}>
              Solo errores <Contador n={wsConteo.errores} />
            </Filtro>
          </nav>
        }
      >
        <ListaWebService
          filas={ws}
          vacio={
            soloErrores
              ? { titulo: "Sin errores", descripcion: "La SRT no rechazó ninguna denuncia." }
              : {
                  titulo: "Todavía no hay llamadas",
                  descripcion: "Las denuncias de enfermedad profesional se informan al pasar al área médica.",
                }
          }
        />
      </Seccion>

      <details className="rounded-lg border bg-background px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium select-none">
          Códigos de error que valida la demo ({Object.keys(ERRORES_FODEP).length})
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-20">Código</TableHead>
                  <TableHead>Mensaje de la SRT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(ERRORES_FODEP).map(([codigo, mensaje]) => (
                  <TableRow key={codigo}>
                    <TableCell className="font-mono text-xs font-medium">{codigo}</TableCell>
                    <TableCell className="whitespace-normal">{mensaje}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            FO22 (relación entre el CIE-10 y el agente causante) queda pendiente: falta la tabla de la SRT.
          </p>
        </div>
      </details>
    </TabsContent>
  );
}

// ---------------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------------
async function PestanaNotificaciones({
  canal: canalNotif,
  conteos,
}: {
  canal: "eservicios" | "ventanilla" | null;
  conteos: { eservicios: number; ventanilla: number };
}) {
  const db = await getDb();
  const [eservicios, ventanilla] = await Promise.all([
    canalNotif === "ventanilla" ? [] : listarComunicaciones(db, { canal: "eservicios", limite: 200 }),
    canalNotif === "eservicios" ? [] : listarComunicaciones(db, { canal: "ventanilla", limite: 200 }),
  ]);
  const notificaciones: ComunicacionFila[] = [...eservicios, ...ventanilla].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime() || b.id - a.id,
  );
  const totalNotificaciones = conteos.eservicios + conteos.ventanilla;
  const conteo = (canal: "eservicios" | "ventanilla") => ({ total: conteos[canal] });
  return (
    <TabsContent value="notificaciones" className="flex flex-col gap-6 pt-2">
      <div className="grid gap-3 md:grid-cols-2">
        <TarjetaInfo icono={BellIcon} titulo="Al trabajador">
          <p>
            Por <strong className="font-medium">e-Servicios SRT</strong> y al email informado en el formulario
            (Anexo II, punto 1.6): citaciones, rechazos y avisos del trámite.
          </p>
        </TarjetaInfo>
        <TarjetaInfo icono={BellIcon} titulo="Al empleador">
          <p>
            Por <strong className="font-medium">Ventanilla Electrónica</strong> (Anexo II, punto 4.1), a la repartición
            donde trabaja la persona.
          </p>
        </TarjetaInfo>
      </div>

      <Seccion
        titulo="Notificaciones enviadas"
        descripcion="Cada notificación guarda el mensaje completo tal como se enviaría."
        acciones={
          <nav aria-label="Filtrar notificaciones" className="flex flex-wrap gap-1.5">
            <Filtro href="/srt?tab=notificaciones" activo={!canalNotif}>
              Todas <Contador n={totalNotificaciones} />
            </Filtro>
            <Filtro href="/srt?tab=notificaciones&canal=eservicios" activo={canalNotif === "eservicios"}>
              Al trabajador <Contador n={conteo("eservicios").total} />
            </Filtro>
            <Filtro href="/srt?tab=notificaciones&canal=ventanilla" activo={canalNotif === "ventanilla"}>
              Al empleador <Contador n={conteo("ventanilla").total} />
            </Filtro>
          </nav>
        }
      >
        <ListaNotificaciones
          filas={notificaciones}
          vacio={{
            titulo: "Sin notificaciones",
            descripcion: "Todavía no se envió ninguna notificación por este canal.",
          }}
        />
      </Seccion>
    </TabsContent>
  );
}

// ---------------------------------------------------------------------------
// Sistema de Intercambio
// ---------------------------------------------------------------------------
async function PestanaIntercambio({ puedeGenerar }: { puedeGenerar: boolean }) {
  const db = await getDb();
  const [lotes, pendientes] = await Promise.all([listarLotes(db), pendientesDeIntercambio(db)]);
  const quienesGeneran = ACCIONES.generar_intercambio.roles.map((r) => ROL_INFO[r].nombre).join(" o ");
  const ultimoLote = lotes[0];
  const lineaEjemplo = ultimoLote?.archivos
    .find((a) => a.extension === "AD")
    ?.contenido.split("\r\n")
    .find((l) => l.length === LARGO.AD);
  return (
    <TabsContent value="intercambio" className="flex flex-col gap-8 pt-2">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-background lg:col-span-2">
          <CardHeader>
            <CardTitle>Cómo viajan los diagnósticos</CardTitle>
            <CardDescription>
              Con FODEP, los campos de diagnóstico, lesión y zona del cuerpo de los archivos .AT (accidentes) y .EF
              (enfermedades profesionales) van vacíos. Esa información viaja en tres archivos nuevos de ancho fijo,
              vinculados por el Número Único de Diagnóstico.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="grid gap-2 sm:grid-cols-3">
              {(["AD", "AL", "AZ"] as const).map((ext) => (
                <li key={ext} className="flex flex-col gap-0.5 rounded-lg border bg-muted/30 px-3 py-2.5">
                  <span className="font-mono text-base font-semibold">.{ext}</span>
                  <span className="text-sm font-medium">{ARCHIVO_INFO[ext].nombre}</span>
                  <span className="text-xs text-muted-foreground">{LARGO[ext]} posiciones por registro</span>
                </li>
              ))}
            </ul>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                Se informan los diagnósticos evaluados por el área médica (con zonas del cuerpo y, en accidentes,
                lesiones). Si después cambian, se reenvían con tipo de operación M.
              </li>
              <li>
                Nombre de los archivos: ARTcartn.XXn (CART {UERT.cart}, n = número de parte), por ejemplo{" "}
                <span className="font-mono text-foreground">{nombreArchivo(UERT.cart, "AD")}</span>.
              </li>
              <li>
                En la SRT el intercambio corre de lunes a viernes por la noche y la respuesta se publica el día
                hábil siguiente.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClockIcon className="size-4 text-muted-foreground" aria-hidden />
              Próximo lote
            </CardTitle>
            <CardDescription>Diagnósticos nuevos o modificados desde el último lote.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            <div>
              <span className="text-4xl font-semibold tracking-tight">{pendientes}</span>
              <span className="ml-2 text-sm text-muted-foreground">
                {pendientes === 1 ? "diagnóstico por informar" : "diagnósticos por informar"}
              </span>
            </div>
            {puedeGenerar ? (
              <div className="flex flex-col items-start gap-2">
                <BotonGenerarLote pendientes={pendientes} />
                {pendientes === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay novedades para informar.</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Los archivos los generan {quienesGeneran}.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Alert className="border-amber-200 bg-amber-50/60">
        <TriangleAlertIcon className="text-amber-700" />
        <AlertTitle>A confirmar con la SRT</AlertTitle>
        <AlertDescription>
          En el documento «Implementación de FODEP en intercambio» (v0.2) los ejemplos muestran el N° de siniestro en
          los archivos .AL y .AZ, pero la definición de campos no lo incluye. El sistema sigue la definición de
          campos.
        </AlertDescription>
      </Alert>

      <Seccion
        titulo="Lotes generados"
        descripcion="Cada lote reúne los diagnósticos informados ese día. Podés descargar cada archivo tal como se enviaría."
      >
        {lotes.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {lotes.map((lote) => (
              <TarjetaLote key={lote.id} lote={lote} />
            ))}
          </div>
        ) : (
          <Empty className="rounded-lg border border-dashed bg-background py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileStackIcon />
              </EmptyMedia>
              <EmptyTitle>Todavía no se generó ningún lote</EmptyTitle>
              <EmptyDescription>Cuando haya diagnósticos evaluados, se generan desde «Próximo lote».</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Seccion>

      <Seccion
        titulo="Diseño de registro"
        descripcion="Archivos de texto de ancho fijo, con fin de línea CRLF: los números van alineados a la derecha con ceros y los textos a la izquierda con espacios."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">
              .AD · {ARCHIVO_INFO.AD.nombre} ({LARGO.AD} posiciones)
            </h3>
            <TablaLayout layout={LAYOUT_AD} />
            {ultimoLote && lineaEjemplo ? (
              <details className="rounded-lg border bg-background px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Ver un registro real del lote {ultimoLote.id}, campo por campo
                </summary>
                <div className="mt-3">
                  <EjemploRegistro
                    linea={lineaEjemplo}
                    layout={LAYOUT_AD}
                    origen={`Primer registro del archivo ${nombreArchivo(UERT.cart, "AD")} del lote ${ultimoLote.id}.`}
                  />
                </div>
              </details>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">
                .AL · {ARCHIVO_INFO.AL.nombre} ({LARGO.AL} posiciones)
              </h3>
              <TablaLayout layout={LAYOUT_AL} />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">
                .AZ · {ARCHIVO_INFO.AZ.nombre} ({LARGO.AZ} posiciones)
              </h3>
              <TablaLayout layout={LAYOUT_AZ} />
            </div>
          </div>
        </div>
      </Seccion>
    </TabsContent>
  );
}
