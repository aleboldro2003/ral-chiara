/**
 * Punto di ingresso della versione a file singolo.
 *
 * Monta esattamente gli stessi componenti dell'app Next.js: non è una seconda
 * implementazione dell'interfaccia, è lo stesso albero React con un altro
 * bootstrap. Serve a ottenere una pagina autoportante, senza server e senza
 * richieste di rete oltre ai font.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Calcolatore } from "@/components/Calcolatore";
import { Intestazione, PiePagina } from "@/components/Cornice";

function Pagina() {
  return (
    <div style={{ minHeight: "100vh", background: "#EFEBE3" }}>
      <Intestazione />
      <main>
        <Calcolatore />
      </main>
      <PiePagina />
    </div>
  );
}

const radice = document.getElementById("radice");
if (!radice) throw new Error("Manca il nodo #radice nella pagina.");

createRoot(radice).render(
  <StrictMode>
    <Pagina />
  </StrictMode>,
);
