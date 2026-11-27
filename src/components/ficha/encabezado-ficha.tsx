import Link from "next/link";
import { Building2Icon, Link2Icon, PrinterIcon, UserRoundIcon } from "lucide-react";
import { EstadoBadge, Etiqueta, PlazoBadge, Simulado, TipoBadge } from "@/components/comun/badges";
import { Circuito } from "@/components/comun/circuito";
import { Dato, Datos, EncabezadoPagina } from "@/components/comun/pagina";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ExpedienteFicha, ExpedienteVinculado, PlazoExpediente } from "@/lib/datos/expedientes";
import {
  CANAL_INFO,
  DENUNCIANTE_INFO,
  DESISTIMIENTO_INFO,
  ESTADO_INFO,
  FODEP_ESTADOS,
} from "@/lib/dominio/constantes";
import { fechaDe, formatoFecha, formatoFechaHora } from "@/lib/dominio/fechas";
import { formatoCuil, formatoDni } from "@/lib/dominio/validaciones";
import { CLASE } from "./util";

export function EnlaceExpediente({ exp, className }: { exp: Pick<ExpedienteVinculado, "id" | "numero">; className?: string }) {
  return (
    <Link
      href={`/expedientes/${exp.id}`}
      className={className ?? "font-mono font-medium text-primary underline-offset-2 hover:underline"}
    >
      {exp.numero}
    </Link>
  );
}

function tipoVinculo(v: ExpedienteVinculado): string {
  if (v.es_reingreso) return `Reingreso (sufijo ${v.numero.slice(-2)})`;
  if (v.es_intercurrencia) return "Intercurrencia";
  return "Vinculado";
}

/**
 * Encabezado de la ficha: número, tipo, estado, vínculos con otros
 * siniestros, la persona, el circuito con sus plazos y los datos de la
 * recepción.
 */
