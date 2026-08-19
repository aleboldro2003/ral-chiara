/**
 * Utilità numeriche condivise dal motore. Funzioni pure, nessuna dipendenza.
 *
 * Vive in un modulo a sé perché il troncamento a quattro cifre decimali è la
 * riga di codice più insidiosa del progetto e merita un solo posto in cui
 * essere scritta, letta e testata.
 */

import type {
  Aliquota,
  DettaglioScaglione,
  Euro,
  FasciaDetrazione,
  Scaglione,
} from "./tipi";

/**
 * Tronca alle prime `cifreDecimali` cifre, scartando il resto.
 *
 * ATTENZIONE, qui c'è una trappola di floating point che costa 12 centesimi
 * sul caso di riferimento RAL 25.000.
 *
 * `(28000 - 22702.5) / 13000` vale matematicamente 0,4075, ma in doppia
 * precisione vale 0.40749999999999997. Un `Math.trunc(x * 10000) / 10000`
 * scritto in modo diretto restituisce 0,4074 invece di 0,4075.
 *
 * Non basta normalizzare `x` prima di troncarlo: anche partendo da un valore
 * già ripulito, la moltiplicazione per 10.000 reintroduce l'errore. La
 * normalizzazione va fatta DOPO lo scaling, ed è quello che fa la riga qui
 * sotto. Il margine di sei decimali sul valore scalato è ampiamente sopra
 * l'errore di rappresentazione (dell'ordine di 1e-12 su grandezze come 1e4) e
 * ampiamente sotto qualunque differenza significativa.
 *
 * Vedi il test dedicato in `__tests__/numerico.test.ts`.
 */
export function troncaA(valore: number, cifreDecimali: number): number {
  if (!Number.isFinite(valore)) return valore;
  const scala = 10 ** cifreDecimali;
  const scalato = Number((valore * scala).toFixed(6));
  return Math.trunc(scalato) / scala;
}

/**
 * Arrotonda half-up, cioè allontanandosi dallo zero sui mezzi.
 *
 * Non è il banker's rounding di molte librerie: chi legge una busta paga si
 * aspetta che 0,005 diventi 0,01. La stessa normalizzazione post-scaling di
 * `troncaA` serve anche qui, perché 1,005 * 100 vale 100.49999999999999 e un
 * `Math.round` diretto restituirebbe 1,00 invece di 1,01.
 */
export function arrotonda(valore: number, decimali = 2): number {
  if (!Number.isFinite(valore)) return valore;
  const scala = 10 ** decimali;
  const scalato = Number((valore * scala).toFixed(6));
  const arrotondato = scalato < 0 ? -Math.round(-scalato) : Math.round(scalato);
  return arrotondato / scala;
}

/** Vincola un valore a non scendere sotto zero. */
export function nonNegativo(valore: number): number {
  return valore > 0 ? valore : 0;
}

/**
 * Applica una scala progressiva per scaglioni e restituisce il dettaglio di
 * ciascuno, non solo il totale: l'interfaccia deve poter mostrare la
 * scomposizione senza rifare il calcolo.
 *
 * Usata sia per l'IRPEF sia per l'addizionale regionale, che hanno la stessa
 * struttura ma scaglioni diversi.
 */
export function applicaScalaProgressiva(
  base: Euro,
  scaglioni: readonly Scaglione[],
): DettaglioScaglione[] {
  const dettagli: DettaglioScaglione[] = [];
  let inferiore = 0;

  for (const scaglione of scaglioni) {
    const superiore = scaglione.fino;
    const tetto = superiore === null ? base : Math.min(base, superiore);
    const imponibile = nonNegativo(tetto - inferiore);

    dettagli.push({
      da: inferiore,
      a: superiore,
      aliquota: scaglione.aliquota,
      imponibileNelloScaglione: imponibile,
      imposta: imponibile * scaglione.aliquota,
    });

    if (superiore === null) break;
    inferiore = superiore;
  }

  return dettagli;
}

export function sommaScaglioni(dettagli: readonly DettaglioScaglione[]): Euro {
  return dettagli.reduce((totale, d) => totale + d.imposta, 0);
}

