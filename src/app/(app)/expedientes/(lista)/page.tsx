import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2Icon, SearchIcon, XIcon } from "lucide-react";
import { EncabezadoPagina } from "@/components/comun/pagina";
import { TablaExpedientes } from "@/components/comun/tabla-expedientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDb, type Db } from "@/lib/db";
import { listarExpedientes, normalizar } from "@/lib/datos/expedientes";
import {
  ESTADOS,
  ESTADO_INFO,
  TIPOS,
  TIPO_INFO,
  type EstadoExpediente,
  type TipoDenuncia,
} from "@/lib/dominio/constantes";
import { fechaDe, formatoFecha, formatoHora } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { plural } from "@/lib/formato";
import { conBase } from "@/lib/rutas";
import { requerirUsuario } from "@/lib/sesion";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Expedientes" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const LIMITE = 200;
const ABIERTOS = ESTADOS.filter((e) => ESTADO_INFO[e].abierto);
const CERRADOS = ESTADOS.filter((e) => !ESTADO_INFO[e].abierto);

type FiltroEstado = EstadoExpediente | "abiertos" | "cerrados";

function uno(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

function filtroEstadoDe(valor: string): FiltroEstado | null {
  if (valor === "abiertos" || valor === "cerrados") return valor;
  return (ESTADOS as readonly string[]).includes(valor) ? (valor as EstadoExpediente) : null;
}

function estadosDe(filtro: FiltroEstado | null): EstadoExpediente[] | undefined {
  if (filtro === "abiertos") return [...ABIERTOS];
  if (filtro === "cerrados") return [...CERRADOS];
  return filtro ? [filtro] : undefined;
}

/**
 * Cantidad de expedientes por estado con los mismos filtros de tipo y texto
 * que aplica listarExpedientes, para que los números de los chips coincidan
 * con lo que se lista al elegirlos.
 */
async function contarPorEstado(db: Db, f: { tipo?: TipoDenuncia; texto: string }): Promise<Record<EstadoExpediente, number>> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.tipo) {
    params.push(f.tipo);
    where.push(`e.tipo = $${params.length}`);
  }
  const t = f.texto.trim();
  if (t) {
    params.push(`%${normalizar(t)}%`);
    const i = params.length;
    const conds = [
      `translate(lower(p.apellido || ' ' || p.nombres), 'áéíóúüñ', 'aeiouun') like $${i}`,
      `e.numero like $${i}`,
      `translate(lower(e.reparticion), 'áéíóúüñ', 'aeiouun') like $${i}`,
    ];
    const digitos = t.replace(/\D/g, "");
    if (digitos.length >= 4) {
      params.push(`%${digitos}%`);
      conds.push(`p.dni like $${params.length}`, `p.cuil like $${params.length}`);
    }
    where.push(`(${conds.join(" or ")})`);
  }
  const { rows } = await db.query<{ estado: EstadoExpediente; cantidad: number }>(
    `select e.estado, count(*)::int as cantidad
       from expedientes e
       join personas p on p.id = e.persona_id
      ${where.length ? `where ${where.join(" and ")}` : ""}
      group by e.estado`,
    params,
  );
  const conteo = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<EstadoExpediente, number>;
  for (const r of rows) conteo[r.estado] = r.cantidad;
  return conteo;
}

