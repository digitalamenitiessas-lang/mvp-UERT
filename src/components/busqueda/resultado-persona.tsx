import Link from "next/link";
import { UserRoundIcon } from "lucide-react";
import { EstadoBadge, Etiqueta, TipoBadge } from "@/components/comun/badges";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { porAnio, type IncidenteBusqueda, type PersonaBusqueda } from "@/lib/datos/busqueda";
import { TIPOS, TIPO_INFO, type TipoDenuncia } from "@/lib/dominio/constantes";
import { formatoFecha } from "@/lib/dominio/fechas";
import { formatoCuil, formatoDni } from "@/lib/dominio/validaciones";
import { plural } from "@/lib/formato";

/** Clases de las etiquetas de origen (las dos tienen que verse distintas). */
export const ORIGEN_INFO = {
  nuevo: { nombre: "Sistema nuevo", badge: "bg-primary/10 text-primary ring-primary/25" },
  actual: { nombre: "Sistema actual", badge: "bg-stone-100 text-stone-700 ring-stone-500/25" },
} as const;

export function OrigenBadge({ origen }: { origen: IncidenteBusqueda["origen"] }) {
  const info = ORIGEN_INFO[origen];
  return <Etiqueta className={info.badge}>{info.nombre}</Etiqueta>;
}

function Situacion({ abierto }: { abierto: boolean }) {
  return abierto ? (
    <Etiqueta className="bg-green-50 text-green-800 ring-green-600/20">
      <span aria-hidden className="size-1.5 rounded-full bg-green-500" />
      Abierto
    </Etiqueta>
  ) : (
    <Etiqueta className="bg-zinc-50 text-zinc-600 ring-zinc-500/20">Cerrado</Etiqueta>
  );
}

/** El sistema actual guarda el tipo como texto; si coincide con uno del sistema nuevo se muestra igual. */
function tipoDe(i: IncidenteBusqueda): TipoDenuncia | null {
  if (i.tipo_codigo) return i.tipo_codigo;
  return TIPOS.find((t) => TIPO_INFO[t].nombre.toLowerCase() === i.tipo.trim().toLowerCase()) ?? null;
}

function Diagnostico({ i, descripciones }: { i: IncidenteBusqueda; descripciones: Record<string, string> }) {
  if (!i.diagnostico) return <span className="text-muted-foreground">—</span>;
  if (i.origen === "actual") return <span>{i.diagnostico}</span>;
  const codigos = i.diagnostico
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return (
    <ul className="flex flex-col gap-0.5">
      {codigos.map((c) => (
        <li key={c}>
          <span className="font-mono text-xs font-medium">{c}</span>
          {descripciones[c] ? <span className="text-muted-foreground"> {descripciones[c]}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Una persona con todos sus siniestros (sistema nuevo y actual), agrupados por año. */
export function ResultadoPersona({
  persona,
  descripciones,
}: {
  persona: PersonaBusqueda;
  descripciones: Record<string, string>;
}) {
  const nuevos = persona.incidentes.filter((i) => i.origen === "nuevo").length;
  const actuales = persona.incidentes.length - nuevos;
  const abiertos = persona.incidentes.filter((i) => i.abierto).length;
  const grupos = porAnio(persona.incidentes);
  const identificacion = [
    persona.cuil ? `CUIL ${formatoCuil(persona.cuil)}` : null,
    persona.dni ? `DNI ${formatoDni(persona.dni)}` : null,
  ].filter(Boolean);

  return (
    <Card className="gap-0 bg-background py-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b px-4 py-3.5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserRoundIcon className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold break-words">{persona.apellido_nombre}</h3>
            <p className="font-mono text-xs text-muted-foreground">
              {identificacion.length ? identificacion.join(" · ") : "Sin CUIL ni DNI registrados"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {nuevos ? (
            <Etiqueta className={ORIGEN_INFO.nuevo.badge}>{plural(nuevos, "en el sistema nuevo", "en el sistema nuevo")}</Etiqueta>
          ) : null}
          {actuales ? (
            <Etiqueta className={ORIGEN_INFO.actual.badge}>
              {plural(actuales, "en el sistema actual", "en el sistema actual")}
            </Etiqueta>
          ) : null}
          {abiertos ? (
            <Etiqueta className="bg-green-50 text-green-800 ring-green-600/20">
              {plural(abiertos, "abierto", "abiertos")}
            </Etiqueta>
          ) : null}
        </div>
      </div>

      {grupos.length ? (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-4">Origen</TableHead>
              <TableHead>N° de siniestro</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Situación</TableHead>
              <TableHead title="Fecha del accidente o de la primera manifestación">Fecha</TableHead>
              <TableHead>Diagnóstico</TableHead>
              <TableHead className="hidden pr-4 xl:table-cell">Repartición</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grupos.map((g) => (
              <Grupo key={g.anio} anio={g.anio} incidentes={g.incidentes} descripciones={descripciones} />
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="px-4 py-6 text-sm text-muted-foreground">No tiene siniestros registrados en ninguno de los dos sistemas.</p>
      )}
    </Card>
  );
}

function Grupo({
  anio,
  incidentes,
  descripciones,
}: {
  anio: number;
  incidentes: IncidenteBusqueda[];
  descripciones: Record<string, string>;
}) {
  return (
    <>
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell colSpan={8} className="py-1.5 pl-4 text-xs font-semibold">
          {anio}
          <span className="font-normal text-muted-foreground"> · {plural(incidentes.length, "siniestro")}</span>
        </TableCell>
      </TableRow>
      {incidentes.map((i) => {
        const tipo = tipoDe(i);
        return (
          <TableRow key={`${i.origen}-${i.numero}`} className="align-top">
            <TableCell className="pl-4">
              <OrigenBadge origen={i.origen} />
            </TableCell>
            <TableCell>
              {i.origen === "nuevo" && i.id ? (
                <Link href={`/expedientes/${i.id}`} className="font-mono text-sm font-medium text-primary hover:underline">
                  {i.numero}
                </Link>
              ) : (
                <span className="font-mono text-sm">{i.numero}</span>
              )}
            </TableCell>
            <TableCell>{tipo ? <TipoBadge tipo={tipo} /> : <span className="text-sm">{i.tipo}</span>}</TableCell>
            <TableCell className="whitespace-normal">
              {i.estado_codigo ? <EstadoBadge estado={i.estado_codigo} /> : <span className="text-sm">{i.estado}</span>}
            </TableCell>
            <TableCell>
              <Situacion abierto={i.abierto} />
            </TableCell>
            <TableCell className="text-sm tabular-nums">{formatoFecha(i.fecha)}</TableCell>
            <TableCell className="min-w-56 text-sm whitespace-normal">
              <Diagnostico i={i} descripciones={descripciones} />
            </TableCell>
            <TableCell className="hidden max-w-64 pr-4 text-sm whitespace-normal text-muted-foreground xl:table-cell">
              {i.reparticion ?? "—"}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
