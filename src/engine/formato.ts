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

/** 0.0919 -> "9,19%" — `decimali` controlla la precisione mostrata. */
export function percentuale(valore: Aliquota, decimali = 2): string {
  return `${new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimali,
  }).format(arrotonda(valore * 100, decimali + 2))}%`;
}
