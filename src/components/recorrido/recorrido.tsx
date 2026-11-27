"use client";

/**
 * Recorrido guiado (system tour): oscurece la pantalla, marca un elemento y
 * explica qué es y qué se puede hacer, paso a paso.
 *
 * - Recorrido de la pantalla: el de la ruta y el rol actuales (src/lib/recorrido/guion.ts).
 * - Recorrido del circuito: va por todas las áreas cambiando solo de rol y de
 *   pantalla. Al cambiar de rol Next rearma la página: el paso se guarda en
 *   sessionStorage y el recorrido sigue solo.
 *
 * La primera vez que se entra a una pantalla con recorrido, se ofrece.
 */
import { createContext, useContext, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CompassIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { accionExpedienteDeEjemplo, cambiarUsuario } from "@/app/acciones";
import { SolSDE } from "@/components/asistente/avatar";
import { TextoConNegrita } from "@/components/comun/texto-con-negrita";
import { Button } from "@/components/ui/button";
import { ROL_INFO, type Rol } from "@/lib/dominio/constantes";
import {
  CIRCUITO,
  etapaVisible,
  pantallaDe,
  PASOS_CIRCUITO,
  type PantallaRecorrido,
  type PasoRecorrido,
} from "@/lib/recorrido/guion";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Estado guardado
// ---------------------------------------------------------------------------
interface Estado {
  tipo: "pantalla" | "circuito";
  paso: number;
  /** Id de la pantalla (recorrido de pantalla). */
  pantalla?: string;
  /** Rutas de las fichas de ejemplo del circuito, por etapa. */
  destinos?: Record<string, string>;
}

const CLAVE = "uert_recorrido_v1";
const CLAVE_VISTAS = "uert_recorrido_vistas";
const CLAVE_NO_OFRECER = "uert_recorrido_no_ofrecer";

function leer<T>(clave: string): T | null {
  try {
    const v = window.sessionStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function escribir(clave: string, valor: unknown) {
  try {
    if (valor === null) window.sessionStorage.removeItem(clave);
    else window.sessionStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento: el recorrido no sobrevive a un cambio de rol.
  }
}

/** Para arrancar el circuito desde /ingresar, antes de entrar con un rol. */
export function prepararCircuito() {
  escribir(CLAVE, { tipo: "circuito", paso: 0 } satisfies Estado);
}

function marcarVista(id: string) {
  const vistas = leer<string[]>(CLAVE_VISTAS) ?? [];
  if (!vistas.includes(id)) escribir(CLAVE_VISTAS, [...vistas, id]);
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------
interface ContextoRecorrido {
  activo: boolean;
  /** Se está ofreciendo el recorrido de la pantalla (el aviso de Yanapa espera). */
  ofreciendo: boolean;
  /** Recorrido de la pantalla actual (null si no tiene). */
  pantalla: PantallaRecorrido | null;
  iniciarPantalla: () => void;
  iniciarCircuito: () => void;
}

const Contexto = createContext<ContextoRecorrido | null>(null);

/** null fuera de la aplicación (por ejemplo, en /ingresar). */
export function useRecorrido() {
  return useContext(Contexto);
}

// ---------------------------------------------------------------------------
// Proveedor
// ---------------------------------------------------------------------------
export function ProveedorRecorrido({
  rol,
  usuariosPorRol,
  children,
}: {
  rol: Rol;
  /** Id del usuario de la demo de cada rol (para cambiar de rol en el circuito). */
  usuariosPorRol: Partial<Record<Rol, number>>;
  children: React.ReactNode;
}) {
  const ruta = usePathname();
  const router = useRouter();
  const [, iniciarTransicion] = useTransition();
  const [estado, setEstado] = useState<Estado | null>(null);
  /** Mensaje mientras se cambia de rol o se busca una ficha de ejemplo. */
  const [espera, setEspera] = useState<string | null>(null);
  const [oferta, setOferta] = useState<PantallaRecorrido | null>(null);

  const pantalla = pantallaDe(ruta);

  // El recorrido de pantalla termina si se va a otra pantalla.
  const vigente = estado && (estado.tipo === "circuito" || estado.pantalla === pantalla?.id) ? estado : null;
  const pasos: PasoRecorrido[] = !vigente
    ? []
    : vigente.tipo === "circuito"
      ? PASOS_CIRCUITO
      : (pantalla?.pasos(rol) ?? []);
  const indice = vigente ? Math.min(vigente.paso, pasos.length - 1) : 0;

  const guardar = (e: Estado | null) => {
    setEstado(e);
    escribir(CLAVE, e);
  };

  const terminar = () => {
    guardar(null);
    setEspera(null);
  };

  // Al montar: si había un recorrido en curso (cambio de rol), sigue.
  const retomar = useEffectEvent(() => {
    const guardado = leer<Estado>(CLAVE);
    if (guardado?.tipo === "circuito") setEstado(guardado);
    else if (guardado?.tipo === "pantalla" && guardado.pantalla === pantalla?.id) setEstado(guardado);
  });
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => retomar());
    return () => cancelAnimationFrame(cuadro);
  }, []);

  // Ofrecer el recorrido la primera vez que se entra a una pantalla.
  const evaluarOferta = useEffectEvent(() => {
    if (!pantalla || estado || leer(CLAVE_NO_OFRECER) || leer(CLAVE)) return;
    if ((leer<string[]>(CLAVE_VISTAS) ?? []).includes(pantalla.id)) return;
    marcarVista(pantalla.id);
    setOferta(pantalla);
  });
  useEffect(() => {
    const t = window.setTimeout(() => evaluarOferta(), 1500);
    return () => window.clearTimeout(t);
  }, [ruta]);

  // --- Navegación del circuito -------------------------------------------
  /** Lleva al paso `i` del circuito: cambia de rol o de pantalla si hace falta. */
  async function irAlPasoDelCircuito(base: Estado, i: number, sentido: 1 | -1) {
    let destino = i;
    let destinos = base.destinos ?? {};
    // Busca la ficha de ejemplo; si no hay expediente en ese estado, saltea la etapa.
    while (destino >= 0 && destino < PASOS_CIRCUITO.length) {
      const etapa = CIRCUITO[PASOS_CIRCUITO[destino].etapa];
      if (typeof etapa.ruta === "string" || destinos[etapa.id]) break;
      setEspera("Buscando un expediente de ejemplo…");
      const id = await accionExpedienteDeEjemplo(etapa.ruta.expedienteEn);
      if (id) {
        destinos = { ...destinos, [etapa.id]: `/expedientes/${id}` };
        break;
      }
      // Sin ejemplo: a la primera (o última) de la etapa siguiente (o anterior).
      while (destino >= 0 && destino < PASOS_CIRCUITO.length && PASOS_CIRCUITO[destino].etapa === PASOS_CIRCUITO[i].etapa) {
        destino += sentido;
      }
    }
    if (destino < 0 || destino >= PASOS_CIRCUITO.length) {
      setEspera(null);
      if (destino >= PASOS_CIRCUITO.length) terminar();
      return;
    }
    const etapa = CIRCUITO[PASOS_CIRCUITO[destino].etapa];
    const rutaEtapa = typeof etapa.ruta === "string" ? etapa.ruta : destinos[etapa.id];
    const nuevo: Estado = { tipo: "circuito", paso: destino, destinos };
    guardar(nuevo);
    // Las pantallas que muestra el circuito ya no se ofrecen después.
    const vista = pantallaDe(rutaEtapa);
    if (vista) marcarVista(vista.id);
    if (etapa.rol !== rol) {
      const usuario = usuariosPorRol[etapa.rol];
      if (!usuario) return terminar();
      setEspera(`Cambiando a ${ROL_INFO[etapa.rol].nombre}…`);
      iniciarTransicion(() => cambiarUsuario(usuario, rutaEtapa));
      return;
    }
    setEspera(null);
    if (rutaEtapa !== ruta) router.push(rutaEtapa);
  }

  const ir = (i: number, sentido: 1 | -1) => {
    if (!vigente) return;
    if (i >= pasos.length) return terminar();
    if (i < 0) return;
    if (vigente.tipo === "pantalla") return guardar({ ...vigente, paso: i });
    void irAlPasoDelCircuito(vigente, i, sentido);
  };

  const iniciarPantalla = () => {
    if (!pantalla) return;
    setOferta(null);
    marcarVista(pantalla.id);
    guardar({ tipo: "pantalla", paso: 0, pantalla: pantalla.id });
  };

  const iniciarCircuito = () => {
    setOferta(null);
    void irAlPasoDelCircuito({ tipo: "circuito", paso: 0 }, 0, 1);
  };

  // ¿El circuito está en la pantalla y con el rol del paso?
  const etapaActual = vigente?.tipo === "circuito" ? CIRCUITO[PASOS_CIRCUITO[indice].etapa] : null;
  const rutaEtapa = etapaActual
    ? typeof etapaActual.ruta === "string"
      ? etapaActual.ruta
      : vigente?.destinos?.[etapaActual.id]
    : undefined;
  const enLugar = !etapaActual || (etapaActual.rol === rol && (!rutaEtapa || rutaEtapa === ruta));

  // Si quedó con el rol correcto pero en otra pantalla (p. ej. después de recargar), va a la del paso.
  const acomodar = useEffectEvent(() => {
    if (etapaActual && etapaActual.rol === rol && rutaEtapa && rutaEtapa !== ruta && !espera) router.push(rutaEtapa);
  });
  useEffect(() => {
    if (!enLugar) acomodar();
  }, [enLugar]);

  const valor: ContextoRecorrido = {
    activo: Boolean(vigente) || Boolean(espera),
    ofreciendo: oferta !== null,
    pantalla,
    iniciarPantalla,
    iniciarCircuito,
  };

  return (
    <Contexto.Provider value={valor}>
      {children}
      {espera ? (
        <Espera texto={espera} onSalir={terminar} />
      ) : vigente && pasos.length ? (
        enLugar ? (
          <Escena
            key={`${vigente.tipo}-${indice}-${ruta}`}
            paso={pasos[indice]}
            indice={indice}
            total={pasos.length}
            etiqueta={vigente.tipo === "circuito" ? "Recorrido del circuito" : `Recorrido · ${pantalla?.nombre ?? ""}`}
            etapa={vigente.tipo === "circuito" ? etapaVisible(PASOS_CIRCUITO[indice].etapa) : null}
            siguienteTexto={textoSiguiente(vigente, indice, pasos.length, rol)}
            onAnterior={() => ir(indice - 1, -1)}
            onSiguiente={() => ir(indice + 1, 1)}
            onSaltear={(sentido) => ir(indice + sentido, sentido)}
            onSalir={terminar}
          />
        ) : etapaActual && etapaActual.rol !== rol ? (
          <Desfasado
            area={ROL_INFO[etapaActual.rol].nombre}
            onIr={() => ir(indice, 1)}
            onSalir={terminar}
          />
        ) : (
          <Espera texto="Abriendo la pantalla…" onSalir={terminar} />
        )
      ) : null}
      {oferta && !vigente && !espera ? (
        <Oferta
          pantalla={oferta}
          pasos={oferta.pasos(rol).length}
          onAceptar={iniciarPantalla}
          onCerrar={() => setOferta(null)}
          onNoOfrecer={() => {
            escribir(CLAVE_NO_OFRECER, true);
            setOferta(null);
          }}
        />
      ) : null}
    </Contexto.Provider>
  );
}

/** Texto del botón «Siguiente»: avisa si el próximo paso cambia de área. */
function textoSiguiente(estado: Estado, indice: number, total: number, rol: Rol): string {
  if (indice >= total - 1) return estado.tipo === "circuito" ? "Terminar" : "Listo";
  if (estado.tipo !== "circuito") return "Siguiente";
  const proxima = CIRCUITO[PASOS_CIRCUITO[indice + 1].etapa];
  return proxima.rol !== rol ? `Ir a ${ROL_INFO[proxima.rol].nombre}` : "Siguiente";
}

// ---------------------------------------------------------------------------
// Escena: foco + tarjeta
// ---------------------------------------------------------------------------
interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const MARGEN = 12;
const RELLENO = 8;
const ESPERA_MAXIMA_MS = 4000;

function buscarVisible(objetivo: string): HTMLElement | null {
  const candidatos = document.querySelectorAll<HTMLElement>(`[data-recorrido="${objetivo}"]`);
  for (const el of candidatos) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function esFijo(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const pos = getComputedStyle(n).position;
    if (pos === "fixed" || pos === "sticky") return true;
  }
  return false;
}

function Escena({
  paso,
  indice,
  total,
  etiqueta,
  etapa,
  siguienteTexto,
  onAnterior,
  onSiguiente,
  onSaltear,
  onSalir,
}: {
  paso: PasoRecorrido;
  indice: number;
  total: number;
  etiqueta: string;
  etapa: { numero: number; total: number; nombre: string } | null;
  siguienteTexto: string;
  onAnterior: () => void;
  onSiguiente: () => void;
  onSaltear: (sentido: 1 | -1) => void;
  onSalir: () => void;
}) {
  // "buscando" → "listo" (con o sin elemento)
  const [fase, setFase] = useState<"buscando" | "listo">(paso.objetivo ? "buscando" : "listo");
  const [rect, setRect] = useState<Rect | null>(null);
  const elemento = useRef<HTMLElement | null>(null);
  const sentido = useRef<1 | -1>(1);

  // Buscar el elemento (puede tardar: la pantalla se está cargando).
  const alEncontrar = useEffectEvent((el: HTMLElement | null) => {
    if (!el) {
      if (paso.opcional) onSaltear(sentido.current);
      else setFase("listo");
      return;
    }
    elemento.current = el;
    const r = el.getBoundingClientRect();
    if (!esFijo(el)) {
      const cabecera = document.querySelector("header.sticky")?.getBoundingClientRect().bottom ?? 0;
      const movil = window.innerWidth < 640;
      const libre = window.innerHeight - cabecera;
      const arriba = movil || r.height > libre * 0.55 ? cabecera + 16 : cabecera + Math.max(16, (libre - r.height) / 2 - 80);
      window.scrollBy({ top: r.top - arriba, behavior: "smooth" });
    }
    // El foco arranca donde está el elemento y lo sigue mientras se desplaza la página.
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    setFase("listo");
  });
  useEffect(() => {
    if (!paso.objetivo) return;
    const inicio = performance.now();
    const objetivo = paso.objetivo;
    const t = window.setInterval(() => {
      const el = buscarVisible(objetivo);
      if (el || performance.now() - inicio > (paso.opcional ? 1500 : ESPERA_MAXIMA_MS)) {
        window.clearInterval(t);
        alEncontrar(el);
      }
    }, 100);
    return () => window.clearInterval(t);
  }, [paso.objetivo, paso.opcional]);

  // Seguir al elemento (scroll, cambios de tamaño).
  useEffect(() => {
    if (fase !== "listo" || !elemento.current) return;
    let cuadro = 0;
    let previo = "";
    const medir = () => {
      const el = elemento.current;
      if (el) {
        const r = el.getBoundingClientRect();
        const clave = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
        if (clave !== previo) {
          previo = clave;
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      }
      cuadro = requestAnimationFrame(medir);
    };
    cuadro = requestAnimationFrame(medir);
    return () => cancelAnimationFrame(cuadro);
  }, [fase]);

  // Teclado: ← → y Escape.
  const tecla = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") onSalir();
    else if (e.key === "ArrowRight") {
      sentido.current = 1;
      onSiguiente();
    } else if (e.key === "ArrowLeft" && indice > 0) {
      sentido.current = -1;
      onAnterior();
    }
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => tecla(e);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  if (fase === "buscando") return <Espera texto="Cargando la pantalla…" onSalir={onSalir} />;

  const conFoco = rect !== null;
  return (
    <>
      {/* Bloquea los clics fuera de la tarjeta (es una demostración guiada). */}
      <div className={cn("fixed inset-0 z-[69]", !conFoco && "bg-[rgba(6,18,56,0.58)] motion-safe:animate-in motion-safe:fade-in")} aria-hidden />
      {conFoco ? <Foco rect={rect} /> : null}
      <Tarjeta
        rect={rect}
        paso={paso}
        indice={indice}
        total={total}
        etiqueta={etiqueta}
        etapa={etapa}
        siguienteTexto={siguienteTexto}
        onAnterior={() => {
          sentido.current = -1;
          onAnterior();
        }}
        onSiguiente={() => {
          sentido.current = 1;
          onSiguiente();
        }}
        onSalir={onSalir}
      />
    </>
  );
}

/** El «agujero» iluminado sobre el elemento: el resto queda oscuro. */
function Foco({ rect }: { rect: Rect }) {
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const top = Math.max(rect.top - RELLENO, 4);
  const bottom = Math.min(rect.top + rect.height + RELLENO, vh - 4);
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[70] rounded-xl ring-2 ring-sde-celeste transition-all duration-300 ease-out"
      style={{
        top,
        left: rect.left - RELLENO,
        width: rect.width + RELLENO * 2,
        height: Math.max(bottom - top, 0),
        boxShadow: "0 0 0 9999px rgba(6, 18, 56, 0.58), 0 0 0 6px rgba(0, 160, 229, 0.18)",
      }}
    />
  );
}

function Tarjeta({
  rect,
  paso,
  indice,
  total,
  etiqueta,
  etapa,
  siguienteTexto,
  onAnterior,
  onSiguiente,
  onSalir,
}: {
  rect: Rect | null;
  paso: PasoRecorrido;
  indice: number;
  total: number;
  etiqueta: string;
  etapa: { numero: number; total: number; nombre: string } | null;
  siguienteTexto: string;
  onAnterior: () => void;
  onSiguiente: () => void;
  onSalir: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const siguiente = useRef<HTMLButtonElement>(null);
  // Solo se dibuja en el navegador (después de una acción del usuario): se puede leer window.
  const [tam, setTam] = useState({ w: 360, h: 220 });
  const [vista, setVista] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    // ResizeObserver avisa apenas empieza a observar: ahí se toma la primera medida.
    const ro = new ResizeObserver(() => setTam({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    const alCambiar = () => setVista({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", alCambiar);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", alCambiar);
    };
  }, []);

  useEffect(() => {
    siguiente.current?.focus({ preventScroll: true });
  }, []);

  const movil = vista.w < 640;
  let estilo: React.CSSProperties;
  if (movil) {
    estilo = { left: MARGEN, right: MARGEN, bottom: MARGEN };
  } else if (!rect) {
    estilo = { left: (vista.w - tam.w) / 2, top: Math.max(MARGEN, (vista.h - tam.h) / 2) };
  } else {
    const centroX = rect.left + rect.width / 2 - tam.w / 2;
    const x = Math.min(Math.max(centroX, MARGEN), vista.w - tam.w - MARGEN);
    const abajo = rect.top + rect.height + RELLENO + MARGEN;
    const arriba = rect.top - RELLENO - MARGEN - tam.h;
    if (abajo + tam.h <= vista.h - MARGEN) estilo = { left: x, top: abajo };
    else if (arriba >= MARGEN) estilo = { left: x, top: arriba };
    else if (rect.left - RELLENO - MARGEN - tam.w >= MARGEN) {
      // A la izquierda (por ejemplo, la columna de acciones de la ficha).
      estilo = {
        left: rect.left - RELLENO - MARGEN - tam.w,
        top: Math.min(Math.max(rect.top, MARGEN), vista.h - tam.h - MARGEN),
      };
    } else if (rect.left + rect.width + RELLENO + MARGEN + tam.w <= vista.w - MARGEN) {
      estilo = {
        left: rect.left + rect.width + RELLENO + MARGEN,
        top: Math.min(Math.max(rect.top, MARGEN), vista.h - tam.h - MARGEN),
      };
    } else {
      // El elemento ocupa casi toda la pantalla: abajo a la derecha, encima.
      estilo = { left: vista.w - tam.w - 24, top: vista.h - tam.h - 24 };
    }
  }

  const progreso = ((indice + 1) / total) * 100;
  return (
    <div
      ref={caja}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recorrido-titulo"
      aria-describedby="recorrido-texto"
      className="fixed z-[71] w-auto overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-black/5 transition-[top,left] duration-300 ease-out motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 sm:w-[360px]"
      style={estilo}
    >
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progreso}%` }} />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-white">
            <SolSDE className="size-4" />
          </span>
          <span className="truncate text-[11px] font-semibold tracking-wide text-primary uppercase">{etiqueta}</span>
          <button
            type="button"
            onClick={onSalir}
            className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            aria-label="Salir del recorrido"
            title="Salir (Esc)"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        {etapa ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-primary">
            Etapa {etapa.numero} de {etapa.total} · {etapa.nombre}
          </p>
        ) : null}
        <h2 id="recorrido-titulo" className="mt-2 text-base leading-snug font-semibold">
          {paso.titulo}
        </h2>
        <p id="recorrido-texto" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          <TextoConNegrita texto={paso.texto} />
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {indice + 1} de {total}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {indice > 0 ? (
              <Button variant="ghost" size="sm" onClick={onAnterior}>
                <ArrowLeftIcon />
                Anterior
              </Button>
            ) : null}
            <Button ref={siguiente} size="sm" onClick={onSiguiente}>
              {siguienteTexto}
              {indice < total - 1 ? <ArrowRightIcon /> : null}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estados intermedios y oferta
// ---------------------------------------------------------------------------
function Espera({ texto, onSalir }: { texto: string; onSalir: () => void }) {
  return (
    <div className="fixed inset-0 z-[69] flex items-center justify-center bg-[rgba(6,18,56,0.58)] p-4 motion-safe:animate-in motion-safe:fade-in">
      <div className="flex items-center gap-3 rounded-2xl bg-background px-5 py-4 shadow-2xl" role="status">
        <LoaderCircleIcon className="size-5 text-primary motion-safe:animate-spin" />
        <span className="text-sm font-medium">{texto}</span>
        <button
          type="button"
          onClick={onSalir}
          className="ml-2 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Salir del recorrido"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** El paso es de otra área y el cambio de rol no se hizo (o se deshizo). */
function Desfasado({ area, onIr, onSalir }: { area: string; onIr: () => void; onSalir: () => void }) {
  return (
    <div className="fixed inset-0 z-[69] flex items-center justify-center bg-[rgba(6,18,56,0.58)] p-4">
      <div className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-2xl" role="dialog" aria-modal="true">
        <p className="text-base font-semibold">El recorrido sigue en {area}</p>
        <p className="mt-1 text-sm text-muted-foreground">Cambio de rol para continuar.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onSalir}>
            Salir
          </Button>
          <Button size="sm" onClick={onIr}>
            Ir a {area}
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Oferta({
  pantalla,
  pasos,
  onAceptar,
  onCerrar,
  onNoOfrecer,
}: {
  pantalla: PantallaRecorrido;
  pasos: number;
  onAceptar: () => void;
  onCerrar: () => void;
  onNoOfrecer: () => void;
}) {
  return (
    <div
      className="no-imprimir fixed bottom-4 left-4 z-40 w-[calc(100vw-7rem)] max-w-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
      role="dialog"
      aria-label="Recorrido de esta pantalla"
    >
      <div className="relative overflow-hidden rounded-2xl border bg-background shadow-lg">
        <div className="h-1 bg-primary" />
        <div className="p-3.5">
          <button
            type="button"
            onClick={onCerrar}
            className="absolute top-2.5 right-2 rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <XIcon className="size-3.5" />
          </button>
          <p className="flex items-center gap-1.5 pr-6 text-sm font-semibold">
            <CompassIcon className="size-4 text-primary" />
            ¿Te muestro esta pantalla?
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {pantalla.nombre} · {pasos} pasos, menos de un minuto.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={onAceptar}>
              Mostrame
            </Button>
            <Button size="sm" variant="ghost" onClick={onCerrar}>
              Ahora no
            </Button>
          </div>
          <button
            type="button"
            onClick={onNoOfrecer}
            className="mt-2 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            No volver a ofrecer
          </button>
        </div>
      </div>
    </div>
  );
}
