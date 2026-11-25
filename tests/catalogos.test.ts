// Búsqueda en los catálogos de la SRT (RF-31): por código o por palabras, sin acentos.
import { beforeAll, describe, expect, it } from "vitest";
import { crearPglite, type Db } from "@/lib/db";
import { migrar } from "@/lib/db/migrar";
import { cargarCatalogos } from "@/lib/demo/catalogos";
import { buscarEnCatalogo } from "@/lib/datos/catalogos";

let db: Db;
beforeAll(async () => {
  db = await crearPglite(":memory:");
  await migrar(db);
  await cargarCatalogos(db);
}, 120_000);

describe("buscarEnCatalogo", () => {
  it("encuentra por varias palabras en cualquier orden y sin acentos", async () => {
    for (const q of ["fractura muñeca", "muneca fractura", "FRACTURA  MUÑECA"]) {
      const r = await buscarEnCatalogo(db, "cie10", q);
      expect(r.map((x) => x.codigo), q).toContain("S62");
    }
  });
  it("busca por código con o sin punto", async () => {
    expect((await buscarEnCatalogo(db, "cie10", "s62.0"))[0]?.codigo).toBe("S620");
    expect((await buscarEnCatalogo(db, "cie10", "S62"))[0]?.codigo).toBe("S62");
  });
  it("sin consulta devuelve los primeros", async () => {
    expect((await buscarEnCatalogo(db, "cie10", "")).length).toBe(30);
    expect((await buscarEnCatalogo(db, "localidad", "")).length).toBe(30);
    expect((await buscarEnCatalogo(db, "localidad", "   ")).length).toBe(30);
  });
  it("localidades por palabras y por código postal", async () => {
    expect((await buscarEnCatalogo(db, "localidad", "banda bajo")).map((x) => x.descripcion)).toContain("BAJO GRANDE (DTO.BANDA)");
    expect((await buscarEnCatalogo(db, "localidad", "4338")).length).toBeGreaterThan(0);
  });
  it("los comodines de LIKE se buscan como texto", async () => {
    // Hay descripciones con "%" de verdad (quemaduras por superficie del cuerpo).
    const conPorcentaje = await buscarEnCatalogo(db, "cie10", "%");
    expect(conPorcentaje.length).toBeGreaterThan(0);
    expect(conPorcentaje.every((x) => x.descripcion.includes("%"))).toBe(true);
    expect(await buscarEnCatalogo(db, "cie10", "_")).toEqual([]);
    expect(await buscarEnCatalogo(db, "localidad", "%%")).toEqual([]);
  });
});
