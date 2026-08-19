/**
 * Registro dei parametri per anno d'imposta.
 *
 * È l'unico punto in cui il motore incontra un file JSON. Aggiungere l'anno
 * 2027 significa creare `parametri-2027.json` e aggiungere una riga qui: nessun
 * modulo di calcolo va toccato.
 *
 * Il cast a `ParametriAnno` è l'unico del progetto e serve a restringere i tipi
 * larghi che TypeScript deriva da un import JSON (`string` invece delle union
 * letterali come "progressivaPerScaglioni"). Non è una verifica: la validazione
 * strutturale a runtime, che è ciò che protegge davvero da un file di parametri
 * malformato, vive nel motore ed è agganciata qui sotto.
 */

import parametri2026 from "./parametri-2026.json";
import type { ParametriAnno } from "./tipi";

export const ANNO_PREDEFINITO = 2026;

const REGISTRO: ReadonlyMap<number, ParametriAnno> = new Map([
  [2026, parametri2026 as unknown as ParametriAnno],
]);

export function anniDisponibili(): readonly number[] {
  return [...REGISTRO.keys()].sort((a, b) => a - b);
}

export function parametriPerAnno(anno: number = ANNO_PREDEFINITO): ParametriAnno {
  const p = REGISTRO.get(anno);
  if (!p) {
    throw new Error(
      `Nessun file di parametri per l'anno d'imposta ${anno}. Anni disponibili: ${anniDisponibili().join(", ")}.`,
    );
  }
  return p;
}
