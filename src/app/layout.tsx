import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "UERT · Gestión de denuncias", template: "%s · UERT" },
  description: "MVP del sistema de gestión de denuncias de la Unidad Ejecutora de Riesgos del Trabajo (demo con datos ficticios).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Fondo opaco en <html>: el body es semitransparente (bg-muted/40) y, sin esto,
  // un navegador con fondo oscuro lo dejaba gris oscuro. La app no tiene tema
  // oscuro, por eso los avisos (sonner) van siempre en claro.
  return (
    <html lang="es-AR" className={`${geistSans.variable} ${geistMono.variable} h-full bg-background antialiased`}>
      <body className="min-h-full bg-muted/40 text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="light" richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
