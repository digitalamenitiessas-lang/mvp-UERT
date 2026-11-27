/**
 * Guion del recorrido guiado: que cada pantalla tenga su recorrido, que el
 * circuito caiga en la pantalla correcta al cambiar de rol y que cada
 * elemento que se marca exista en el código (atributo data-recorrido).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROL_INFO, ROLES } from "@/lib/dominio/constantes";
import { CIRCUITO, etapaVisible, IDS_PANTALLAS, OBJETIVOS, pantallaDe, PASOS_CIRCUITO } from "@/lib/recorrido/guion";

describe("Recorrido de cada pantalla", () => {
  it.each([
    ["/mesa", "mesa"],
    ["/mesa/nueva", "mesa-nueva"],
    ["/medica", "medica"],
    ["/legal", "legal"],
    ["/seguimiento", "seguimiento"],
    ["/direccion", "direccion"],
    ["/srt", "srt"],
    ["/expedientes", "expedientes"],
    ["/expedientes/12", "ficha"],
    ["/buscar", "buscar"],
    ["/admin", "admin"],
  ])("%s → %s", (ruta, id) => {
    expect(pantallaDe(ruta)?.id).toBe(id);
  });

  it("las pantallas sin recorrido no tienen", () => {
    expect(pantallaDe("/imprimir/constancia/3")).toBeNull();
    expect(pantallaDe("/expedientes/12/editar")).toBeNull();
  });

  it("todas tienen pasos para cada rol, con texto y un objetivo conocido", () => {
    for (const id of IDS_PANTALLAS) {
      const pantalla = pantallaDe(id === "ficha" ? "/expedientes/1" : id === "mesa-nueva" ? "/mesa/nueva" : `/${id}`)!;
      for (const rol of ROLES) {
        const pasos = pantalla.pasos(rol);
        expect(pasos.length, `${id} · ${rol}`).toBeGreaterThan(1);
        for (const p of pasos) {
          expect(p.titulo && p.texto, `${id} · ${p.titulo}`).toBeTruthy();
          if (p.objetivo) expect(OBJETIVOS).toContain(p.objetivo);
        }
      }
    }
  });

  it("si la bandeja es de otra área, explica cómo cambiar de rol", () => {
    const legal = pantallaDe("/legal")!;
    expect(legal.pasos("legal").some((p) => p.objetivo === "selector-rol")).toBe(false);
    expect(legal.pasos("medico").some((p) => p.objetivo === "selector-rol")).toBe(true);
  });
});

describe("Recorrido del circuito", () => {
  it("recorre las cinco áreas en orden", () => {
    const etapas = PASOS_CIRCUITO.map((p) => etapaVisible(p.etapa)?.nombre).filter(Boolean);
    expect([...new Set(etapas)]).toEqual(["Mesa de entrada", "Área médica", "Área legal", "Seguimiento", "Dirección"]);
  });

  it("al cambiar de rol, llega a una pantalla a la que cambiarUsuario redirige", () => {
    // cambiarUsuario se queda en fichas y listados; si no, va al inicio del rol nuevo.
    CIRCUITO.forEach((etapa, i) => {
      const anterior = CIRCUITO[i - 1];
      if (anterior && anterior.rol === etapa.rol) return;
      if (typeof etapa.ruta === "string") expect(etapa.ruta, etapa.id).toBe(ROL_INFO[etapa.rol].inicio);
    });
  });

  it("cada etapa tiene pasos y objetivos conocidos", () => {
    for (const etapa of CIRCUITO) {
      expect(etapa.pasos.length, etapa.id).toBeGreaterThan(0);
      for (const p of etapa.pasos) if (p.objetivo) expect(OBJETIVOS).toContain(p.objetivo);
    }
  });
});

describe("Elementos marcados en la aplicación", () => {
  const archivos = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const ruta = join(dir, f);
      return statSync(ruta).isDirectory() ? archivos(ruta) : /\.tsx?$/.test(f) ? [ruta] : [];
    });
  const codigo = archivos(join(process.cwd(), "src"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  it.each(OBJETIVOS.filter((o) => o !== "encabezado"))("«%s» está marcado", (objetivo) => {
    const marcado =
      codigo.includes(`data-recorrido="${objetivo}"`) || codigo.includes(`recorrido="${objetivo}"`);
    expect(marcado).toBe(true);
  });

  it("«encabezado» es la marca por defecto del encabezado de página", () => {
    expect(codigo).toContain('recorrido = "encabezado"');
  });
});
