"use client";

import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, Link2Icon, PencilIcon } from "lucide-react";
import { Etiqueta, Simulado, TipoBadge } from "@/components/comun/badges";
import { Dato, Datos } from "@/components/comun/pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CANAL_INFO, DENUNCIANTE_INFO, UERT } from "@/lib/dominio/constantes";
import { AVISO_IN_ITINERE, documentosDeRecepcion, documentosFaltantes } from "@/lib/dominio/documentos";
import { formatoFecha } from "@/lib/dominio/fechas";
import { formatoCuil, formatoDni } from "@/lib/dominio/validaciones";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { claveEtiqueta, nombreSolapa, SEXO_INFO, type Entrada, type Ubicacion } from "./modelo";
import type { Busqueda } from "./paso-persona";

function Bloque({
  titulo,
  pendientes,
  onCorregir,
  children,
  className,
}: {
  titulo: string;
  pendientes?: number;
  onCorregir: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {titulo}
          {pendientes ? (
            <Etiqueta className="bg-red-50 text-red-800 ring-red-600/20">
              {plural(pendientes, "dato pendiente", "datos pendientes")}
            </Etiqueta>
          ) : null}
        </CardTitle>
        <CardAction>
          <Button type="button" variant="ghost" size="sm" onClick={onCorregir}>
            <PencilIcon />
            Corregir
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Paso 3: resumen de la denuncia antes de registrarla. */
export function RevisionDenuncia({
  valores: v,
  etiquetas,
  busqueda,
  problemas,
  onIrA,
}: {
  valores: Entrada;
  etiquetas: Record<string, string>;
  busqueda: Busqueda | null;
  problemas: Record<Ubicacion, number>;
  onIrA: (destino: Ubicacion) => void;
}) {
  const tipo = v.tipo;
  const esEP = tipo === "EP";
  const esIT = tipo === "IT";

  const etiqueta = (catalogo: string, codigo: string | number) => etiquetas[claveEtiqueta(catalogo, codigo)] ?? null;
  const conCodigo = (catalogo: string, codigo: string) => {
    if (!codigo) return null;
    const descripcion = etiqueta(catalogo, codigo);
    return descripcion ? `${codigo} · ${descripcion}` : codigo;
  };
  const localidad = (id: number | null) => (id === null ? null : (etiqueta("localidad", id) ?? "Localidad elegida"));
  const junto = (...partes: Array<string | null | undefined | false>) =>
    partes.filter((p): p is string => typeof p === "string" && p.trim() !== "").join(", ") || null;
  const texto = (s: string) => (s.trim() ? s : null);

  const origen =
    v.es_intercurrencia && v.origen_id !== null ? (busqueda?.abiertos.find((a) => a.id === v.origen_id) ?? null) : null;
  const pedidos = documentosDeRecepcion(tipo);
  const otros = v.documentos.filter((d) => d.tipo === "otro").length;
  const faltan = v.es_intercurrencia ? [] : documentosFaltantes(tipo, v.documentos.map((d) => d.tipo));
  const conProblemas = (Object.entries(problemas) as Array<[Ubicacion, number]>).filter(([, n]) => n > 0);

  return (
    <div className="flex flex-col gap-4">
      {conProblemas.length ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>Faltan datos para registrar la denuncia</AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {conProblemas.map(([u, n]) => (
                <li key={u}>
                  <button type="button" onClick={() => onIrA(u)} className="font-medium underline underline-offset-3">
                    {u === "persona" ? "Tipo y persona" : nombreSolapa(u, tipo)}
                  </button>
                  : {plural(n, "dato", "datos")} para completar o corregir.
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <CircleCheckIcon />
          <AlertTitle>La denuncia está lista para registrar</AlertTitle>
          <AlertDescription className="text-emerald-900/80">
            Al registrarla se asigna el número de siniestro y se emite la constancia de recepción, que se envía por
            email a la persona <Simulado />.
          </AlertDescription>
        </Alert>
      )}

      <Bloque titulo="Tipo de denuncia" onCorregir={() => onIrA("persona")} pendientes={problemas.persona}>
        <div className="flex flex-wrap items-center gap-2">
          <TipoBadge tipo={tipo} largo />
          {origen ? (
            <>
              <Etiqueta className="bg-primary/10 text-primary ring-primary/20">
                <Link2Icon className="size-3" aria-hidden="true" />
                Intercurrencia del siniestro {origen.numero}
              </Etiqueta>
              <span className="text-sm text-muted-foreground">Al registrarla pasa directo al Área médica.</span>
            </>
          ) : null}
          {v.confirmo_hecho_distinto ? (
            <span className="text-sm text-muted-foreground">
              Se confirmó que es un hecho distinto de los siniestros abiertos de la persona.
            </span>
          ) : null}
        </div>
      </Bloque>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Trabajador/a" onCorregir={() => onIrA("trabajador")} pendientes={problemas.trabajador}>
          <Datos className="lg:grid-cols-2">
            <Dato etiqueta="Apellido y nombres" className="sm:col-span-2">
              {v.apellido || v.nombres ? `${v.apellido.toUpperCase()}, ${v.nombres}` : null}
            </Dato>
            <Dato etiqueta="CUIL">
              <span className="font-mono">{formatoCuil(v.cuil)}</span>
            </Dato>
            <Dato etiqueta="DNI">
              <span className="font-mono">{formatoDni(v.dni)}</span>
            </Dato>
            <Dato etiqueta="Fecha de nacimiento">{v.fecha_nacimiento ? formatoFecha(v.fecha_nacimiento) : null}</Dato>
            <Dato etiqueta="Sexo">{v.sexo ? SEXO_INFO[v.sexo] : null}</Dato>
            <Dato etiqueta="Teléfono">{texto(v.telefono)}</Dato>
            <Dato etiqueta="Email">{texto(v.email)}</Dato>
            <Dato etiqueta="Domicilio" className="sm:col-span-2">
              {v.domicilio || v.localidad_id ? junto(v.domicilio, localidad(v.localidad_id), "Argentina") : null}
            </Dato>
          </Datos>
        </Bloque>

        <Bloque titulo="Denunciante y canal" onCorregir={() => onIrA("denunciante")} pendientes={problemas.denunciante}>
          <Datos className="lg:grid-cols-2">
            <Dato etiqueta="Canal de recepción">{CANAL_INFO[v.canal]}</Dato>
            <Dato etiqueta="Denuncia">{DENUNCIANTE_INFO[v.denunciante_tipo]}</Dato>
            {v.denunciante_tipo !== "trabajador" ? (
              <>
                <Dato etiqueta="Nombre" className="sm:col-span-2">
                  {texto(v.denunciante_nombre)}
                </Dato>
                <Dato etiqueta="Email">{texto(v.denunciante_email)}</Dato>
                <Dato etiqueta="Teléfono">{texto(v.denunciante_telefono)}</Dato>
              </>
            ) : null}
          </Datos>
        </Bloque>
      </div>

      <Bloque titulo="Datos laborales" onCorregir={() => onIrA("laboral")} pendientes={problemas.laboral}>
        <Datos>
          <Dato etiqueta="Empleador">
            Provincia de {UERT.provincia} · CUIT {formatoCuil(UERT.cuitEmpleador)}
          </Dato>
          <Dato etiqueta="Repartición">{texto(v.reparticion)}</Dato>
          <Dato etiqueta="Lugar de trabajo">{junto(v.domicilio_laboral, localidad(v.localidad_laboral_id))}</Dato>
          <Dato etiqueta="Puesto">{texto(v.puesto)}</Dato>
          <Dato etiqueta="Ocupación (CIUO-88)">{conCodigo("ciuo88", v.ciuo)}</Dato>
          <Dato etiqueta="Antigüedad">
            {junto(
              v.antiguedad_empresa && `${v.antiguedad_empresa} en la Administración Pública`,
              v.antiguedad_area && `${v.antiguedad_area} en el área`,
            )}
          </Dato>
          <Dato etiqueta="Tareas" className="sm:col-span-2 lg:col-span-3">
            {texto(v.tareas)}
          </Dato>
          {v.desvinculado ? (
            <Dato etiqueta="Situación laboral">Ya no trabaja en la Administración Pública Provincial</Dato>
          ) : null}
        </Datos>
      </Bloque>

      <Bloque titulo={nombreSolapa("hecho", tipo)} onCorregir={() => onIrA("hecho")} pendientes={problemas.hecho}>
        {esEP ? (
          <Datos>
            <Dato etiqueta="Exposición al agente de riesgo">
              {v.exposicion_desde
                ? `Desde el ${formatoFecha(v.exposicion_desde)}${
                    v.exposicion_hasta ? ` hasta el ${formatoFecha(v.exposicion_hasta)}` : " · la exposición continúa"
                  }`
                : null}
            </Dato>
            <Dato etiqueta="Primera manifestación">{v.fecha_ocurrencia ? formatoFecha(v.fecha_ocurrencia) : null}</Dato>
            <Dato etiqueta="Pluriempleo">
              {v.pluriempleo
                ? `Sí · CUIT ${v.cuits_pluriempleo.filter(Boolean).join(", ") || "sin cargar"} · ${
                    v.obligada_pago === null
                      ? "falta indicar si la UERT está obligada al pago"
                      : v.obligada_pago
                        ? "la UERT está obligada al pago"
                        : "la UERT no está obligada al pago"
                  }`
                : "No"}
            </Dato>
            <Dato etiqueta="Descripción" className="sm:col-span-2 lg:col-span-3">
              {texto(v.descripcion)}
            </Dato>
          </Datos>
        ) : (
          <Datos>
            <Dato etiqueta="Fecha y hora">
              {v.fecha_ocurrencia
                ? `${formatoFecha(v.fecha_ocurrencia)}${v.hora_ocurrencia ? ` · ${v.hora_ocurrencia} h` : ""}`
                : null}
            </Dato>
            <Dato etiqueta="Lugar">{junto(v.lugar_ocurrencia, localidad(v.localidad_ocurrencia_id))}</Dato>
            <Dato etiqueta="Forma del accidente">{conCodigo("forma_accidente", v.forma_accidente)}</Dato>
            <Dato etiqueta="Agente material">{conCodigo("agente_material", v.agente_material)}</Dato>
            <Dato etiqueta="Descripción" className="sm:col-span-2 lg:col-span-3">
              {texto(v.descripcion)}
            </Dato>
            {esIT ? (
              <Dato etiqueta="Trayecto" className="sm:col-span-2 lg:col-span-3">
                {texto(v.trayecto)}
              </Dato>
            ) : null}
          </Datos>
        )}
      </Bloque>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Diagnósticos" onCorregir={() => onIrA("diagnosticos")} pendientes={problemas.diagnosticos}>
          {v.diagnosticos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {esEP ? "Falta el diagnóstico invocado en el certificado médico." : "Sin diagnóstico: lo completa el Área médica."}
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {v.diagnosticos.map((d, i) => (
                <li key={i} className="rounded-md border p-2.5 text-sm">
                  <p>
                    <span className="mr-1.5 font-mono font-medium">{d.cie10 || "—"}</span>
                    {d.cie10 ? (etiqueta("cie10", d.cie10) ?? "") : "Sin elegir"}
                  </p>
                  {esEP ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Agente causante: {d.agente_causante ? conCodigo("agente_causante", d.agente_causante) : "sin elegir"}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Bloque>

        <Bloque titulo="Documentación" onCorregir={() => onIrA("documentacion")} pendientes={problemas.documentacion}>
          <ul className="flex flex-col gap-1.5 text-sm">
            {pedidos.map((p) => {
              const n = v.documentos.filter((d) => d.tipo === p.clave).length;
              const obligatorio = p.exigencia === "obligatorio" && !v.es_intercurrencia;
              return (
                <li key={p.clave} className="flex items-start gap-2">
                  {n ? (
                    <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <CircleDashedIcon
                      className={cn("mt-0.5 size-4 shrink-0", obligatorio ? "text-amber-600" : "text-muted-foreground")}
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {p.nombre}
                    {n ? (
                      <span className="text-muted-foreground"> · {plural(n, "archivo")}</span>
                    ) : obligatorio ? (
                      <span className="text-amber-700"> · falta</span>
                    ) : (
                      <span className="text-muted-foreground"> · no se adjuntó</span>
                    )}
                  </span>
                </li>
              );
            })}
            {otros ? (
              <li className="flex items-start gap-2">
                <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>
                  Otros documentos <span className="text-muted-foreground">· {plural(otros, "archivo")}</span>
                </span>
              </li>
            ) : null}
          </ul>
          {faltan.length ? (
            <p className="mt-3 text-xs text-amber-800">
              Se puede registrar igual, pero el pase al Área médica va a pedir{" "}
              {plural(faltan.length, "documento obligatorio", "documentos obligatorios")}.
            </p>
          ) : null}
          {esIT ? <p className="mt-3 text-xs text-muted-foreground">{AVISO_IN_ITINERE}</p> : null}
        </Bloque>
      </div>
    </div>
  );
}
