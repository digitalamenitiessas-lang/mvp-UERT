import { CircleCheckIcon, CircleDashedIcon, HandIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import { PlazoBadge, RolBadge } from "@/components/comun/badges";
import type { PanelProps } from "@/components/comun/panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { plazoMasUrgente, type ExpedienteFicha } from "@/lib/datos/expedientes";
import { ESTADO_INFO, ROL_INFO, type EstadoExpediente, type Rol } from "@/lib/dominio/constantes";
import { documentosFaltantes } from "@/lib/dominio/documentos";
import { formatoFecha, formatoFechaHora } from "@/lib/dominio/fechas";
import { ACCIONES, puede, type Accion } from "@/lib/dominio/permisos";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { enumerar } from "./util";

/** Cómo se nombra cada acción en la frase "Como <rol> también podés …". */
const NOMBRE_ACCION: Partial<Record<Accion, string>> = {
  editar_denuncia: "corregir los datos de la denuncia",
  verificar_relacion_laboral: "verificar la relación laboral",
  pasar_a_medica: "pasarla al Área médica",
  desistir: "dejarla como desistida",
  agregar_diagnostico: "agregar diagnósticos",
  evaluar_diagnostico: "evaluar los diagnósticos",
  programar_citacion: "citar al trabajador",
  registrar_asistencia: "registrar la asistencia a una citación",
  definir_baja: "definir la baja laboral",
  reencuadrar_ep: "reencuadrarla como enfermedad profesional",
  pasar_a_legal: "pasarla al Área legal",
  decidir_diagnostico: "aceptar o rechazar los diagnósticos",
  solicitar_prorroga: "pedir la prórroga",
  cerrar_dictamen: "cerrar el dictamen",
  registrar_presentacion: "registrar presentaciones",
  registrar_intercurrencia: "registrar una intercurrencia",
  dar_alta: "dar el alta médica",
  registrar_presentacion_cm: "registrar la presentación ante la Comisión Médica",
  crear_reingreso: "registrar un reingreso",
};

/** Acciones propias de un estado que puede hacer el rol (sin contar adjuntar documentos). */
function accionesDelRol(rol: Rol, estado: EstadoExpediente): string[] {
  return (Object.keys(ACCIONES) as Accion[])
    .filter((a) => a !== "adjuntar_documento" && ACCIONES[a].estados !== null && puede(rol, a, estado))
    .map((a) => NOMBRE_ACCION[a])
    .filter((t): t is string => Boolean(t));
}

interface Pendiente {
  estado: "hecho" | "pendiente" | "aviso";
  texto: string;
}

/** Qué falta para que el expediente avance a la etapa siguiente. */
function pendientesDe(ficha: ExpedienteFicha): Pendiente[] {
  const e = ficha.expediente;
  const dxs = ficha.diagnosticos.filter((d) => d.estado !== "desistido");
  const items: Pendiente[] = [];
  switch (e.estado) {
    case "recepcion": {
      items.push(
        e.relacion_laboral_verificada
          ? { estado: "hecho", texto: "Relación laboral verificada" }
          : { estado: "pendiente", texto: "Verificar la relación laboral y las cotizaciones" },
      );
      if (!e.es_reingreso && !e.es_intercurrencia) {
        const faltan = documentosFaltantes(e.tipo, ficha.documentos.map((d) => d.tipo));
        items.push(
          faltan.length
            ? {
                estado: "pendiente",
                texto: `Completar la documentación obligatoria (${faltan.length === 1 ? "falta" : "faltan"} ${plural(faltan.length, "documento", "documentos")})`,
              }
            : { estado: "hecho", texto: "Documentación obligatoria completa" },
        );
      }
      if (e.tipo === "EP") {
        items.push(
          dxs.length
            ? { estado: "hecho", texto: plural(dxs.length, "diagnóstico invocado", "diagnósticos invocados") }
            : { estado: "pendiente", texto: "Cargar al menos un diagnóstico CIE-10" },
        );
      }
      items.push({
        estado: "pendiente",
        texto: e.tipo === "EP" ? "Pasarla al Área médica (se informa a la SRT por el WS FODEP)" : "Pasarla al Área médica",
      });
      return items;
    }
    case "evaluacion_medica": {
      const sinEvaluar = dxs.filter((d) => d.estado === "invocado").length;
      if (!dxs.length) items.push({ estado: "pendiente", texto: "Cargar al menos un diagnóstico" });
      else
        items.push(
          sinEvaluar
            ? { estado: "pendiente", texto: `Evaluar ${plural(sinEvaluar, "diagnóstico", "diagnósticos")}` }
            : { estado: "hecho", texto: "Diagnósticos evaluados" },
        );
      items.push(
        e.con_baja === null
          ? { estado: "pendiente", texto: "Definir si hay baja laboral" }
          : { estado: "hecho", texto: e.con_baja ? "Definida: con baja laboral" : "Definida: sin baja laboral" },
      );
      for (const c of ficha.citaciones.filter((x) => x.estado === "programada")) {
        items.push({
          estado: "pendiente",
          texto: `Registrar la asistencia a la citación del ${formatoFechaHora(c.fecha_hora)}${c.reiteracion_de ? " (reiteración: si no asiste, caduca)" : ""}`,
        });
      }
      for (const c of ficha.citaciones.filter(
        (x) => x.estado === "no_asistio" && x.reiteracion_de === null && !ficha.citaciones.some((r) => r.reiteracion_de === x.id),
      )) {
        items.push({
          estado: "aviso",
          texto: `No asistió a la citación del ${formatoFechaHora(c.fecha_hora)}: corresponde reiterarla por única vez`,
        });
      }
      items.push({ estado: "pendiente", texto: "Pasarla al Área legal" });
      return items;
    }
    case "dictamen_legal": {
      const sinDecidir = dxs.filter((d) => d.estado !== "aceptado" && d.estado !== "rechazado").length;
      items.push(
        sinDecidir
          ? { estado: "pendiente", texto: `Aceptar o rechazar ${plural(sinDecidir, "diagnóstico", "diagnósticos")}` }
          : { estado: "hecho", texto: "Todos los diagnósticos tienen decisión" },
      );
      items.push({ estado: "pendiente", texto: "Cerrar el dictamen (se notifica al trabajador y al empleador)" });
      return items;
    }
    case "licencia_activa":
      if (e.proxima_presentacion) {
        items.push({ estado: "pendiente", texto: `Registrar la presentación del ${formatoFecha(e.proxima_presentacion)}` });
      }
      items.push({ estado: "pendiente", texto: "Dar el alta médica cuando corresponda" });
      return items;
    case "sin_baja":
      items.push({
        estado: "pendiente",
        texto: e.cm_vence
          ? `Registrar la presentación ante la Comisión Médica (antes del ${formatoFecha(e.cm_vence)})`
          : "Registrar la presentación ante la Comisión Médica",
      });
      return items;
    default:
      return items;
  }
}

const ICONO_PENDIENTE = {
  hecho: <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />,
  pendiente: <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />,
  aviso: <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />,
};

const ESTADO_PENDIENTE_SR = { hecho: "Listo:", pendiente: "Pendiente:", aviso: "Atención:" };

/**
 * Tarjeta "¿Quién actúa ahora?": el área responsable del estado actual, qué
 * le falta al expediente para avanzar y, si el usuario de la demo tiene otro
 * rol, cómo actuar. Si le toca al rol que mira, es solo un aviso: los pasos y
 * el plazo están en el panel de su área.
 */
export function QuienActua({ ficha, usuario, plazos }: PanelProps) {
  const e = ficha.expediente;
  const info = ESTADO_INFO[e.estado];
  const area = info.area;
  const esTuTurno = area === usuario.rol;

  // El panel del área, justo debajo, ya muestra los pasos y el plazo: acá alcanza con avisar.
  if (esTuTurno) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium text-primary ring-1 ring-primary/20">
        <HandIcon className="size-4 shrink-0" aria-hidden />
        Es tu turno como {ROL_INFO[usuario.rol].nombre}.
      </p>
    );
  }

  const pendientes = pendientesDe(ficha);
  const urgente = plazoMasUrgente(plazos);
  const tambien = area ? accionesDelRol(usuario.rol, e.estado) : [];
  const reingresoPosible = e.estado === "alta";

  function mensajeParaElUsuario() {
    const turno = (texto: string) => (
      <p className="rounded-md bg-primary/5 px-3 py-2 text-sm font-medium text-primary">{texto}</p>
    );
    const cambiar = (rolDestino: Rol) => (
      <div className="flex flex-col gap-1 rounded-md bg-muted/60 px-3 py-2 text-sm">
        {tambien.length ? (
          <p>
            Como {ROL_INFO[usuario.rol].nombre} también podés {enumerar(tambien)}.
          </p>
        ) : null}
        <p className="text-muted-foreground">
          Cambiá de rol desde “Viendo como” para actuar como {ROL_INFO[rolDestino].nombre}.
        </p>
      </div>
    );
    if (area) return cambiar(area);
    if (reingresoPosible) {
      return usuario.rol === "mesa_entrada"
        ? turno("Como Mesa de entrada podés registrar el reingreso.")
        : cambiar("mesa_entrada");
    }
    return null;
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HandIcon className="size-4 text-muted-foreground" aria-hidden />
          ¿Quién actúa ahora?
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {area ? (
          <div className="flex flex-wrap items-center gap-2">
            <RolBadge rol={area} />
            <span className="text-xs text-muted-foreground">{ROL_INFO[area].submodulo}</span>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium">
            <UsersIcon className="size-4 text-muted-foreground" aria-hidden />
            Ninguna área: el trámite está cerrado.
          </p>
        )}
        <p className="text-sm text-muted-foreground">{info.descripcion}</p>

        {urgente ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Plazo: <PlazoBadge plazo={urgente} nombre={urgente.nombre} />
          </div>
        ) : null}

        {pendientes.length ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Para avanzar</p>
            <ul className="flex flex-col gap-1.5">
              {pendientes.map((pd, i) => (
                <li key={i} className={cn("flex items-start gap-2 text-sm", pd.estado === "hecho" && "text-muted-foreground")}>
                  {ICONO_PENDIENTE[pd.estado]}
                  <span>
                    <span className="sr-only">{ESTADO_PENDIENTE_SR[pd.estado]} </span>
                    {pd.texto}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {reingresoPosible ? (
          <p className="text-sm">
            Si hay una recaída, Mesa de entrada puede registrar un reingreso: mismo número de siniestro, con el sufijo
            siguiente.
          </p>
        ) : null}

        {mensajeParaElUsuario()}
      </CardContent>
    </Card>
  );
}
