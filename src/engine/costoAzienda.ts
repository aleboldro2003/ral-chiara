/**
 * Vista datore di lavoro: quanto costa davvero all'azienda un dipendente.
 *
 * È la vista che rende il calcolatore rilevante per chi vende alle aziende e
 * non ai dipendenti: il netto in busta è metà della conversazione, l'altra
 * metà è il costo totale.
 *
 * Tutto qui dentro è una STIMA, e viene esposta come tale: contributi datore in
 * un intervallo dichiarato invece che come numero secco, INAIL fuori dal
 * calcolo predefinito perché è la voce con la dispersione più alta. Dichiarare
 * una stima come stima è più credibile che fingere precisione.
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
 * costo azienda = RAL + contributi datore + quota TFR NETTA (+ INAIL, se richiesto)
 *
 * Sul TFR ci sono due contributi distinti che è facilissimo confondere, e
 * confonderli produce un doppio conteggio nel costo aziendale.
 *
 *  - **0,50%** — art. 3 ultimo comma L. 297/1982 (0,30% dal 1° luglio 1982 più
 *    0,20% dal 1° gennaio 1983). È una **maggiorazione dell'aliquota IVS a
 *    carico del datore**, che il datore detrae dalla quota TFR. Essendo IVS, è
 *    già dentro il 30% dei contributi datore.
 *  - **0,20%** — art. 2 c. 8 L. 297/1982, contributo al **Fondo di Garanzia
 *    TFR**, versato alla Gestione Prestazioni Temporanee (0,40% per i dirigenti
 *    industriali). Voce autonoma, anch'essa compresa nei contributi datore.
 *
 * La quota lorda ex art. 2120 c.c. è `RAL / 13,5 = 7,4074%`. Sommare quella
 * lorda al costo totale conterebbe lo 0,50% due volte, una dentro l'IVS e una
 * dentro il TFR. Il costo totale usa quindi la quota **netta**:
 *
 *     1/13,5 − 0,50% = 6,9074%
 *
 * e il moltiplicatore predefinito scende da 1,3741 a **1,3691**.
 *
 * Resta una stima: contributi datore, INAIL e trattamento TFR dipendono da
 * CCNL, settore e dimensione aziendale.
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

  const tfrQuotaLorda = base / par.tfr.divisore;
  const tfrContributoAggiuntivoIvs = base * par.tfr.contributoAggiuntivoIvs;
  const tfrQuotaNetta = tfrQuotaLorda - tfrContributoAggiuntivoIvs;
  const tfrFondoGaranzia = base * par.tfr.contributoFondoGaranzia;

  const includiInail = opzioni.includiInail ?? par.inail.inclusoNelPredefinito;
  const inail = includiInail ? base * (opzioni.aliquotaInail ?? par.inail.predefinito) : null;

  const costoTotale = base + contributiDatore + tfrQuotaNetta + (inail ?? 0);

  const fisso = tfrQuotaNetta + (inail ?? 0);
  const costoMinimo = base + base * par.contributiDatore.minimo + fisso;
  const costoMassimo = base + base * par.contributiDatore.massimo + fisso;

  return {
    ral: base,
    contributiDatore,
    tfrQuotaLorda,
    tfrQuotaNetta,
    tfrContributoAggiuntivoIvs,
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
 * È la domanda che un'azienda si pone davvero quando decide un aumento, ed è
 * anche il modo più diretto di far vedere la gobba: nella fascia tra circa
 * 35.000 e 44.000 euro di RAL l'incremento netto per il dipendente è inferiore
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
