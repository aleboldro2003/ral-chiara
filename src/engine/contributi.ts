/**
 * Step 1 della catena: dalla RAL ai contributi previdenziali a carico del
 * lavoratore.
 *
 * I contributi sono ONERI DEDUCIBILI: riducono la base su cui si calcola
 * l'imposta. Non vanno confusi con le detrazioni, che riducono l'imposta gia'
 * calcolata. A parita' di importo una detrazione vale molto piu' di una
 * deduzione.
 */

import { nonNegativo } from "./numerico";
import type { DettaglioContributi, Euro, ParametriContributiLavoratore } from "./tipi";

/**
 * contributi = aliquotaBase x min(RAL, massimale)
 *            + aliquotaAggiuntiva x max(0, min(RAL, massimale) - soglia)
 *
 * Sopra la soglia della prima fascia di retribuzione pensionabile l'aliquota
 * marginale sui contributi diventa quindi 10,19%, non piu' 9,19%.
 *
 * Due semplificazioni dichiarate valgono qui:
 *  - l'aliquota aggiuntiva e' applicata su base annua, mentre la norma prevede
 *    la mensilizzazione (soglia mensile). Con retribuzione costante il risultato
 *    coincide; con premi concentrati in un mese no.
 *  - il massimale opera solo per chi e' privo di anzianita' contributiva al
 *    31/12/1995. Per gli altri i contributi continuano a maturare oltre.
 */
export function calcolaContributi(
  ral: Euro,
  p: ParametriContributiLavoratore,
): DettaglioContributi {
  const imponibilePrevidenziale = Math.min(nonNegativo(ral), p.massimaleAnnuo);

  const quotaBase = imponibilePrevidenziale * p.aliquotaBase;
  const eccedenza = nonNegativo(imponibilePrevidenziale - p.sogliaAliquotaAggiuntiva);
  const quotaAggiuntiva = eccedenza * p.aliquotaAggiuntiva;

  return {
    imponibilePrevidenziale,
    quotaBase,
    quotaAggiuntiva,
    totale: quotaBase + quotaAggiuntiva,
    massimaleRaggiunto: nonNegativo(ral) > p.massimaleAnnuo,
    sogliaAggiuntivaSuperata: eccedenza > 0,
  };
}

/**
 * Inversione esatta: data una base imponibile fiscale, la RAL che la produce.
 *
 * Serve per posizionare le soglie normative — che la legge esprime in reddito
 * imponibile — sull'asse delle RAL, che e' l'unita' in cui l'utente ragiona e in
 * cui il grafico e' disegnato.
 *
 * L'inversione ha tre rami perche' la funzione diretta e' lineare a tratti:
 *   1. sotto la prima fascia pensionabile   imponibile = RAL x (1 - a)
 *   2. tra prima fascia e massimale         imponibile = RAL x (1 - a - b) + b x soglia
 *   3. oltre il massimale                   imponibile = RAL - contributi(massimale)
 *
 * Un'inversione a un solo ramo, `imponibile / (1 - 0,0919)`, e' esatta solo nel
 * primo tratto e sbaglia di decine di euro nel secondo: e' l'errore che ha fatto
 * fallire il test sul terzo scaglione IRPEF.
 */
export function ralPerImponibileFiscale(
  imponibile: Euro,
  p: ParametriContributiLavoratore,
): Euro {
  const base = nonNegativo(imponibile);
  const a = p.aliquotaBase;
  const b = p.aliquotaAggiuntiva;

  const imponibileAllaSoglia = p.sogliaAliquotaAggiuntiva * (1 - a);
  if (base <= imponibileAllaSoglia) return base / (1 - a);

  const contributiAlMassimale =
    p.massimaleAnnuo * a + (p.massimaleAnnuo - p.sogliaAliquotaAggiuntiva) * b;
  const imponibileAlMassimale = p.massimaleAnnuo - contributiAlMassimale;
  if (base <= imponibileAlMassimale) {
    // imponibile = RAL x (1 - a - b) + b x soglia  =>  RAL = (imponibile - b x soglia) / (1 - a - b)
    return (base - b * p.sogliaAliquotaAggiuntiva) / (1 - a - b);
  }

  return base + contributiAlMassimale;
}
