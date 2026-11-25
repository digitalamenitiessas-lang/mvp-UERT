import Link from "next/link";
import { CheckIcon, CircleDashedIcon, PencilIcon, PrinterIcon } from "lucide-react";
import { AdjuntarDocumento } from "@/components/comun/adjuntar-documento";
import { EstadoBadge, PlazoBadge } from "@/components/comun/badges";
import type { PanelProps } from "@/components/comun/panel";
import { PanelArea } from "@/components/comun/panel-area";
import { buttonVariants } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import type { ExpedienteFicha, PlazoExpediente } from "@/lib/datos/expedientes";
import { ESTADO_INFO, ROL_INFO, type Rol } from "@/lib/dominio/constantes";
import { documentosFaltantes } from "@/lib/dominio/documentos";
import { formatoFecha, formatoFechaHora, hoy } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { DesistirDenuncia, PasarAMedica, RegistrarReingreso, VerificarRelacion } from "./acciones-mesa";

/**
 * Acciones de Mesa de entrada en la ficha del expediente: control de la
 * denuncia en recepción (relación laboral, documentación y pase al Área
 * médica), reingreso de un siniestro dado de alta y documentación.
 */
export function PanelMesa({ ficha, usuario, plazos }: PanelProps) {
  if (usuario.rol !== "mesa_entrada") return null;
  const exp = ficha.expediente;
  const info = ESTADO_INFO[exp.estado];

  let descripcion: string;
  let contenido: React.ReactNode;
  if (exp.estado === "recepcion") {
    descripcion = "Controlá la denuncia y pasala al Área médica.";
    contenido = <ControlRecepcion ficha={ficha} plazos={plazos} rol={usuario.rol} />;
  } else if (exp.estado === "alta") {
    descripcion = exp.fecha_fin_ilt
      ? `Alta médica desde el ${formatoFecha(exp.fecha_fin_ilt)}.`
      : "Siniestro con alta médica.";
    contenido = <Reingreso ficha={ficha} rol={usuario.rol} />;
  } else if (info.abierto) {
    descripcion = "El expediente sigue su trámite en otra área.";
    contenido = (
      <div className="flex flex-col gap-3 text-sm">
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          Estado: <EstadoBadge estado={exp.estado} />
          {info.area ? <span>· a cargo de {ROL_INFO[info.area].nombre}</span> : null}
        </p>
        {puede(usuario.rol, "adjuntar_documento", exp.estado) ? (
          <>
            <p className="text-muted-foreground">Mesa de entrada puede sumar la documentación que presente la persona.</p>
            <AdjuntarDocumento expedienteId={exp.id} tipoExpediente={exp.tipo} />
          </>
        ) : null}
      </div>
    );
  } else {
    descripcion = "Expediente cerrado.";
    contenido = (
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <EstadoBadge estado={exp.estado} />
        No hay acciones pendientes de Mesa de entrada.
      </p>
    );
  }

  return (
    <PanelArea rol="mesa_entrada" descripcion={descripcion}>
      <CardContent>{contenido}</CardContent>
      <CardFooter>
        <Link
          href={`/imprimir/constancia/${exp.id}`}
          target="_blank"
          rel="noopener"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <PrinterIcon />
          Imprimir constancia de recepción
        </Link>
      </CardFooter>
    </PanelArea>
  );
}

/** Un paso de la lista de control de la recepción. */
function PasoControl({
  numero,
  hecho,
  titulo,
  referencia,
  children,
}: {
  numero: number;
  hecho: boolean;
  titulo: string;
  referencia?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          hecho ? "bg-emerald-100 text-emerald-700" : "border bg-background text-muted-foreground",
        )}
      >
        {hecho ? <CheckIcon className="size-3.5" /> : numero}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p className="text-sm leading-6 font-medium">
            {titulo}
            <span className="sr-only">{hecho ? " (hecho)" : " (pendiente)"}</span>
          </p>
          {referencia ? <p className="text-xs text-muted-foreground">{referencia}</p> : null}
        </div>
        {children}
      </div>
    </li>
  );
}

