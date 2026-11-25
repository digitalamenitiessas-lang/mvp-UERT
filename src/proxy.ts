import { NextResponse, type NextRequest } from "next/server";

/**
 * Control optimista: sin usuario de la demo elegido, a /ingresar.
 * Las páginas y las acciones vuelven a validar el usuario en el servidor.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.get("uert_demo_usuario")?.value) {
    // nextUrl conserva el basePath (/uert en la VPS); new URL("/ingresar") lo perdía.
    const destino = request.nextUrl.clone();
    destino.pathname = "/ingresar";
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!ingresar|api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp)$).*)"],
};
