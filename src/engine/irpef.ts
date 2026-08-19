/**
 * Step 2-4 della catena: IRPEF lorda, detrazione per lavoro dipendente,
 * imputazione delle detrazioni e IRPEF netta.
 *
 * L'ulteriore detrazione del cuneo vive in `cuneo.ts` perche' ha una fonte
 * diversa, ma viene imputata qui: e' l'unico punto in cui l'ordine di
 * imputazione ha effetto sulla scomposizione mostrata in interfaccia.
 */

import {
  applicaScalaProgressiva,
  arrotonda,
  nonNegativo,
  sommaScaglioni,
  trovaFascia,
  valutaFasciaDetrazione,
} from "./numerico";
import type {
  DettaglioDetrazione,
  DettaglioIrpef,
  DettaglioScaglione,
  Euro,
  ParametriAnno,
  TipoContratto,
} from "./tipi";

export interface EsitoIrpefLorda {
  readonly lorda: Euro;
  readonly scaglioni: readonly DettaglioScaglione[];
}

/** IRPEF lorda per scaglioni progressivi sull'imponibile fiscale. */
export function calcolaIrpefLorda(imponibile: Euro, p: ParametriAnno): EsitoIrpefLorda {
  const scaglioni = applicaScalaProgressiva(nonNegativo(imponibile), p.irpef.scaglioni);
  return { lorda: sommaScaglioni(scaglioni), scaglioni };
}

export interface EsitoDetrazioneArt13 {
  /** Detrazione dell'art. 13 co. 1, senza la maggiorazione del co. 1.1. */
  readonly comma1: Euro;
  readonly maggiorazione: Euro;
  readonly spettante: Euro;
  readonly coefficiente: number | null;
  readonly formula: string;
  readonly minimoApplicato: boolean;
}

/**
 * Detrazione per redditi di lavoro dipendente, art. 13 co. 1 e 1.1 TUIR.
 *
 * Ordine delle operazioni, che non e' indifferente:
 *   1. si valuta la fascia nella forma `base + fattore x coefficiente`
 *   2. si ragguaglia al periodo di lavoro nell'anno
 *   3. si applica il minimo, se la fascia ne dichiara uno
 *   4. si somma la maggiorazione del comma 1.1
 *
 * Il minimo (690 euro a tempo indeterminato, 1.380 a tempo determinato) e'
 * agganciato alla SOLA fascia dei redditi fino a 15.000 euro e opera DOPO il
 * ragguaglio: non e' un pavimento globale della detrazione. Applicarlo ovunque
 * porterebbe la detrazione a 690 euro anche sopra i 50.000 euro di reddito
 * complessivo, dove invece e' zero.
 *
 * La maggiorazione del comma 1.1 resta fuori dal minimo e dal ragguaglio: e' un
 * importo fisso, e non a caso e' il comma successivo.
 */
export function calcolaDetrazioneArt13(
  redditoComplessivo: Euro,
  p: ParametriAnno,
  opzioni: { tipoContratto: TipoContratto; giorniLavorati: number },
): EsitoDetrazioneArt13 {
  const par = p.detrazioneLavoroDipendente;
  const reddito = nonNegativo(redditoComplessivo);
  const fascia = trovaFascia(reddito, par.fasce);

  const esito = valutaFasciaDetrazione(
    reddito,
    fascia,
    p.convenzioniNumeriche.cifreTroncamentoCoefficiente,
  );

  const ragguaglio = par.ragguagliabileAiGiorni
    ? opzioni.giorniLavorati / p.profiloStandard.giorniAnno
    : 1;
  const ragguagliata = esito.importo * ragguaglio;

  let comma1 = ragguagliata;
  let minimoApplicato = false;
  const minimo = fascia.minimo;
  if (minimo) {
    const pavimento =
      opzioni.tipoContratto === "tempoDeterminato"
        ? minimo.tempoDeterminato
        : minimo.tempoIndeterminato;
    if (comma1 < pavimento) {
      comma1 = pavimento;
      minimoApplicato = true;
    }
  }

  const m = par.maggiorazione;
  const maggiorazione = reddito > m.oltre && reddito <= m.fino ? m.importo : 0;

  const formula =
    esito.formula +
    (ragguaglio !== 1 ? ` x ${opzioni.giorniLavorati}/${p.profiloStandard.giorniAnno}` : "") +
    (minimoApplicato ? ` [minimo di ${comma1} applicato]` : "") +
    (maggiorazione > 0 ? ` + ${maggiorazione} (art. 13 co. 1.1)` : "");

  return {
    comma1,
    maggiorazione,
    spettante: comma1 + maggiorazione,
    coefficiente: esito.coefficiente,
    formula,
    minimoApplicato,
  };
}

/**
 * Imputa le detrazioni sull'imposta lorda e determina l'IRPEF netta.
 *
 * L'ordine e' art. 13 prima, ulteriore detrazione cuneo sul residuo. Il totale
 * non cambia con l'ordine, ma la scomposizione mostrata all'utente si': quando
 * l'imposta si azzera, dire QUALE detrazione e' rimasta inutilizzata e' una
 * informazione, e la maggior parte dei calcolatori la nasconde.
 *
 * Le detrazioni non generano credito rimborsabile: l'imposta si azzera e basta.
 * Cio' che avanza e' perso, ed e' esposto in `detrazioniNonGodute`.
 */
export function componiIrpef(
  lorda: EsitoIrpefLorda,
  art13: EsitoDetrazioneArt13,
  cuneoSpettante: Euro,
  cuneoFormula: string,
  cuneoCoefficiente: number | null,
): DettaglioIrpef {
  const godutaArt13 = Math.min(art13.spettante, lorda.lorda);
  const residuo = lorda.lorda - godutaArt13;

  const godutaCuneo = Math.min(cuneoSpettante, residuo);
  const netta = residuo - godutaCuneo;

  const detrazioneLavoroDipendente: DettaglioDetrazione = {
    spettante: art13.spettante,
    goduta: godutaArt13,
    nonGoduta: art13.spettante - godutaArt13,
    coefficienteApplicato: art13.coefficiente,
    formula: art13.formula,
  };

  const ulterioreDetrazioneCuneo: DettaglioDetrazione = {
    spettante: cuneoSpettante,
    goduta: godutaCuneo,
    nonGoduta: cuneoSpettante - godutaCuneo,
    coefficienteApplicato: cuneoCoefficiente,
    formula: cuneoFormula,
  };

  return {
    lorda: lorda.lorda,
    scaglioni: lorda.scaglioni,
    detrazioneLavoroDipendente,
    maggiorazioneApplicata: art13.maggiorazione,
    ulterioreDetrazioneCuneo,
    netta,
    detrazioniNonGodute:
      detrazioneLavoroDipendente.nonGoduta + ulterioreDetrazioneCuneo.nonGoduta,
    azzerataPerIncapienza: arrotonda(netta) === 0 && lorda.lorda > 0,
  };
}