/**
 * Trova la prima fascia il cui limite superiore non è ancora stato superato.
 * `fino: null` chiude sempre la scala.
 *
 * Il confronto è `valore <= fascia.fino`, quindi il limite appartiene alla
 * fascia che lo nomina: a reddito 28.000 si applica la fascia "fino a 28.000",
 * a 28.000,01 quella successiva. È la convenzione della norma, ed è anche
 * ciò che produce le soglie a gradino.
 */
export function trovaFascia<T extends { readonly fino: Euro | null }>(
  valore: Euro,
  fasce: readonly T[],
): T {
  const fascia = fasce.find((f) => f.fino === null || valore <= f.fino);
  if (!fascia) {
    throw new Error(
      "Scala di fasce malformata: manca la fascia di chiusura con 'fino: null'.",
    );
  }
  return fascia;
}

export interface EsitoFascia {
  readonly importo: Euro;
  /** Coefficiente applicato, `null` quando la fascia non ne prevede uno. */
  readonly coefficiente: number | null;
  readonly formula: string;
}

/**
 * Valuta una fascia di detrazione nella forma `base + fattore x coefficiente`,
 * dove il coefficiente vale 1 quando la fascia non lo prevede.
 *
 * Una sola funzione serve sia le quattro fasce dell'art. 13 TUIR sia le quattro
 * dell'ulteriore detrazione cuneo. Il troncamento è deciso dal singolo
 * coefficiente e non da una regola globale: le fonti lo prescrivono per i
 * rapporti dell'art. 13 (istruzioni 730, Tabella 6 nota 2) ma non per il
 * phase-out del comma 6 della L. 207/2024, che nelle istruzioni non compare
 * nemmeno come formula.
 */
export function valutaFasciaDetrazione(
  reddito: Euro,
  fascia: FasciaDetrazione,
  cifreTroncamento: number,
): EsitoFascia {
  if (fascia.coefficiente === null) {
    return {
      importo: fascia.base,
      coefficiente: null,
      formula: numeroLeggibile(fascia.base),
    };
  }

  const { riferimento, denominatore, tronca } = fascia.coefficiente;
  const grezzo = nonNegativo((riferimento - reddito) / denominatore);
  const coefficiente = tronca ? troncaA(grezzo, cifreTroncamento) : grezzo;

  // Quando la base è zero, scriverla come "0 + ..." è rumore: la formula
  // dell'art. 13 in seconda fascia comincia direttamente dal prodotto.
  const testaBase = fascia.base === 0 ? "" : `${numeroLeggibile(fascia.base)} + `;

  return {
    importo: fascia.base + fascia.fattore * coefficiente,
    coefficiente,
    formula:
      `${testaBase}${numeroLeggibile(fascia.fattore)} x ` +
      `(${numeroLeggibile(riferimento)} - ${numeroLeggibile(arrotonda(reddito))}) / ` +
      `${numeroLeggibile(denominatore)}` +
      (tronca ? ` [coefficiente troncato a ${cifreTroncamento} decimali]` : ""),
  };
}

/**
 * Numero in convenzione italiana per le formule esposte in interfaccia.
 *
 * Duplica volutamente la configurazione di `formato.ts` invece di importarla:
 * `formato.ts` dipende già da questo modulo per `arrotonda`, e l'import inverso
 * chiuderebbe un ciclo. Sono due righe di Intl, e il ciclo costerebbe di più.
 *
 * I decimali si mostrano solo se ci sono: 1.910 resta "1.910", 22.000 resta
 * "22.000", e 31783.5 diventa "31.783,50".
 */
const NUMERO_INTERO = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

const NUMERO_DECIMALE = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

export function numeroLeggibile(valore: number): string {
  const v = arrotonda(valore);
  return Number.isInteger(v) ? NUMERO_INTERO.format(v) : NUMERO_DECIMALE.format(v);
}

/** Percentuale come frazione -> stringa leggibile, per le formule esposte in UI. */
export function percentualeLeggibile(aliquota: Aliquota): string {
  return `${arrotonda(aliquota * 100, 4).toString().replace(".", ",")}%`;
}