function ControlRecepcion({ ficha, plazos, rol }: { ficha: ExpedienteFicha; plazos: PlazoExpediente[]; rol: Rol }) {
  const exp = ficha.expediente;
  const verificada = exp.relacion_laboral_verificada === true;
  // Reingresos e intercurrencias: requisitos a definir con la UERT (no se exigen para el pase).
  const exigeDocumentos = !exp.es_reingreso && !exp.es_intercurrencia;
  const faltantes = exigeDocumentos ? documentosFaltantes(exp.tipo, ficha.documentos.map((d) => d.tipo)) : [];
  const clavesFaltantes = faltantes.map((f) => f.clave);
  const documentacionCompleta = faltantes.length === 0;
  const diagnosticos = ficha.diagnosticos.filter((d) => d.estado !== "desistido").length;
  const plazoCobertura = plazos.find((p) => p.clave === "configuracion") ?? null;
  const adjuntos = plural(ficha.documentos.length, "documento adjunto", "documentos adjuntos");

  const bloqueo = !verificada
    ? "Primero verificá la relación laboral y las cotizaciones."
    : !documentacionCompleta
      ? `Falta documentación obligatoria (${faltantes.length}).`
      : exp.tipo === "EP" && diagnosticos === 0
        ? "La denuncia de EP necesita al menos un diagnóstico CIE-10: cargalo en “Editar datos de la denuncia”."
        : null;

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-5" aria-label="Control de la denuncia">
        <PasoControl numero={1} hecho={verificada} titulo="Relación laboral y cotizaciones" referencia="Anexo II, punto 2">
          {verificada ? (
            <p className="text-sm text-emerald-700">
              Verificada{exp.verificado_en ? ` el ${formatoFechaHora(exp.verificado_en)}` : ""}.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Pendiente de verificar.</span>
                {plazoCobertura ? <PlazoBadge plazo={plazoCobertura} nombre={plazoCobertura.nombre} /> : null}
              </div>
              {puede(rol, "verificar_relacion_laboral", exp.estado) ? (
                <VerificarRelacion expedienteId={exp.id} tipo={exp.tipo} />
              ) : null}
            </>
          )}
        </PasoControl>

        <PasoControl numero={2} hecho={documentacionCompleta} titulo="Documentación">
          {!exigeDocumentos ? (
            <p className="text-sm text-muted-foreground">
              En {exp.es_reingreso ? "los reingresos" : "las intercurrencias"} la documentación de la recepción todavía
              no se exige para el pase (a definir con la UERT). Tiene {adjuntos}.
            </p>
          ) : documentacionCompleta ? (
            <p className="text-sm text-emerald-700">Completa: {adjuntos}.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-muted-foreground">
                {faltantes.length === 1 ? "Falta" : "Faltan"}{" "}
                {plural(faltantes.length, "documento obligatorio", "documentos obligatorios")}:
              </p>
              <ul className="flex flex-col gap-1">
                {faltantes.map((f) => (
                  <li
                    key={f.clave}
                    className="flex flex-wrap items-center justify-between gap-x-2 rounded-md border border-dashed px-2.5 py-1 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <CircleDashedIcon className="size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                      {f.nombre}
                    </span>
                    {puede(rol, "adjuntar_documento", exp.estado) ? (
                      <AdjuntarDocumento
                        expedienteId={exp.id}
                        tipoExpediente={exp.tipo}
                        faltantes={clavesFaltantes}
                        tipoInicial={f.clave}
                        textoBoton="Adjuntar"
                        etiquetaAccesible={`Adjuntar ${f.nombre}`}
                        variante="link"
                        tamano="xs"
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {puede(rol, "adjuntar_documento", exp.estado) ? (
            <div>
              <AdjuntarDocumento expedienteId={exp.id} tipoExpediente={exp.tipo} faltantes={clavesFaltantes} />
            </div>
          ) : null}
        </PasoControl>

        <PasoControl
          numero={3}
          hecho={false}
          titulo="Pasar al Área médica"
          referencia={exp.tipo === "EP" ? "En EP, el pase informa la denuncia a la SRT." : undefined}
        >
          {puede(rol, "pasar_a_medica", exp.estado) ? (
            <PasarAMedica expedienteId={exp.id} tipo={exp.tipo} bloqueo={bloqueo} />
          ) : null}
        </PasoControl>
      </ol>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {puede(rol, "editar_denuncia", exp.estado) ? (
          <Link href={`/expedientes/${exp.id}/editar`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon />
            Editar datos de la denuncia
          </Link>
        ) : null}
        {puede(rol, "desistir", exp.estado) ? <DesistirDenuncia expedienteId={exp.id} tipo={exp.tipo} /> : null}
      </div>
    </div>
  );
}

function Reingreso({ ficha, rol }: { ficha: ExpedienteFicha; rol: Rol }) {
  const exp = ficha.expediente;
  // Mismo número, sufijo siguiente (RF-24). El número definitivo lo asigna el servidor.
  const base = exp.numero.slice(0, exp.numero.lastIndexOf("-"));
  const sufijos = [
    exp.sufijo,
    ...ficha.vinculados.filter((v) => v.numero.startsWith(`${base}-`)).map((v) => Number(v.numero.slice(base.length + 1))),
  ].filter((n) => Number.isFinite(n));
  const numeroPrevisto = `${base}-${String(Math.max(...sufijos) + 1).padStart(2, "0")}`;
  const reingresosAbiertos = ficha.vinculados
    .filter((v) => v.es_reingreso && ESTADO_INFO[v.estado].abierto)
    .map((v) => ({ id: v.id, numero: v.numero, estado: ESTADO_INFO[v.estado].nombre }));

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Si la persona tiene una recaída por este siniestro, registrá un reingreso: conserva el número con el sufijo
        siguiente y vuelve a pasar por Mesa de entrada y el Área médica.
      </p>
      {reingresosAbiertos.length ? (
        <ul className="flex flex-col gap-1">
          {reingresosAbiertos.map((r) => (
            <li key={r.id} className="text-muted-foreground">
              Reingreso abierto:{" "}
              <Link href={`/expedientes/${r.id}`} className="font-mono font-medium text-primary hover:underline">
                {r.numero}
              </Link>{" "}
              · {r.estado}
            </li>
          ))}
        </ul>
      ) : null}
      {puede(rol, "crear_reingreso", exp.estado) ? (
        <RegistrarReingreso
          expedienteId={exp.id}
          numeroPrevisto={numeroPrevisto}
          fechaAlta={exp.fecha_fin_ilt}
          hoy={hoy()}
          abiertos={reingresosAbiertos.map((r) => ({ numero: r.numero, estado: r.estado }))}
        />
      ) : null}
    </div>
  );
}
