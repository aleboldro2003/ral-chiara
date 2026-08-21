/**
 * Formattazione in convenzione italiana. È l'unico modulo del motore che sa
 * qualcosa di locale e di presentazione, ed è comunque puro: nessun DOM,
 * nessun React.
 *
 * Sta nel motore e non nella UI perché le formule esposte nei pannelli di
 * dettaglio ("1.910 x (50.000 - 31.783,50) / 22.000") vengono costruite qui,
 * insieme ai numeri che descrivono.
 */

import { arrotonda } from "./numerico";
import type { Aliquota, Euro } from "./tipi";

/**
 * `useGrouping: true` non è pleonastico. L'impostazione predefinita di ICU per
 * la locale italiana è "min2", che sopprime il separatore sui numeri a quattro
 * cifre: senza, 3.216,50 verrebbe stampato "3216,50" mentre 26.032,18 mantiene
 * il punto, e in una colonna di importi incolonnati la differenza salta subito
 * all'occhio. Il valore booleano `true` equivale ad "always" per specifica, ed
 * è quello tipizzato in tutte le versioni della libreria standard.
 */
const EURO = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const INTERO = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

/** 26032.18 -> "26.032,18" */
export function euro(valore: Euro): string {
  return EURO.format(arrotonda(valore));
}

/** 26032.18 -> "26.032,18 €" */
export function euroConSimbolo(valore: Euro): string {
  return `${euro(valore)} €`;
}

/** 35000 -> "35.000" */
export function intero(valore: number): string {
  return INTERO.format(valore);
}

/**
 * Arrotonda al centesimo un gruppo di addendi facendo in modo che la somma dei
 * valori mostrati sia ESATTAMENTE il totale mostrato.
 *
 * Serve perché la piena precisione, da sola, non basta. Il motore calcola in
 * precisione piena e `netto + imposte + contributi` fa la RAL al centesimo di
 * milionesimo; ma arrotondando i tre separatamente la somma cade fuori di un
 * centesimo su circa il 22% delle RAL del dominio, ed è un difetto visibile:
 * chi controlla i conti a mano trova 35.000,01.
 *
 * Metodo del resto maggiore: si arrotondano tutti per difetto, si contano i
 * centesimi mancanti al totale e si distribuiscono agli addendi con la parte
 * frazionaria più grande. Ogni valore si scosta al massimo di un centesimo dal
 * proprio arrotondamento naturale, la somma chiude esatta, e la correzione
 * finisce dove l'arrotondamento era già più vicino a scattare — non su una voce
 * scelta a caso.
 *
 * È la stessa tecnica con cui si ripartiscono i seggi e si quadrano i
 * cedolini: preferibile a far assorbire il residuo sempre alla stessa voce,
 * che introdurrebbe un errore sistematico su quella.
 */
export function quadraturaCentesimi(addendi: readonly number[], totale: Euro): number[] {
  const CENT = 100;
  /*
   * Il bersaglio passa da `arrotonda`, non da `Math.round` diretto: sono la
   * stessa cosa quasi sempre, ma non sui mezzi centesimi esatti. Con un totale
   * di 25.173,165 il doppio in binario vale 25.173,164999999997, che
   * `Math.round` manda a 25.173,16 mentre `arrotonda` — che compensa la trappola
   * di floating point e arrotonda per eccesso sul mezzo — dà 25.173,17. Se la
   * quadratura punta a un bersaglio diverso da quello che la pagina stampa, le
   * celle non sommano al totale proprio nei casi limite.
   */
  const bersaglio = Math.round(arrotonda(totale) * CENT);

  const perDifetto = addendi.map((v) => Math.floor(v * CENT));
  const resti = addendi.map((v, i) => v * CENT - perDifetto[i]!);
  const assegnati = perDifetto.reduce((a, b) => a + b, 0);

  let mancanti = bersaglio - assegnati;
  const esito = [...perDifetto];

  // indici ordinati per resto decrescente: prendono per primi i centesimi
  const ordine = addendi.map((_, i) => i).sort((a, b) => resti[b]! - resti[a]!);

  let k = 0;
  while (mancanti > 0 && ordine.length > 0) {
    const i = ordine[k % ordine.length] ?? 0;
    esito[i] = (esito[i] ?? 0) + 1;
    mancanti -= 1;
    k += 1;
  }
  // totale minore della somma dei troncamenti: toglie dai resti più piccoli
  while (mancanti < 0 && ordine.length > 0) {
    const i = ordine[ordine.length - 1 - (k % ordine.length)] ?? 0;
    esito[i] = (esito[i] ?? 0) - 1;
    mancanti += 1;
    k += 1;
  }

  return esito.map((c) => c / CENT);
}

/** 0.0919 -> "9,19%" — `decimali` controlla la precisione mostrata. */
export function percentuale(valore: Aliquota, decimali = 2): string {
  return `${new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimali,
  }).format(arrotonda(valore * 100, decimali + 2))}%`;
}
