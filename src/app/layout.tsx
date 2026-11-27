import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Figtree: amable y muy legible en tablas densas (sde.gob.ar usa Blinker, que
// en la app resultaba dura). Es variable: trae todos los pesos.
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "UERT · Gestión de denuncias", template: "%s · UERT" },
  description:
    "MVP del sistema de gestión de denuncias de la Unidad Ejecutora de Riesgos del Trabajo · Gobierno de la Provincia de Santiago del Estero (demo con datos ficticios).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Fondo opaco en <html> por si el body quedara semitransparente: un navegador
  // con fondo oscuro lo dejaba gris oscuro. El body lleva el gris lavanda de
  // sde.gob.ar (--muted). La app no tiene tema oscuro, por eso los avisos
  // (sonner) van siempre en claro.
  return (
    <html lang="es-AR" className={`${figtree.variable} ${geistMono.variable} h-full bg-background antialiased`}>
      <body className="min-h-full bg-muted text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="light" richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
