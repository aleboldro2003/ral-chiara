/**
 * Metadati del progetto che l'interfaccia mostra.
 *
 * L'URL del repository non è scritto a mano: viene dal campo `repository` di
 * package.json, che a sua volta è stato popolato dal remote Git. Una sola
 * fonte, e nessun link che resta indietro se il repository si sposta.
 */

import pacchetto from "../package.json";

function ripulisci(url: string): string {
  return url
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git@github\.com:/, "https://github.com/");
}

export const REPOSITORY: string | null = pacchetto.repository?.url
  ? ripulisci(pacchetto.repository.url)
  : null;
