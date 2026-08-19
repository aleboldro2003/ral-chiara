/**
 * Vista datore di lavoro: quanto costa davvero all'azienda un dipendente.
 *
 * E' la vista che rende il calcolatore rilevante per chi vende alle aziende e
 * non ai dipendenti: il netto in busta e' meta' della conversazione, l'altra
 * meta' e' il costo totale.
 *
 * Tutto qui dentro e' una STIMA, e viene esposta come tale: contributi datore in
 * un intervallo dichiarato invece che come numero secco, INAIL fuori dal
 * calcolo predefinito perche' e' la voce con la dispersione piu' alta. Dichiarare
 * una stima come stima e' piu' credibile che fingere precisione.
 */

import { nettoAnnuo } from "./calcola";
import { nonNegativo } from "./numerico";
import { parametriPerAnno } from "./parametri";
import type { CostoAzienda, DeltaMarginale, Euro, ParametriAnno } from "./tipi";

export interface OpzioniCostoAzienda {
  /** Sovrascrive l'aliquota contributiva a carico del datore. */
  readonly aliquotaContributiDatore?: number;
  /** Se includere l'INAIL nel costo totale. Escluso per impostazione predefinita. */
  readonly includiInail?: boolean;
  readonly aliquotaInail?: number;
}

/**
 * costo azienda = RAL + contributi datore + TFR (+ INAIL, se richiesto)
 *
 * Sul TFR c'e' una distinzione che vale la pena tenere esplicita. La quota annua
 * maturata e' `RAL / 13,5 = 7,4074%`. Da questa il datore trattiene lo 0,50%
 * della retribuzione come contributo al Fondo di Garanzia INPS, quindi
 * l'accantonamento netto che matura a favore del lavoratore e' circa il 6,91%.
 * Ai fini del COSTO AZIENDA vale comunque il 7,4074%: il datore sborsa l'intero
 * importo, cambia solo il destinatario.
 */
export function calcolaCostoAzienda(
  ral: Euro,
  opzioni: OpzioniCostoAzienda = {},
  parametri?: ParametriAnno,
): CostoAzienda {
  const p = parametri ?? parametriPerAnno();
  const par = p.costoDatore;
  const base = nonNegativo(ral);

  const aliquota = opzioni.aliquotaContributiDatore ?? par.contributiDatore.predefinito;
  const contributiDatore = base * aliquota;

  const tfrQuotaMaturata = base / par.tfr.divisore;
  const tfrFondoGaranzia = base * par.tfr.contributoFondoGaranzia;
  const tfrAccantonatoLavoratore = tfrQuotaMaturata - tfrFondoGaranzia;

  const includiInail = opzioni.includiInail ?? par.inail.inclusoNelPredefinito;
  const inail = includiInail ? base * (opzioni.aliquotaInail ?? par.inail.predefinito) : null;

  const costoTotale = base + contributiDatore + tfrQuotaMaturata + (inail ?? 0);

  const fisso = tfrQuotaMaturata + (inail ?? 0);
  const costoMinimo = base + base * par.contributiDatore.minimo + fisso;
  const costoMassimo = base + base * par.contributiDatore.massimo + fisso;

  return {
    ral: base,
    contributiDatore,
    tfrQuotaMaturata,
    tfrAccantonatoLavoratore,
    tfrFondoGaranzia,
    inail,
    costoTotale,
    costoMinimo,
    costoMassimo,
    moltiplicatore: base > 0 ? costoTotale / base : 0,
  };
}

/**
 * "1.000 € in più di RAL: il dipendente ne vede X, all'azienda ne costano Y."
 *
 * E' la domanda che un'azienda si pone davvero quando decide un aumento, ed e'
 * anche il modo piu' diretto di far vedere la gobba: nella fascia tra circa
 * 35.000 e 44.000 euro di RAL l'incremento netto per il dipendente e' inferiore
 * al 40% di quello che l'aumento costa all'azienda.
 */
export function calcolaDeltaMarginale(
  ral: Euro,
  incremento: Euro = 1000,
  opzioni: OpzioniCostoAzienda = {},
  parametri?: ParametriAnno,
): DeltaMarginale {
  const p = parametri ?? parametriPerAnno();
  const base = nonNegativo(ral);

  const incrementoNettoDipendente = nettoAnnuo(base + incremento, p) - nettoAnnuo(base, p);
  const incrementoCostoAzienda =
    calcolaCostoAzienda(base + incremento, opzioni, p).costoTotale -
    calcolaCostoAzienda(base, opzioni, p).costoTotale;

  return {
    incrementoRal: incremento,
    incrementoNettoDipendente,
    incrementoCostoAzienda,
    aliquotaMarginaleEffettiva: incremento > 0 ? 1 - incrementoNettoDipendente / incremento : 0,
  };
}
