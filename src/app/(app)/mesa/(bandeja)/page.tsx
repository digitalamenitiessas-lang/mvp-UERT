import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  FilePlus2Icon,
  InboxIcon,
  SendIcon,
} from "lucide-react";
import { Etiqueta, Simulado } from "@/components/comun/badges";
import { EncabezadoPagina, Seccion } from "@/components/comun/pagina";
import { TablaExpedientes, type ColumnaExtra } from "@/components/comun/tabla-expedientes";
import { GrillaIndicadores, TarjetaIndicador } from "@/components/comun/tarjeta-indicador";
import { buttonVariants } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { listarExpedientes, type ExpedienteFila } from "@/lib/datos/expedientes";
import { ROL_INFO } from "@/lib/dominio/constantes";
import { documentosFaltantes, type TipoDocumento } from "@/lib/dominio/documentos";
import { fechaDe, formatoFecha, formatoFechaHora, hoy, sumarDias } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { requerirUsuario } from "@/lib/sesion";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mesa de entrada" };

const VERDE = "bg-emerald-50 text-emerald-800 ring-emerald-600/20";
const AMBAR = "bg-amber-50 text-amber-800 ring-amber-600/20";
const ROJO = "bg-red-50 text-red-800 ring-red-600/20";
const GRIS = "bg-zinc-50 text-zinc-700 ring-zinc-500/20";

