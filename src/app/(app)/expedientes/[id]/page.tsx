import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { CircleCheckIcon, PrinterIcon } from "lucide-react";
import type { PanelProps } from "@/components/comun/panel";
import { CitacionesFicha } from "@/components/ficha/citaciones-ficha";
import { ComunicacionesFicha } from "@/components/ficha/comunicaciones-ficha";
import { DiagnosticosFicha } from "@/components/ficha/diagnosticos-ficha";
import { DocumentacionFicha } from "@/components/ficha/documentacion-ficha";
import { EncabezadoFicha } from "@/components/ficha/encabezado-ficha";
import { HistorialFicha } from "@/components/ficha/historial-ficha";
import { LicenciaFicha } from "@/components/ficha/licencia-ficha";
import { PestanasFicha } from "@/components/ficha/pestanas-ficha";
import { QuienActua } from "@/components/ficha/quien-actua";
import { ResumenFicha } from "@/components/ficha/resumen-ficha";
import { PanelLegal } from "@/components/legal/panel-legal";
import { PanelMedico } from "@/components/medica/panel-medico";
import { PanelMesa } from "@/components/mesa/panel-mesa";
import { PanelSeguimiento } from "@/components/seguimiento/panel-seguimiento";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDb } from "@/lib/db";
import { obtenerFicha, plazosDe } from "@/lib/datos/expedientes";
import { hoy } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { vistaPreviaIntercambio } from "@/lib/operaciones";
import { cargarFeriados } from "@/lib/operaciones/contexto";
import { requerirUsuario } from "@/lib/sesion";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PESTANAS = ["resumen", "diagnosticos", "documentacion", "citaciones", "licencia", "comunicaciones", "historial"] as const;
type Pestana = (typeof PESTANAS)[number];

/** Id de expediente válido (entero positivo que entra en un int de Postgres). */
function idDe(valor: string): number | null {
  if (!/^\d{1,9}$/.test(valor)) return null;
  const n = Number(valor);
  return n > 0 ? n : null;
}

/** Una sola lectura de la ficha por pedido (la usan generateMetadata y la página). */
const cargarFicha = cache(async (id: number) => obtenerFicha(await getDb(), id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = idDe((await params).id);
  const ficha = id ? await cargarFicha(id) : null;
  return { title: ficha ? `Expediente ${ficha.expediente.numero}` : "Expediente no encontrado" };
}

/** Ficha del expediente: la pantalla central de la demo. */
export default async function PaginaExpediente({ params, searchParams }: Props) {
  const id = idDe((await params).id);
  if (!id) notFound();
  const [ficha, usuario, sp] = await Promise.all([cargarFicha(id), requerirUsuario(), searchParams]);
  if (!ficha) notFound();

  const db = await getDb();
  const [feriados, intercambio] = await Promise.all([cargarFeriados(db), vistaPreviaIntercambio(db, id)]);
  const ahora = new Date();
  const hoyISO = hoy(ahora);
  const plazos = plazosDe(ficha.expediente, ahora, feriados);
  const p: PanelProps = { ficha, usuario, plazos };

  const tab = typeof sp.tab === "string" && (PESTANAS as readonly string[]).includes(sp.tab) ? (sp.tab as Pestana) : "resumen";
  const nueva = sp.nueva === "1";

  // La cantidad se muestra solo si hay algo (las solapas vacías quedan más livianas)
  const pestanas: Array<{ valor: Pestana; titulo: string; cantidad: number }> = [
    { valor: "resumen", titulo: "Resumen", cantidad: 0 },
    { valor: "diagnosticos", titulo: "Diagnósticos", cantidad: ficha.diagnosticos.length },
    { valor: "documentacion", titulo: "Documentación", cantidad: ficha.documentos.length },
    { valor: "citaciones", titulo: "Citaciones", cantidad: ficha.citaciones.length },
    { valor: "licencia", titulo: "Licencia", cantidad: ficha.presentaciones.length },
    { valor: "comunicaciones", titulo: "Comunicaciones SRT", cantidad: ficha.comunicaciones.length },
    { valor: "historial", titulo: "Historial", cantidad: ficha.movimientos.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      {nueva ? (
        <Alert className="border-green-600/30 bg-green-50 text-green-950">
          <CircleCheckIcon className="text-green-700" />
          <AlertTitle>Denuncia registrada. Constancia N° {ficha.expediente.numero}</AlertTitle>
          <AlertDescription className="text-green-900/80">
            <p>
              Se emitió la constancia de recepción y se envió por correo al denunciante y al trabajador (simulado).
              Imprimila para entregarla en mano si la denuncia fue presencial.
            </p>
            <Button asChild size="sm">
              <Link href={`/imprimir/constancia/${ficha.expediente.id}`} target="_blank" rel="noopener">
                <PrinterIcon />
                Imprimir constancia
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <EncabezadoFicha ficha={ficha} plazos={plazos} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1" aria-label="Acciones del expediente">
          <div data-recorrido="quien-actua">
            <QuienActua {...p} />
          </div>
          <PanelMesa {...p} />
          <PanelMedico {...p} />
          <PanelLegal {...p} />
          <PanelSeguimiento {...p} />
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <PestanasFicha key={ficha.expediente.id} inicial={tab}>
            <div className="overflow-x-auto pb-1 [scrollbar-width:thin]" data-recorrido="pestanas-ficha">
              <TabsList aria-label="Secciones del expediente">
                {pestanas.map((t) => (
                  <TabsTrigger key={t.valor} value={t.valor} className="px-2">
                    {t.titulo}
                    {t.cantidad ? (
                      <span className="rounded-full bg-foreground/8 px-1.5 text-[11px] leading-4 font-normal tabular-nums">
                        <span className="sr-only">(</span>
                        {t.cantidad}
                        <span className="sr-only">)</span>
                      </span>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value="resumen" className="pt-2">
              <ResumenFicha ficha={ficha} hoyISO={hoyISO} />
            </TabsContent>
            <TabsContent value="diagnosticos" className="pt-2">
              <DiagnosticosFicha ficha={ficha} />
            </TabsContent>
            <TabsContent value="documentacion" className="pt-2">
              <DocumentacionFicha
                ficha={ficha}
                puedeAdjuntar={puede(usuario.rol, "adjuntar_documento", ficha.expediente.estado)}
              />
            </TabsContent>
            <TabsContent value="citaciones" className="pt-2">
              <CitacionesFicha ficha={ficha} />
            </TabsContent>
            <TabsContent value="licencia" className="pt-2">
              <LicenciaFicha ficha={ficha} plazos={plazos} hoyISO={hoyISO} />
            </TabsContent>
            <TabsContent value="comunicaciones" className="pt-2">
              <ComunicacionesFicha ficha={ficha} intercambio={intercambio} />
            </TabsContent>
            <TabsContent value="historial" className="pt-2">
              <HistorialFicha ficha={ficha} />
            </TabsContent>
          </PestanasFicha>
        </div>
      </div>
    </div>
  );
}
