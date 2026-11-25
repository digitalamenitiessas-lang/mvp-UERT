import type { NextConfig } from "next";

// En la VPS la app vive en https://vps.marcorossi.com.ar/uert (el dominio ya
// lo usan otras apps), así que se compila con basePath "/uert". En desarrollo
// no se define y queda en la raíz. Ver src/lib/rutas.ts.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
if (basePath && !/^\/[a-z0-9-]+$/.test(basePath)) {
  throw new Error(`NEXT_PUBLIC_BASE_PATH inválido: "${basePath}" (ej.: /uert)`);
}

const nextConfig: NextConfig = {
  basePath,
  // Cache Components queda desactivado a propósito (igual que en Oakland):
  // todas las pantallas dependen del usuario de la demo y de datos que cambian
  // con cada acción, así que preferimos render dinámico por pedido.
  //
  // pg y PGlite se usan tal cual desde node_modules: no se empaquetan.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // Es una demo con datos ficticios: que no la indexe ningún buscador.
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // Las pantallas dependen del usuario de la demo: nada de caché
        // intermedia. Los assets de /_next/static quedan afuera a propósito.
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
