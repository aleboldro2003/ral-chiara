/**
 * Curva dell'aliquota marginale effettiva, calcolata NUMERICAMENTE dal motore
 * per differenze finite. Nessun valore precalcolato: la gobba e i gradini devono
 * emergere dai dati, non essere disegnati.
 *
 * L'aliquota marginale effettiva risponde alla domanda: di un euro in piu' di
 * RAL, quanto NON arriva al dipendente. Comprende quindi contributi, IRPEF,
 * phase-out delle detrazioni e addizionali, tutto insieme.
 *
 * La curva non e' monotona. Tra circa 35.240 e 44.050 euro di RAL sale a circa
 * il 61%, PIU' che nella fascia immediatamente superiore, perche' in quel tratto
 * escono di scena contemporaneamente due agevolazioni: la detrazione art. 13 e
 * l'ulteriore detrazione cuneo.
 */

import { nettoAnnuo } from "./calcola";
import { parametriPerAnno } from "./parametri";
import { ralSogliaDi } from "./soglie";
import type { Discontinuita, Euro, ParametriAnno, PuntoCurvaMarginale } from "./tipi";

export interface OpzioniCurva {
  readonly da?: Euro;
  readonly a?: Euro;
  /** Passo di campionamento e ampiezza della differenza finita. */
  readonly passo?: Euro;
}

/**
 * Aliquota marginale in un punto, per differenze finite centrate.
 *
 * La finestra e' centrata (`ral ± passo/2`) e non in avanti, perche' una
 * differenza in avanti attribuirebbe il gradino di una soglia al punto che la
 * precede, spostando visivamente la discontinuita' di mezzo passo.
 */
export function aliquotaMarginale(ral: Euro, passo: Euro, p: ParametriAnno): number {
  const meta = passo / 2;
  const inferiore = Math.max(0, ral - meta);
  const superiore = ral + meta;
  const ampiezza = superiore - inferiore;
  if (ampiezza <= 0) return 0;
  return 1 - (nettoAnnuo(superiore, p) - nettoAnnuo(inferiore, p)) / ampiezza;
}

/** Campiona la curva sull'intervallo richiesto. */
export function curvaMarginale(
  opzioni: OpzioniCurva = {},
  parametri?: ParametriAnno,
): PuntoCurvaMarginale[] {
  const p = parametri ?? parametriPerAnno();
  const da = opzioni.da ?? 20000;
  const a = opzioni.a ?? 80000;
  const passo = opzioni.passo ?? 100;

  const punti: PuntoCurvaMarginale[] = [];
  for (let ral = da; ral <= a + 1e-9; ral += passo) {
    const arrotondata = Math.round(ral * 100) / 100;
    const netto = nettoAnnuo(arrotondata, p);
    punti.push({
      ral: arrotondata,
      imponibile: arrotondata - arrotondata * p.contributiLavoratore.aliquotaBase,
      nettoAnnuo: netto,
      aliquotaMarginale: aliquotaMarginale(arrotondata, passo, p),
    });
  }
  return punti;
}

export interface SoglieAttraversate extends Discontinuita {
  /** Salto misurato dal motore attraversando la soglia, in piena precisione. */
  readonly saltoMisurato: Euro;
  /** RAL esatta a cui l'imponibile raggiunge la soglia, senza arrotondamenti. */
  readonly ralEsatta: Euro;
}

/**
 * Misura il salto del netto attraversando ciascuna soglia dichiarata. E' la
 * funzione che i test usano per verificare che il modello riproduca al centesimo
 * i gradini previsti dalla norma, ed e' la stessa che alimenta le marcature del
 * grafico.
 */
export function misuraDiscontinuita(
  parametri?: ParametriAnno,
  epsilon: Euro = 0.01,
): SoglieAttraversate[] {
  const p = parametri ?? parametriPerAnno();

  return p.discontinuita.soglie.map((d) => {
    const ralEsatta = ralSogliaDi(d, p);
    return {
      ...d,
      ralEsatta,
      saltoMisurato: nettoAnnuo(ralEsatta + epsilon, p) - nettoAnnuo(ralEsatta - epsilon, p),
    };
  });
}