/** Bandeja de Mesa de entrada: denuncias para controlar y pasar, y lo recibido en la semana. */
export default async function BandejaMesa() {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const hoyISO = hoy();
  const desde = sumarDias(hoyISO, -6);

  const [enRecepcion, recientes, sinFodep] = await Promise.all([
    listarExpedientes(db, { estados: ["recepcion"], orden: "recientes", limite: 500 }),
    listarExpedientes(db, { orden: "recientes", limite: 500 }),
    db.query<{ n: number }>("select count(*)::int as n from expedientes where tipo = 'EP' and fodep_numero is null"),
  ]);

  // Documentación presentada por cada expediente en recepción
  const ids = enRecepcion.map((f) => f.id);
  const { rows: documentos } = ids.length
    ? await db.query<{ expediente_id: number; tipo: string }>(
        "select expediente_id, tipo from documentos where expediente_id = any($1)",
        [ids],
      )
    : { rows: [] as Array<{ expediente_id: number; tipo: string }> };
  const tiposPorExpediente = new Map<number, string[]>();
  for (const d of documentos) {
    tiposPorExpediente.set(d.expediente_id, [...(tiposPorExpediente.get(d.expediente_id) ?? []), d.tipo]);
  }
  /** Documentos obligatorios que faltan; null si no se exigen (reingresos e intercurrencias, a definir). */
  const faltantes = new Map<number, TipoDocumento[] | null>(
    enRecepcion.map((f) => [
      f.id,
      f.es_reingreso || f.es_intercurrencia ? null : documentosFaltantes(f.tipo, tiposPorExpediente.get(f.id) ?? []),
    ]),
  );

  const listaParaPasar = (f: ExpedienteFila) =>
    f.relacion_laboral_verificada === true &&
    (faltantes.get(f.id)?.length ?? 0) === 0 &&
    !(f.tipo === "EP" && f.diagnosticos_total === 0);

  const proximoPaso = (f: ExpedienteFila): string => {
    if (f.relacion_laboral_verificada !== true) return "Verificar la relación laboral";
    if ((faltantes.get(f.id)?.length ?? 0) > 0) return "Completar la documentación";
    if (f.tipo === "EP" && f.diagnosticos_total === 0) return "Cargar el diagnóstico invocado";
    return "Pasar al Área médica";
  };

  // Para controlar: primero las más antiguas
  const paraControlar = [...enRecepcion].sort(
    (a, b) => new Date(a.recibido_en).getTime() - new Date(b.recibido_en).getTime(),
  );
  const ultimaSemana = recientes.filter((f) => fechaDe(new Date(f.recibido_en)) >= desde);
  const recibidasHoy = recientes.filter((f) => fechaDe(new Date(f.recibido_en)) === hoyISO).length;
  const listas = enRecepcion.filter(listaParaPasar).length;

  const columnasControl: ColumnaExtra[] = [
    {
      titulo: "Relación laboral",
      celda: (f) =>
        f.relacion_laboral_verificada === true ? (
          <Etiqueta className={VERDE}>Verificada</Etiqueta>
        ) : f.relacion_laboral_verificada === false ? (
          <Etiqueta className={ROJO}>No corresponde</Etiqueta>
        ) : (
          <Etiqueta className={AMBAR}>Pendiente</Etiqueta>
        ),
    },
    {
      titulo: "Documentación",
      celda: (f) => {
        const faltan = faltantes.get(f.id);
        if (faltan === null || faltan === undefined) {
          return (
            <Etiqueta className={GRIS} title="Reingresos e intercurrencias: requisitos a definir con la UERT">
              No se exige
            </Etiqueta>
          );
        }
        return faltan.length === 0 ? (
          <Etiqueta className={VERDE}>Completa</Etiqueta>
        ) : (
          <Etiqueta className={AMBAR} title={faltan.map((d) => d.nombre).join(" · ")}>
            {faltan.length === 1 ? "Falta 1" : `Faltan ${faltan.length}`}
          </Etiqueta>
        );
      },
    },
    {
      titulo: "Próximo paso",
      className: "hidden md:table-cell",
      celda: (f) => {
        const lista = listaParaPasar(f);
        return (
          <Link
            href={`/expedientes/${f.id}`}
            className={cn(
              "inline-flex items-center gap-1 text-sm whitespace-nowrap hover:underline",
              lista ? "font-medium text-primary" : "text-foreground/80",
            )}
          >
            {proximoPaso(f)}
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </Link>
        );
      },
    },
  ];

  const columnasRecientes: ColumnaExtra[] = [
    {
      titulo: "Recibida",
      className: "hidden sm:table-cell",
      celda: (f) => <span className="text-sm whitespace-nowrap text-muted-foreground">{formatoFechaHora(f.recibido_en)}</span>,
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Mesa de entrada"
        descripcion={ROL_INFO.mesa_entrada.descripcion}
        acciones={
          puede(usuario.rol, "crear_denuncia") ? (
            <Link href="/mesa/nueva" className={buttonVariants()}>
              <FilePlus2Icon />
              Nueva denuncia
            </Link>
          ) : null
        }
      />

      <div className="flex flex-col gap-8">
        <GrillaIndicadores>
          <TarjetaIndicador
            icono={InboxIcon}
            tono={enRecepcion.length ? "neutro" : "apagado"}
            titulo="En recepción"
            valor={enRecepcion.length}
            detalle="Para controlar y pasar al Área médica."
          />
          <TarjetaIndicador
            icono={CircleCheckIcon}
            tono={listas ? "ok" : "apagado"}
            titulo="Listas para pasar"
            valor={listas}
            detalle="Con la relación laboral verificada y la documentación completa."
          />
          <TarjetaIndicador
            icono={CalendarDaysIcon}
            titulo="Recibidas hoy"
            valor={recibidasHoy}
            detalle={`Denuncias ingresadas el ${formatoFecha(hoyISO)}.`}
          />
          <TarjetaIndicador
            icono={SendIcon}
            tono={sinFodep.rows[0]?.n ? "neutro" : "apagado"}
            titulo="EP pendientes de informar a la SRT"
            valor={sinFodep.rows[0]?.n ?? 0}
            detalle={
              <>
                Sin N° de formulario FODEP. Se informan por Web Service al pasar al Área médica. <Simulado />
              </>
            }
          />
        </GrillaIndicadores>

        <Seccion
          titulo="Para controlar y pasar al Área médica"
          descripcion="Verificá la relación laboral y la documentación de cada denuncia y pasala al Área médica. Primero las más antiguas."
        >
          <TablaExpedientes
            filas={paraControlar}
            columnas={columnasControl}
            ocultar={["estado", "novedad"]}
            vacio="No hay denuncias en Mesa de entrada. Las nuevas aparecen acá apenas se registran."
          />
        </Seccion>

        <Seccion
          titulo="Recibidas en los últimos 7 días"
          descripcion={`Todas las denuncias que ingresaron desde el ${formatoFecha(desde)}, en cualquier estado.`}
        >
          <TablaExpedientes
            filas={ultimaSemana}
            columnas={columnasRecientes}
            vacio="No ingresaron denuncias en los últimos 7 días."
          />
        </Seccion>
      </div>
    </>
  );
}
