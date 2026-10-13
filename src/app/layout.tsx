import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Disclaimer } from "@/components/Disclaimer";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Mercado", template: "%s · Mercado" },
  description: "Ranking, fichas y predicción de volatilidad de acciones de EE. UU. (proyecto educativo).",
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  await connection(); // render dinámico: la CSP lleva un nonce distinto por petición
  return (
    <html lang="es">
      <body>
        <a className="skip" href="#contenido">
          Saltar al contenido
        </a>
        <header>
          <p className="brand">Mercado</p>
          <Nav />
        </header>
        <main id="contenido">{children}</main>
        <footer>
          <Disclaimer />
          <p className="muted">
            Datos de la API propia del proyecto 3 (origen: Yahoo Finance vía yfinance; sin afiliación; uso educativo y no comercial).
          </p>
        </footer>
      </body>
    </html>
  );
}