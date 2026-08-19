import type { Metadata } from "next";

import { MONOGRAMMA } from "@/marchio";

import "./globals.css";

export const metadata: Metadata = {
  title: "RAL Chiara — da RAL a netto, anno d'imposta 2026",
  description:
    "Calcolatore da retribuzione annua lorda a netto per l'anno d'imposta 2026, con la scomposizione completa di ogni trattenuta e il riferimento normativo di ogni voce. Prototipo dimostrativo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <link rel="icon" type="image/png" href={MONOGRAMMA} />
        <link rel="apple-touch-icon" href={MONOGRAMMA} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@400;450;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
