import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mi Chofer | Sistema de Operaciones",
  description: "Calculadora profesional de viajes con Google Maps, caja, dashboard, configuracion y auditorias"
};

export const viewport: Viewport = {
  themeColor: "#06163e",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
