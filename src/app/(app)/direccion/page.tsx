import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  FileStackIcon,
  FolderOpenIcon,
  HourglassIcon,
  InboxIcon,
  ServerCrashIcon,
} from "lucide-react";
import { Simulado } from "@/components/comun/badges";
import { EncabezadoPagina, Seccion } from "@/components/comun/pagina";
import { GrillaIndicadores, TarjetaIndicador } from "@/components/comun/tarjeta-indicador";
import { BarrasPorEtapa, DistribucionPorTipo } from "@/components/tablero/graficos";
import { TablaUltimasComunicaciones, TablaVencimientos } from "@/components/tablero/tablas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import { listarComunicaciones } from "@/lib/datos/srt";
import { obtenerTablero } from "@/lib/datos/tablero";
import { ESTADOS, ESTADO_INFO, TIPOS, type TipoDenuncia } from "@/lib/dominio/constantes";
import { formatoFechaHora } from "@/lib/dominio/fechas";
import { plural } from "@/lib/formato";
import { cargarFeriados } from "@/lib/operaciones/contexto";
import { requerirUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Tablero de Dirección" };

export default async function PaginaDireccion() {
  await requerirUsuario();
  const db = await getDb();
  const ahora = new Date();
  const feriados = await cargarFeriados(db);
  const [tablero, comunicaciones, abiertosTipo] = await Promise.all([
    obtenerTablero(db, ahora, feriados),
    listarComunicaciones(db, { limite: 8 }),
    db.query<{ tipo: TipoDenuncia; n: number }>(
      "select tipo, count(*)::int as n from expedientes where estado = any($1) group by tipo",
      [ESTADOS.filter((e) => ESTADO_INFO[e].abierto)],
    ),
  ]);

  const cuantos = (nivel: "vencido" | "hoy" | "proximo") =>
    tablero.vencimientos.filter((v) => v.plazo.nivel === nivel).length;
  const vencidos = cuantos("vencido");
  const vencenHoy = cuantos("hoy");
  const proximos = cuantos("proximo");
  const totalExpedientes = ESTADOS.reduce((n, e) => n + tablero.porEstado[e], 0);
  const totalPorTipo = TIPOS.reduce((n, t) => n + tablero.porTipo[t], 0);
  const abiertosPorTipo = Object.fromEntries(
    TIPOS.map((t) => [t, abiertosTipo.rows.find((r) => r.tipo === t)?.n ?? 0]),
  ) as Record<TipoDenuncia, number>;

  return (
    <>
      <EncabezadoPagina
        titulo="Tablero de Dirección"
        descripcion={`Estado de todos los expedientes, los plazos que hay que cumplir y las comunicaciones con la SRT. Datos al ${formatoFechaHora(ahora)}.`}
        acciones={
          <Button asChild variant="outline">
            <Link href="/expedientes">
              Ver expedientes
              <ArrowRightIcon />
            </Link>
          </Button>
        }
      />

      <GrillaIndicadores columnas={6}>
        <TarjetaIndicador
          titulo="Expedientes abiertos"
          valor={tablero.abiertos}
          detalle="En trámite en alguna de las áreas"
          icono={FolderOpenIcon}
          href="/expedientes?estado=abiertos"
        />
        <TarjetaIndicador
          titulo="Recibidos en 30 días"
          valor={tablero.recibidosUltimos30}
          detalle="Denuncias nuevas del último mes"
          icono={InboxIcon}
        />
        <TarjetaIndicador
          titulo="Plazos vencidos"
          valor={vencidos}
          detalle={vencidos ? "Requieren atención inmediata" : "No hay plazos vencidos"}
          icono={vencidos ? CircleAlertIcon : CircleCheckIcon}
          tono={vencidos ? "critico" : "ok"}
          href="#vencimientos"
        />
        <TarjetaIndicador
          titulo="Vencen hoy o pronto"
          valor={vencenHoy + proximos}
          detalle={`${vencenHoy} hoy · ${proximos} en los próximos días`}
          icono={HourglassIcon}
          tono={vencenHoy + proximos ? "alerta" : "ok"}
          href="#vencimientos"
        />
        <TarjetaIndicador
          titulo="Errores con la SRT"
          valor={tablero.srtErrores}
          detalle={tablero.srtErrores ? "Comunicaciones rechazadas (simulado)" : "Sin rechazos de la SRT"}
          icono={tablero.srtErrores ? ServerCrashIcon : CircleCheckIcon}
          tono={tablero.srtErrores ? "critico" : "ok"}
          href="/srt?tab=ws&errores=1"
        />
        <TarjetaIndicador
          titulo="Diagnósticos por informar"
          valor={tablero.pendientesIntercambio}
          detalle="Para el próximo lote del Sistema de Intercambio"
          icono={FileStackIcon}
          href="/srt?tab=intercambio"
        />
      </GrillaIndicadores>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="bg-background lg:col-span-3" data-recorrido="por-etapa">
          <CardHeader>
            <CardTitle>Expedientes por etapa</CardTitle>
            <CardDescription>
              {plural(totalExpedientes, "expediente")} en total, en el orden del circuito. El punto indica el área que
              tiene el expediente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BarrasPorEtapa porEstado={tablero.porEstado} />
          </CardContent>
        </Card>
        <Card className="bg-background lg:col-span-2">
          <CardHeader>
            <CardTitle>Por tipo de denuncia</CardTitle>
            <CardDescription>{plural(totalPorTipo, "expediente")}, abiertos y cerrados.</CardDescription>
          </CardHeader>
          <CardContent>
            <DistribucionPorTipo porTipo={tablero.porTipo} abiertos={abiertosPorTipo} />
          </CardContent>
        </Card>
      </div>

      <div id="vencimientos" className="mt-8 scroll-mt-32">
        <Seccion
          recorrido="vencimientos"
          titulo="Vencimientos"
          descripcion={`${plural(vencidos, "vencido")} · ${plural(vencenHoy, "vence", "vencen")} hoy · ${plural(proximos, "próximo")}. Los plazos en término no se muestran.`}
        >
          <TablaVencimientos vencimientos={tablero.vencimientos} />
        </Seccion>
      </div>

      <Seccion
        recorrido="srt-tablero"
        className="mt-8"
        titulo={
          <span className="inline-flex flex-wrap items-center gap-2">
            Últimas comunicaciones con la SRT <Simulado />
          </span>
        }
        descripcion="Web Service FODEP, notificaciones y lotes del Sistema de Intercambio."
        acciones={
          <Button asChild variant="ghost" size="sm">
            <Link href="/srt">
              Ver todas
              <ArrowRightIcon />
            </Link>
          </Button>
        }
      >
        <TablaUltimasComunicaciones filas={comunicaciones} />
      </Seccion>
    </>
  );
}
