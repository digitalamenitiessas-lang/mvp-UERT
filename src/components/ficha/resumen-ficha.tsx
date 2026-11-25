import {
  BriefcaseBusinessIcon,
  CalendarClockIcon,
  CarFrontIcon,
  FlaskConicalIcon,
  HardHatIcon,
  StethoscopeIcon,
  UserRoundIcon,
} from "lucide-react";
import { Dato, Datos } from "@/components/comun/pagina";
import type { ExpedienteFicha } from "@/lib/datos/expedientes";
import { DESISTIMIENTO_INFO, MOTIVO_CESE_ILT_INFO, UERT } from "@/lib/dominio/constantes";
import { antiguedad, fechaDe, formatoFecha, formatoFechaHora, type FechaISO } from "@/lib/dominio/fechas";
import { formatoCuil, formatoDni } from "@/lib/dominio/validaciones";
import { Codigo, SEXO, SiNo, Tarjeta, edad } from "./util";

const ANCHO_COMPLETO = "sm:col-span-2 lg:col-span-3";

/** Texto largo que respeta los saltos de línea. */
function TextoLargo({ children }: { children: string | null }) {
  if (!children) return null;
  return <span className="whitespace-pre-line">{children}</span>;
}

/** Solapa "Resumen": todos los datos de la denuncia agrupados. */
export function ResumenFicha({ ficha, hoyISO }: { ficha: ExpedienteFicha; hoyISO: FechaISO }) {
  const e = ficha.expediente;
  const p = ficha.persona;
  const esEP = e.tipo === "EP";

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta titulo="Persona trabajadora" icono={UserRoundIcon}>
        <Datos>
          <Dato etiqueta="Apellido y nombres">
            {p.apellido}, {p.nombres}
          </Dato>
          <Dato etiqueta="CUIL">
            <span className="font-mono">{formatoCuil(p.cuil)}</span>
          </Dato>
          <Dato etiqueta="DNI">
            <span className="font-mono">{formatoDni(p.dni)}</span>
          </Dato>
          <Dato etiqueta="Fecha de nacimiento">
            {p.fecha_nacimiento ? `${formatoFecha(p.fecha_nacimiento)} (${edad(p.fecha_nacimiento, hoyISO)} años)` : null}
          </Dato>
          <Dato etiqueta="Sexo">{p.sexo ? SEXO[p.sexo] : null}</Dato>
          <Dato etiqueta="Teléfono">{p.telefono}</Dato>
          <Dato etiqueta="Email">{p.email}</Dato>
          <Dato etiqueta="Domicilio" className="lg:col-span-2">
            {[p.domicilio, p.localidad].filter(Boolean).join(", ") || null}
          </Dato>
        </Datos>
      </Tarjeta>

      <Tarjeta titulo="Datos laborales" icono={BriefcaseBusinessIcon}>
        <Datos>
          <Dato etiqueta="Empleador">
            Provincia de {UERT.provincia}
            <span className="block text-xs text-muted-foreground">
              CUIT <span className="font-mono">{formatoCuil(e.cuit_empleador)}</span>
            </span>
            <span className="block text-xs text-muted-foreground">
              Establecimiento <span className="font-mono">{e.codigo_establecimiento}</span>
            </span>
          </Dato>
          <Dato etiqueta="Repartición" className="lg:col-span-2">
            {e.reparticion}
          </Dato>
          <Dato etiqueta="Domicilio laboral">
            {[e.domicilio_laboral, ficha.localidad_laboral].filter(Boolean).join(", ") || null}
          </Dato>
          <Dato etiqueta="Puesto">{e.puesto}</Dato>
          <Dato etiqueta="Ocupación (CIUO-88)">
            {e.ciuo ? <Codigo codigo={e.ciuo} descripcion={ficha.ciuo_descripcion} /> : null}
          </Dato>
          <Dato etiqueta="Antigüedad en la repartición">{e.antiguedad_empresa}</Dato>
          <Dato etiqueta="Antigüedad en el área">{e.antiguedad_area}</Dato>
          {!esEP ? (
            <Dato etiqueta="Desvinculado">
              <SiNo valor={e.desvinculado} />
            </Dato>
          ) : null}
          <Dato etiqueta="Tareas" className={ANCHO_COMPLETO}>
            <TextoLargo>{e.tareas}</TextoLargo>
          </Dato>
        </Datos>
      </Tarjeta>

      {esEP ? (
        <Tarjeta
          titulo="La enfermedad profesional"
          icono={FlaskConicalIcon}
          descripcion="Datos que se informan a la SRT en el formulario FODEP."
        >
          <Datos>
            <Dato etiqueta="Primera manifestación">{e.fecha_ocurrencia ? formatoFecha(e.fecha_ocurrencia) : null}</Dato>
            <Dato etiqueta="Exposición al agente de riesgo" className="lg:col-span-2">
              {e.exposicion_desde ? (
                <>
                  Desde el {formatoFecha(e.exposicion_desde)}{" "}
                  {e.exposicion_hasta ? `hasta el ${formatoFecha(e.exposicion_hasta)}` : "hasta la actualidad"}
                  <span className="block text-xs text-muted-foreground">
                    {antiguedad(e.exposicion_desde, e.exposicion_hasta ?? hoyISO)} de exposición
                  </span>
                </>
              ) : null}
            </Dato>
            <Dato etiqueta="Pluriempleo">
              <SiNo valor={e.pluriempleo} />
              {e.pluriempleo && e.cuits_pluriempleo?.length ? (
                <span className="block font-mono text-xs text-muted-foreground">
                  {e.cuits_pluriempleo.map((c) => `CUIT ${formatoCuil(c)}`).join(" · ")}
                </span>
              ) : null}
            </Dato>
            <Dato etiqueta="UERT obligada al pago">
              {e.pluriempleo ? <SiNo valor={e.obligada_pago} /> : <span className="text-muted-foreground">No corresponde</span>}
            </Dato>
            <Dato etiqueta="Desvinculado">
              <SiNo valor={e.desvinculado} />
            </Dato>
            {e.reencuadrado_en ? (
              <Dato etiqueta="Reencuadre" className={ANCHO_COMPLETO}>
                Se denunció como accidente y el Área médica la reencuadró como enfermedad profesional el{" "}
                {formatoFecha(fechaDe(e.reencuadrado_en))}.
              </Dato>
            ) : null}
            {e.descripcion ? (
              <Dato etiqueta="Descripción" className={ANCHO_COMPLETO}>
                <TextoLargo>{e.descripcion}</TextoLargo>
              </Dato>
            ) : null}
          </Datos>
        </Tarjeta>
      ) : (
        <Tarjeta titulo={e.tipo === "IT" ? "El accidente in itinere" : "El accidente"} icono={e.tipo === "IT" ? CarFrontIcon : HardHatIcon}>
          <Datos>
            <Dato etiqueta="Fecha y hora">
              {e.fecha_ocurrencia
                ? `${formatoFecha(e.fecha_ocurrencia)}${e.hora_ocurrencia ? ` · ${e.hora_ocurrencia.slice(0, 5)} h` : ""}`
                : null}
            </Dato>
            <Dato etiqueta="Lugar">{e.lugar_ocurrencia}</Dato>
            <Dato etiqueta="Localidad">{ficha.localidad_ocurrencia}</Dato>
            <Dato etiqueta="Forma del accidente">
              {e.forma_accidente ? (
                <Codigo codigo={e.forma_accidente} descripcion={ficha.forma_accidente_descripcion} />
              ) : null}
            </Dato>
            <Dato etiqueta="Agente material" className="lg:col-span-2">
              {e.agente_material ? (
                <Codigo codigo={e.agente_material} descripcion={ficha.agente_material_descripcion} />
              ) : null}
            </Dato>
            <Dato etiqueta="Cómo ocurrió" className={ANCHO_COMPLETO}>
              <TextoLargo>{e.descripcion}</TextoLargo>
            </Dato>
            {e.tipo === "IT" ? (
              <Dato etiqueta="Trayecto" className={ANCHO_COMPLETO}>
                <TextoLargo>{e.trayecto}</TextoLargo>
              </Dato>
            ) : null}
          </Datos>
        </Tarjeta>
      )}

      <Tarjeta
        titulo="Definición médica"
        icono={StethoscopeIcon}
        descripcion="La completa el Área médica antes del pase al Área legal."
      >
        <Datos>
          <Dato etiqueta="Baja laboral">
            {e.con_baja === null ? (
              <span className="text-muted-foreground">Sin definir</span>
            ) : e.con_baja ? (
              "Con baja laboral"
            ) : (
              "Sin baja laboral"
            )}
          </Dato>
          <Dato etiqueta="Inicio de la inasistencia">
            {e.fecha_inicio_inasistencia ? formatoFecha(e.fecha_inicio_inasistencia) : null}
          </Dato>
          <Dato etiqueta="Estrés postraumático">
            <SiNo valor={e.estres_postraumatico} />
          </Dato>
        </Datos>
      </Tarjeta>

      <Tarjeta titulo="Trámite, licencia y cierre" icono={CalendarClockIcon}>
        <Datos>
          <Dato etiqueta="Relación laboral y cotizaciones">
            {e.relacion_laboral_verificada === null ? (
              <span className="text-muted-foreground">Pendiente de verificar</span>
            ) : e.relacion_laboral_verificada ? (
              <>Verificada{e.verificado_en ? ` el ${formatoFecha(fechaDe(e.verificado_en))}` : ""}</>
            ) : (
              "No corroborada"
            )}
          </Dato>
          <Dato etiqueta="Dictamen legal">
            {e.legal_ingreso ? (
              <>
                Ingresó el {formatoFecha(e.legal_ingreso)}
                {e.legal_vence ? (
                  <span className="block text-xs text-muted-foreground">
                    Vence el {formatoFecha(e.legal_vence)}
                    {e.legal_prorroga_usada ? " (con prórroga)" : ""}
                  </span>
                ) : null}
              </>
            ) : null}
          </Dato>
          <Dato etiqueta="Próxima presentación">
            {e.proxima_presentacion ? formatoFecha(e.proxima_presentacion) : null}
          </Dato>
          <Dato etiqueta="Fin de la ILT">
            {e.fecha_fin_ilt ? (
              <>
                {formatoFecha(e.fecha_fin_ilt)}
                {e.motivo_cese_ilt ? (
                  <span className="block text-xs text-muted-foreground">
                    Motivo {e.motivo_cese_ilt}: {MOTIVO_CESE_ILT_INFO[e.motivo_cese_ilt]}
                  </span>
                ) : null}
              </>
            ) : null}
          </Dato>
          <Dato etiqueta="Comisión Médica" className="lg:col-span-2">
            {e.cm_presentado_en ? (
              `Presentado el ${formatoFecha(e.cm_presentado_en)} ante la ${UERT.comisionMedica.nombre}`
            ) : e.cm_vence ? (
              <>
                Presentar antes del {formatoFecha(e.cm_vence)}
                <span className="block text-xs text-muted-foreground">{UERT.comisionMedica.nombre}</span>
              </>
            ) : null}
          </Dato>
          {e.desistido_motivo ? (
            <Dato etiqueta="Desistimiento">{DESISTIMIENTO_INFO[e.desistido_motivo]}</Dato>
          ) : null}
          {e.cerrado_en ? <Dato etiqueta="Cerrado">{formatoFechaHora(e.cerrado_en)}</Dato> : null}
        </Datos>
      </Tarjeta>
    </div>
  );
}