function Chip({
  href,
  activo,
  texto,
  cantidad,
  claseCantidad,
  descripcion,
}: {
  href: string;
  activo: boolean;
  texto: string;
  cantidad: number;
  claseCantidad?: string;
  descripcion?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors";
  const numero = (
    <span
      className={cn(
        "min-w-5 rounded-full px-1.5 text-center text-[11px] leading-4 tabular-nums ring-1 ring-inset",
        claseCantidad ?? "bg-muted text-muted-foreground ring-transparent",
      )}
    >
      {cantidad}
    </span>
  );
  if (cantidad === 0 && !activo) {
    return (
      <span className={cn(base, "cursor-default bg-background text-muted-foreground/70")} title={descripcion}>
        {texto}
        {numero}
      </span>
    );
  }
  return (
    <Link
      href={href}
      title={descripcion}
      aria-current={activo ? "page" : undefined}
      className={cn(
        base,
        activo
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-background text-foreground hover:bg-muted",
      )}
    >
      {texto}
      {numero}
    </Link>
  );
}

/** Listado general de expedientes con filtros por estado, tipo y texto. */
export default async function PaginaExpedientes({ searchParams }: Props) {
  const [usuario, sp] = await Promise.all([requerirUsuario(), searchParams]);
  const filtroEstado = filtroEstadoDe(uno(sp.estado));
  const tipoTexto = uno(sp.tipo);
  const tipo = (TIPOS as readonly string[]).includes(tipoTexto) ? (tipoTexto as TipoDenuncia) : undefined;
  const q = uno(sp.q).trim().slice(0, 100);

  const db = await getDb();
  const [filas, conteo] = await Promise.all([
    listarExpedientes(db, { estados: estadosDe(filtroEstado), tipo, texto: q, orden: "numero", limite: LIMITE }),
    contarPorEstado(db, { tipo, texto: q }),
  ]);

  const total = ESTADOS.reduce((n, e) => n + conteo[e], 0);
  const abiertos = ABIERTOS.reduce((n, e) => n + conteo[e], 0);
  const cerrados = total - abiertos;
  const hayFiltros = Boolean(filtroEstado || tipo || q);

  const hrefEstado = (estado: FiltroEstado | null) => {
    const params = new URLSearchParams();
    if (estado) params.set("estado", estado);
    if (tipo) params.set("tipo", tipo);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/expedientes?${s}` : "/expedientes";
  };

  const detalleFiltro = [
    filtroEstado === "abiertos"
      ? "abiertos"
      : filtroEstado === "cerrados"
        ? "cerrados"
        : filtroEstado
          ? `en estado “${ESTADO_INFO[filtroEstado].nombre}”`
          : null,
    tipo ? `de ${TIPO_INFO[tipo].nombre.toLowerCase()}` : null,
    q ? `${filas.length === 1 ? "que coincide" : "que coinciden"} con “${q}”` : null,
  ].filter(Boolean);

  return (
    <>
      <EncabezadoPagina
        titulo="Expedientes"
        descripcion="Todas las denuncias del sistema nuevo, de la más reciente a la más antigua. Filtrá por estado o por tipo, o buscá por persona, número o repartición."
        acciones={
          puede(usuario.rol, "crear_denuncia") ? (
            <Button asChild>
              <Link href="/mesa/nueva">
                <FilePlus2Icon />
                Nueva denuncia
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-4">
        <form
          method="get"
          action={conBase("/expedientes")}
          role="search"
          aria-label="Filtrar expedientes"
          data-recorrido="filtros-expedientes"
          className="grid gap-3 rounded-xl border bg-background p-4 sm:grid-cols-[minmax(0,1fr)_14rem] lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-end"
        >
          {filtroEstado ? <input type="hidden" name="estado" value={filtroEstado} /> : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-q">Buscar</Label>
            <Input
              id="filtro-q"
              name="q"
              type="search"
              defaultValue={q}
              maxLength={100}
              placeholder="Apellido, nombre, DNI, CUIL, N° de expediente o repartición"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filtro-tipo">Tipo de denuncia</Label>
            <select
              id="filtro-tipo"
              name="tipo"
              defaultValue={tipo ?? ""}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Todos los tipos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {TIPO_INFO[t].nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit">
              <SearchIcon />
              Filtrar
            </Button>
            {hayFiltros ? (
              <Button asChild variant="ghost">
                <Link href="/expedientes">
                  <XIcon />
                  Limpiar filtros
                </Link>
              </Button>
            ) : null}
          </div>
        </form>

        <nav aria-label="Filtrar por estado" className="flex flex-wrap items-center gap-2">
          <Chip href={hrefEstado(null)} activo={!filtroEstado} texto="Todos" cantidad={total} />
          <Chip
            href={hrefEstado("abiertos")}
            activo={filtroEstado === "abiertos"}
            texto="Abiertos"
            cantidad={abiertos}
            descripcion="En trámite: recepción, área médica, área legal, licencia activa o sin baja"
          />
          <Chip
            href={hrefEstado("cerrados")}
            activo={filtroEstado === "cerrados"}
            texto="Cerrados"
            cantidad={cerrados}
            descripcion="Alta médica, rechazados, desistidos y cerrados"
          />
          <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
          {[...ABIERTOS, ...CERRADOS].map((e) => (
            <Chip
              key={e}
              href={hrefEstado(e)}
              activo={filtroEstado === e}
              texto={ESTADO_INFO[e].nombre}
              cantidad={conteo[e]}
              claseCantidad={ESTADO_INFO[e].badge}
              descripcion={ESTADO_INFO[e].descripcion}
            />
          ))}
        </nav>

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            <span className="font-medium text-foreground">{plural(filas.length, "expediente")}</span>
            {detalleFiltro.length ? ` ${detalleFiltro.join(", ")}` : null}
          </p>
          {filas.length >= LIMITE ? (
            <p className="text-xs text-muted-foreground">
              Se muestran los primeros {LIMITE}: afiná la búsqueda para ver el resto.
            </p>
          ) : null}
        </div>

        <div data-recorrido="lista-expedientes">
        <TablaExpedientes
          filas={filas}
          vacio={
            hayFiltros
              ? "No hay expedientes con estos filtros. Probá con otro estado o limpiá la búsqueda."
              : "Todavía no se cargó ninguna denuncia."
          }
          columnas={[
            {
              titulo: "Recibida",
              className: "hidden text-xs md:table-cell",
              celda: (f) => (
                <>
                  <span className="block">{formatoFecha(fechaDe(f.recibido_en))}</span>
                  <span className="text-muted-foreground">{formatoHora(f.recibido_en)} h</span>
                </>
              ),
            },
          ]}
        />
        </div>

        <p className="text-xs text-muted-foreground">
          ¿Buscás un siniestro del sistema anterior? Usá la{" "}
          <Link href="/buscar" className="text-primary underline-offset-2 hover:underline">
            búsqueda unificada
          </Link>
          , que trae los dos sistemas por año.
        </p>
      </div>
    </>
  );
}
