import { CircleHelpIcon } from "lucide-react";
import { Etiqueta, RolBadge } from "@/components/comun/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Catalogo } from "@/lib/datos/catalogos";
import { MAX_DIAGNOSTICOS_EP, PLAZOS, ROL_INFO, UERT } from "@/lib/dominio/constantes";
import { formatoFecha, type FechaISO } from "@/lib/dominio/fechas";
import { numeroExpediente, numeroSiniestroSRT } from "@/lib/dominio/numeracion";
import { formatoCuil } from "@/lib/dominio/validaciones";
import type { Usuario } from "@/lib/tipos";
import { cn } from "@/lib/utils";

const CABECERA = "bg-muted/50 hover:bg-muted/50";

export function AConfirmar({ detalle }: { detalle?: string }) {
  return (
    <Etiqueta className="bg-amber-50 text-amber-800 ring-amber-600/20" title={detalle}>
      <CircleHelpIcon className="size-3" aria-hidden />A confirmar
    </Etiqueta>
  );
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------
export function TablaUsuarios({ usuarios, actualId }: { usuarios: Usuario[]; actualId: number }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className={CABECERA}>
            <TableHead>Usuario</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="hidden md:table-cell">Cargo</TableHead>
            <TableHead className="hidden lg:table-cell">Email</TableHead>
            <TableHead className="hidden sm:table-cell">Pantalla de inicio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => (
            <TableRow key={u.id}>
              <TableCell>
                <span className="font-medium">{u.nombre}</span>
                {u.id === actualId ? (
                  <Etiqueta className="ml-2 bg-primary/10 text-primary ring-primary/20">Vos</Etiqueta>
                ) : null}
                <div className="text-xs text-muted-foreground md:hidden">{u.cargo}</div>
              </TableCell>
              <TableCell>
                <RolBadge rol={u.rol} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{u.cargo}</TableCell>
              <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">{u.email ?? "—"}</TableCell>
              <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                {ROL_INFO[u.rol].inicio}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catálogos de la SRT
// ---------------------------------------------------------------------------
const USO_CATALOGO: Record<Catalogo, string> = {
  cie10: "Diagnósticos de la denuncia y de la evaluación médica (.AD)",
  agente_causante: "Diagnósticos de enfermedad profesional (WS FODEP)",
  lesion: "Lesiones de cada diagnóstico (.AL)",
  zona_cuerpo: "Zonas del cuerpo de cada diagnóstico (.AZ)",
  forma_accidente: "Accidentes de trabajo e in itinere",
  agente_material: "Accidentes de trabajo e in itinere",
  ciuo88: "Ocupación del puesto de trabajo",
  localidad: "Domicilios, lugar de trabajo y lugar del hecho",
};

export function TablaCatalogos({
  catalogos,
}: {
  catalogos: Array<{ catalogo: Catalogo; nombre: string; registros: number }>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className={CABECERA}>
            <TableHead>Catálogo</TableHead>
            <TableHead className="text-right">Registros</TableHead>
            <TableHead className="hidden sm:table-cell">Se usa en</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {catalogos.map((c) => (
            <TableRow key={c.catalogo}>
              <TableCell>
                <span className="font-medium">{c.nombre}</span>
                {c.catalogo === "localidad" ? (
                  <span className="block text-xs text-muted-foreground">Solo Santiago del Estero</span>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{c.registros.toLocaleString("es-AR")}</TableCell>
              <TableCell className="hidden text-sm whitespace-normal text-muted-foreground sm:table-cell">
                {USO_CATALOGO[c.catalogo]}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parámetros (solo lectura)
// ---------------------------------------------------------------------------
interface FilaParametro {
  nombre: string;
  valor: React.ReactNode;
  fuente: string;
  aConfirmar?: string;
}

const FILAS_PLAZOS: FilaParametro[] = [
  {
    nombre: "Control de cobertura y relación laboral",
    valor: `${PLAZOS.configuracionHoras} horas`,
    fuente: "Anexo II, pto. 2: si no hay cobertura, se informa a la SRT",
  },
  {
    nombre: "Anticipación mínima de las citaciones",
    valor: `${PLAZOS.citacionHorasMinimas} horas`,
    fuente: "Anexo II, pto. 1.6",
  },
  {
    nombre: "Plazo del área legal para expedirse",
    valor: `${PLAZOS.legalDiasHabiles} días hábiles`,
    fuente: "RF-10",
  },
  {
    nombre: "Prórroga del área legal",
    valor: `${PLAZOS.prorrogaDiasHabiles} días hábiles`,
    fuente: "RF-10 (según el relevamiento)",
    aConfirmar: "La duración de la prórroga legal está pendiente de confirmación con la UERT.",
  },
  {
    nombre: "Presentación ante la Comisión Médica (aceptada sin baja)",
    valor: `${PLAZOS.sinBajaDiasHabiles} días hábiles`,
    fuente: "Resolución de EP, art. 9",
  },
  {
    nombre: "Tope de la incapacidad laboral temporaria (ILT)",
    valor: `${PLAZOS.topeIltDias} días corridos desde el siniestro`,
    fuente: "Ley 24.557, art. 7 · RF-22",
  },
  {
    nombre: "Aviso antes del tope de la ILT",
    valor: `${PLAZOS.avisoTopeIltDias} días corridos`,
    fuente: "Alerta del sistema",
  },
  {
    nombre: "Primera presentación de la licencia",
    valor: `${PLAZOS.primeraPresentacionDias} días corridos desde la aceptación`,
    fuente: "Seguimiento de licencias",
  },
  {
    nombre: "Aviso antes de cada presentación",
    valor: `${PLAZOS.avisoPresentacionDias} días corridos`,
    fuente: "RF-15",
    aConfirmar: "La anticipación y el medio de las alertas quedan a definir con la UERT.",
  },
  {
    nombre: "Diagnósticos por denuncia de enfermedad profesional",
    valor: `Hasta ${MAX_DIAGNOSTICOS_EP}`,
    fuente: "WS FODEP (error FO23)",
  },
];

const EJEMPLO = { anio: 2026, contador: 12, sufijo: 1 };

const FILAS_UERT: FilaParametro[] = [
  {
    nombre: "Organismo",
    valor: `${UERT.nombre} (${UERT.sigla}) · ${UERT.provincia}`,
    fuente: "—",
  },
  {
    nombre: "CUIT del empleador",
    valor: <span className="font-mono">{formatoCuil(UERT.cuitEmpleador)}</span>,
    fuente: "Provincia de Santiago del Estero, precargado (RNF-05)",
  },
  {
    nombre: "Código de establecimiento",
    valor: <span className="font-mono">{UERT.codigoEstablecimiento}</span>,
    fuente: "Fijo (RNF-05)",
  },
  {
    nombre: "CART (código de ART/EA asignado por la SRT)",
    valor: <span className="font-mono">{UERT.cart}</span>,
    fuente: "Tomado del sistema anterior",
    aConfirmar: "Hay que confirmar con la SRT el código de ART/EA de la UERT.",
  },
  {
    nombre: "Prefijo del número de siniestro (8 posiciones de uso libre)",
    valor: <span className="font-mono">{UERT.prefijoSiniestro}</span>,
    fuente: "Res. SRT 3326/14 · tomado del sistema anterior",
    aConfirmar: "Hay que confirmar el prefijo y la continuidad de la numeración del sistema actual.",
  },
  {
    nombre: "Número de siniestro para la SRT (20 posiciones)",
    valor: (
      <span className="flex flex-col gap-0.5">
        <span className="font-mono">
          {numeroSiniestroSRT(EJEMPLO.anio, EJEMPLO.contador, EJEMPLO.sufijo)}
        </span>
        <span className="text-xs text-muted-foreground">
          Prefijo + año + contador + sufijo. En pantalla: {numeroExpediente(EJEMPLO.anio, EJEMPLO.contador, EJEMPLO.sufijo)}{" "}
          (1.er reingreso).
        </span>
      </span>
    ),
    fuente: "RF-23 y RF-24",
  },
  {
    nombre: "Comisión Médica",
    valor: `${UERT.comisionMedica.nombre} · ${UERT.comisionMedica.direccion}`,
    fuente: `Código ${UERT.comisionMedica.codigo}`,
  },
];

function TablaParametros({ filas, titulo }: { filas: FilaParametro[]; titulo: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className={CABECERA}>
            <TableHead className="w-[42%] lg:w-[34%]">{titulo}</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead className="hidden w-[26%] lg:table-cell">Fuente</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f) => (
            <TableRow key={f.nombre} className="align-top">
              <TableCell className="font-medium whitespace-normal">{f.nombre}</TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-wrap items-center gap-2">
                  {f.valor}
                  {f.aConfirmar ? <AConfirmar /> : null}
                </div>
                {f.aConfirmar ? <p className="mt-1 text-xs text-amber-800">{f.aConfirmar}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground lg:hidden">{f.fuente}</p>
              </TableCell>
              <TableCell className="hidden text-sm whitespace-normal text-muted-foreground lg:table-cell">
                {f.fuente}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function Parametros() {
  return (
    <div className="flex flex-col gap-4">
      <TablaParametros titulo="Plazo" filas={FILAS_PLAZOS} />
      <TablaParametros titulo="Dato fijo" filas={FILAS_UERT} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feriados
// ---------------------------------------------------------------------------
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function diaSemana(iso: FechaISO): string {
  return DIAS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

export function ListaFeriados({ feriados, hoy }: { feriados: Array<{ fecha: FechaISO; descripcion: string }>; hoy: FechaISO }) {
  const proximo = feriados.find((f) => f.fecha >= hoy)?.fecha ?? null;
  const anios = [...new Set(feriados.map((f) => f.fecha.slice(0, 4)))];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {anios.map((anio) => {
        const delAnio = feriados.filter((f) => f.fecha.startsWith(anio));
        return (
          <div key={anio} className="overflow-hidden rounded-lg border bg-background">
            <div className="flex items-center justify-between border-b bg-muted/50 px-4 py-2 text-sm font-medium">
              <span>{anio}</span>
              <span className="text-xs font-normal text-muted-foreground">{delAnio.length} feriados</span>
            </div>
            <ul className="divide-y">
              {delAnio.map((f) => {
                const pasado = f.fecha < hoy;
                return (
                  <li
                    key={f.fecha}
                    className={cn("flex items-center gap-3 px-4 py-1.5 text-sm", pasado && "text-muted-foreground")}
                  >
                    <span className="w-20 shrink-0 font-mono text-xs tabular-nums">{formatoFecha(f.fecha)}</span>
                    <span className="w-8 shrink-0 text-xs text-muted-foreground">{diaSemana(f.fecha)}</span>
                    <span className="min-w-0 flex-1">{f.descripcion}</span>
                    {f.fecha === proximo ? (
                      <Etiqueta className="bg-primary/10 text-primary ring-primary/20">Próximo</Etiqueta>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
