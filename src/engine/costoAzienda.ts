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
import { quadraturaCentesimi } from "./formato";
import { arrotonda, nonNegativo } from "./numerico";
import { parametriPerAnno } from "./parametri";
import type {
  CostoAzienda,
  DeltaMarginale,
  Euro,
  ParametriAnno,
  VoceComposizioneCosto,
} from "./tipi";

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
    mostrati: (() => {
      /*
       * Stessa ragione della ripartizione del netto: le celle arrotondate una
       * per una non sommano al totale arrotondato su tutte le RAL.
       *
       * L'INAIL entra fra gli addendi SOLO quando è incluso. Passarlo come zero
       * quando è escluso lo renderebbe idoneo a ricevere un centesimo dalla
       * quadratura, centesimo che poi sparirebbe insieme alla cella: le altre
       * tre voci non sommerebbero più al totale.
       */
      const addendi = [base, contributiDatore, tfrQuotaNetta];
      if (inail !== null) addendi.push(inail);

      const q = quadraturaCentesimi(addendi, costoTotale);
      return {
        ral: q[0] ?? 0,
        contributiDatore: q[1] ?? 0,
        tfrQuotaNetta: q[2] ?? 0,
        inail: inail === null ? null : (q[3] ?? 0),
        costoTotale: arrotonda(costoTotale),
      };
    })(),
  };
}

/**
 * La composizione del costo aziendale, pronta per il grafico.
 *
 * Sta nel motore e non nel componente per due ragioni. La prima è che così
 * nessuna quota si ricalcola in interfaccia: il grafico riceve numeri già
 * fatti e si limita a disegnarli, senza duplicare una sola regola contributiva.
 * La seconda è che diventa verificabile in Node, senza montare React.
 *
 * Gli importi sono quelli **mostrati**, cioè già quadrati sul totale. Le quote
 * sono quadrate a loro volta al decimo di punto: arrotondate una per una
 * darebbero 73% + 21,9% + 5% = 99,9%, e una legenda che non fa 100 è lo stesso
 * difetto che la sezione ha già corretto sugli euro.
 *
 * L'INAIL compare solo quando è incluso. A costo totale nullo — RAL zero —
 * restituisce un elenco vuoto invece di dividere per zero.
 */
export function composizioneCosto(costo: CostoAzienda): VoceComposizioneCosto[] {
  const m = costo.mostrati;

  const voci = [
    {
      id: "ral" as const,
      etichetta: "RAL",
      descrizione: "Retribuzione annua lorda, la base su cui si calcola tutto il resto.",
      importo: m.ral,
    },
    {
      id: "contributiDatore" as const,
      etichetta: "Contributi datore INPS",
      descrizione:
        "Contributi previdenziali e assistenziali a carico del datore di lavoro: IVS più NASpI, CIG, ANF, maternità e malattia.",
      importo: m.contributiDatore,
    },
    {
      id: "tfr" as const,
      etichetta: "TFR — quota azienda",
      descrizione:
        "Quota TFR maturata al netto dello 0,50% già incluso nei contributi del datore di lavoro.",
      importo: m.tfrQuotaNetta,
    },
    {
      id: "inail" as const,
      etichetta: "Assicurazione INAIL",
      descrizione:
        "Premio assicurativo contro gli infortuni, variabile secondo la classe di rischio.",
      importo: m.inail ?? 0,
    },
  ].filter((v) => v.importo > 0.5);

  if (voci.length === 0 || m.costoTotale <= 0) return [];

  const quote = quadraturaCentesimi(
    voci.map((v) => (v.importo / m.costoTotale) * 10),
    10,
  ).map((q) => q / 10);

  return voci.map((v, i) => ({ ...v, quota: quote[i] ?? 0 }));
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