export function EncabezadoFicha({ ficha, plazos }: { ficha: ExpedienteFicha; plazos: PlazoExpediente[] }) {
  const e = ficha.expediente;
  const p = ficha.persona;
  const llegoAMedica = ficha.movimientos.some((m) => m.accion === "pase_medica");
  const hayVinculos = ficha.origen !== null || ficha.vinculados.length > 0;

  return (
    <EncabezadoPagina
      recorrido="ficha-encabezado"
      volver={{ href: "/expedientes", texto: "Expedientes" }}
      titulo={
        <>
          <span className="sr-only">Expediente </span>
          <span className="font-mono text-2xl tracking-tight sm:text-3xl">{e.numero}</span>
        </>
      }
      acciones={
        <Button asChild variant="outline">
          <Link href={`/imprimir/constancia/${e.id}`} target="_blank" rel="noopener">
            <PrinterIcon />
            Constancia de recepción
          </Link>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <TipoBadge tipo={e.tipo} largo />
        <EstadoBadge estado={e.estado} />
        {e.es_reingreso ? (
          <Etiqueta className={CLASE.neutro}>
            Reingreso (sufijo {String(e.sufijo).padStart(2, "0")})
            {ficha.origen ? (
              <>
                {" "}
                de <EnlaceExpediente exp={ficha.origen} />
              </>
            ) : null}
          </Etiqueta>
        ) : null}
        {e.es_intercurrencia ? (
          <Etiqueta className={CLASE.neutro}>
            Intercurrencia
            {ficha.origen ? (
              <>
                {" "}
                de <EnlaceExpediente exp={ficha.origen} />
              </>
            ) : null}
          </Etiqueta>
        ) : null}
        {e.reencuadrado_en ? (
          <Etiqueta className={CLASE.neutro}>Reencuadrado como EP el {formatoFecha(fechaDe(e.reencuadrado_en))}</Etiqueta>
        ) : null}
        {e.estado === "desistido" && e.desistido_motivo ? (
          <Etiqueta className={CLASE.neutro}>Motivo: {DESISTIMIENTO_INFO[e.desistido_motivo]}</Etiqueta>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-lg leading-tight font-semibold">
          <UserRoundIcon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden />
          {p.apellido}, {p.nombres}
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            CUIL <span className="font-mono text-foreground">{formatoCuil(p.cuil)}</span>
          </span>
          <span>
            DNI <span className="font-mono text-foreground">{formatoDni(p.dni)}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <Building2Icon className="size-3.5 shrink-0" aria-hidden />
            {e.reparticion}
          </span>
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Circuito estado={e.estado} llegoAMedica={llegoAMedica} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Plazos en curso</span>
              {plazos.length ? (
                plazos.map((pl) => (
                  <span key={pl.clave} className="inline-flex flex-wrap items-center gap-1.5">
                    <PlazoBadge plazo={pl} nombre={pl.nombre} />
                    <span className="tabular-nums">
                      {pl.dias < 0 ? `venció el ${formatoFecha(pl.vence)}` : formatoFecha(pl.vence)}
                    </span>
                    {pl.clave === "legal" && e.legal_prorroga_usada ? (
                      <Etiqueta className={CLASE.neutro}>Con prórroga</Etiqueta>
                    ) : null}
                  </span>
                ))
              ) : (
                <span>{ESTADO_INFO[e.estado].abierto ? "Sin vencimientos en esta etapa." : "Trámite cerrado."}</span>
              )}
            </div>
          </div>

          <Datos className="grid-cols-2 border-t pt-4 lg:grid-cols-4">
            <Dato etiqueta="Recibida">{formatoFechaHora(e.recibido_en)}</Dato>
            <Dato etiqueta="Canal">{CANAL_INFO[e.canal]}</Dato>
            <Dato etiqueta="Denunciante">
              {DENUNCIANTE_INFO[e.denunciante_tipo]}
              {e.denunciante_tipo !== "trabajador" && e.denunciante_nombre ? (
                <span className="block text-muted-foreground">{e.denunciante_nombre}</span>
              ) : null}
              {e.denunciante_tipo !== "trabajador" && (e.denunciante_email || e.denunciante_telefono) ? (
                <span className="block text-xs text-muted-foreground">
                  {[e.denunciante_email, e.denunciante_telefono].filter(Boolean).join(" · ")}
                </span>
              ) : null}
            </Dato>
            <Dato etiqueta="Recibió">{ficha.recibido_por_nombre ?? "—"}</Dato>
            {e.tipo === "EP" ? (
              <Dato etiqueta="Denuncia ante la SRT" className="col-span-2 lg:col-span-4">
                {e.fodep_numero ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span>
                      Formulario FODEP N° <span className="font-mono font-medium">{e.fodep_numero}</span>
                    </span>
                    {e.fodep_estado ? (
                      <Etiqueta className={CLASE.neutro}>
                        Estado: {FODEP_ESTADOS[e.fodep_estado] ?? `código ${e.fodep_estado}`}
                      </Etiqueta>
                    ) : null}
                    <Simulado />
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Todavía no se informó: el WS FODEP se usa al pasar la denuncia al Área médica.
                  </span>
                )}
              </Dato>
            ) : null}
          </Datos>

          {hayVinculos ? (
            <div className="flex flex-col gap-2 border-t pt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <Link2Icon className="size-3.5 text-muted-foreground" aria-hidden />
                Siniestros vinculados
              </p>
              <ul className="flex flex-wrap gap-2">
                {ficha.origen ? (
                  <li className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-sm">
                    <EnlaceExpediente exp={ficha.origen} />
                    <span className="text-xs text-muted-foreground">Siniestro de origen</span>
                    <EstadoBadge estado={ficha.origen.estado} />
                  </li>
                ) : null}
                {ficha.vinculados.map((v) => (
                  <li
                    key={v.id}
                    className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-sm"
                  >
                    <EnlaceExpediente exp={v} />
                    <span className="text-xs text-muted-foreground">{tipoVinculo(v)}</span>
                    <EstadoBadge estado={v.estado} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </EncabezadoPagina>
  );
}
