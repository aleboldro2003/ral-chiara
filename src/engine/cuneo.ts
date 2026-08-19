/**
 * Misure di riduzione del cuneo fiscale (L. 207/2024 art. 1 commi 4-9) e
 * trattamento integrativo (D.L. 3/2020 art. 1).
 *
 * Dal 2025 il cuneo NON è più un esonero contributivo: i contributi INPS si
 * versano per intero, la posizione previdenziale resta piena, e il beneficio
 * arriva per via fiscale. Sono due misure alternative:
 *
 *   comma 4  somma esente        reddito complessivo <= 20.000   si somma al netto
 *   comma 6  ulteriore detrazione 20.000 < reddito complessivo <= 40.000   riduce l'imposta
 *
 * Mai cumulabili tra loro. Il trattamento integrativo, che ha fonte diversa, è
 * invece cumulabile con la somma esente.
 */

import { nonNegativo, numeroLeggibile, trovaFascia, valutaFasciaDetrazione } from "./numerico";
import type {
  DettaglioAgevolazioni,
  DettaglioSommaEsente,
  Euro,
  ParametriAnno,
} from "./tipi";

export interface EsitoUlterioreDetrazione {
  readonly spettante: Euro;
  readonly coefficiente: number | null;
  readonly formula: string;
}

/**
 * Ulteriore detrazione, art. 1 comma 6.
 *
 * Usa la stessa forma algebrica e la stessa funzione di valutazione della
 * detrazione art. 13, ma con `tronca: false` sul coefficiente: la regola del
 * troncamento discende dalle note alle tabelle dei modelli dichiarativi, che
 * coprono l'art. 13 e non questa formula, che nelle istruzioni non compare
 * nemmeno. Estenderla per analogia sarebbe un'assunzione nostra travestita da
 * norma. È precisamente il motivo per cui il troncamento è un flag del
 * singolo coefficiente e non una regola globale del motore: due formule
 * strutturalmente identiche seguono regole di arrotondamento diverse, perché
 * hanno fonti diverse.
 */
export function calcolaUlterioreDetrazione(
  redditoComplessivo: Euro,
  p: ParametriAnno,
  opzioni: { giorniLavorati: number },
): EsitoUlterioreDetrazione {
  const par = p.cuneoFiscale.ulterioreDetrazione;
  const reddito = nonNegativo(redditoComplessivo);

  if (reddito <= par.spettanzaRedditoComplessivoMin) {
    return {
      spettante: 0,
      coefficiente: null,
      formula: `non spetta: reddito complessivo <= ${numeroLeggibile(par.spettanzaRedditoComplessivoMin)} (si applica invece la somma esente del comma 4)`,
    };
  }
  if (reddito > par.spettanzaRedditoComplessivoMax) {
    return {
      spettante: 0,
      coefficiente: null,
      formula: `non spetta: reddito complessivo > ${numeroLeggibile(par.spettanzaRedditoComplessivoMax)}`,
    };
  }

  const fascia = trovaFascia(reddito, par.fasce);
  const esito = valutaFasciaDetrazione(
    reddito,
    fascia,
    p.convenzioniNumeriche.cifreTroncamentoCoefficiente,
  );

  const ragguaglio = par.ragguagliabileAiGiorni
    ? opzioni.giorniLavorati / p.profiloStandard.giorniAnno
    : 1;

  return {
    spettante: esito.importo * ragguaglio,
    coefficiente: esito.coefficiente,
    formula:
      esito.formula +
      (ragguaglio !== 1 ? ` x ${opzioni.giorniLavorati}/${p.profiloStandard.giorniAnno}` : ""),
  };
}

/**
 * Somma esente, art. 1 comma 4, con l'annualizzazione del comma 5.
 *
 * Tre cose che quasi tutti sbagliano, e che qui sono tre righe distinte:
 *
 * 1. La percentuale è UNICA sulla fascia di appartenenza, applicata all'intero
 *    reddito. Non è progressiva per scaglioni come l'IRPEF. Per 18.000 euro la
 *    somma è 18.000 x 4,8% = 864 euro, non 8.500x7,1% + 6.500x5,3% + 3.000x4,8%
 *    = 1.092 euro.
 *
 * 2. La terza fascia non ha tetto: il limite di 20.000 euro è condizione di
 *    spettanza sul REDDITO COMPLESSIVO, posta nell'alinea del comma, non
 *    estremo della fascia percentuale sul REDDITO DI LAVORO DIPENDENTE. Nel
 *    caso standard le due grandezze coincidono, ma sono parametri distinti.
 *
 * 3. Il comma 5 impone un meccanismo a due tempi: si annualizza il reddito per
 *    stabilire QUALE percentuale si applica, e poi si applica quella percentuale
 *    al reddito EFFETTIVAMENTE percepito. Esempio della Circolare 4/E del 2025:
 *    3.000 euro percepiti in 92 giorni danno un reddito annuale teorico di
 *    11.902,17 euro, quindi fascia b) al 5,3%, ma la somma spettante è
 *    5,3% x 3.000 = 159 euro, non 5,3% x 11.902,17.
 */
export function calcolaSommaEsente(
  argomenti: {
    redditoLavoroDipendente: Euro;
    redditoComplessivo: Euro;
    giorniLavorati: number;
  },
  p: ParametriAnno,
): DettaglioSommaEsente {
  const par = p.cuneoFiscale.sommaEsente;
  const effettivo = nonNegativo(argomenti.redditoLavoroDipendente);
  const complessivo = nonNegativo(argomenti.redditoComplessivo);

  const annualizzato =
    par.annualizzazionePerFascia && argomenti.giorniLavorati > 0
      ? (effettivo / argomenti.giorniLavorati) * p.profiloStandard.giorniAnno
      : effettivo;

  const base: Omit<DettaglioSommaEsente, "importo" | "spettante" | "motivoNonSpettante" | "percentualeApplicata" | "formula"> = {
    redditoAnnualizzatoPerFascia: annualizzato,
    redditoEffettivo: effettivo,
  };

  if (complessivo > par.spettanzaRedditoComplessivoMax) {
    return {
      ...base,
      importo: 0,
      spettante: false,
      motivoNonSpettante: `reddito complessivo > ${par.spettanzaRedditoComplessivoMax} euro: si applica invece l'ulteriore detrazione del comma 6`,
      percentualeApplicata: null,
      formula: "non spetta",
    };
  }

  if (argomenti.giorniLavorati <= 0) {
    return {
      ...base,
      importo: 0,
      spettante: false,
      motivoNonSpettante:
        "nessun giorno di lavoro dipendente retribuito nell'anno (Risposta AdE n. 7/2026)",
      percentualeApplicata: null,
      formula: "non spetta",
    };
  }

  const fascia = trovaFascia(annualizzato, par.fasce);

  return {
    ...base,
    importo: effettivo * fascia.percentuale,
    spettante: true,
    motivoNonSpettante: null,
    percentualeApplicata: fascia.percentuale,
    formula: `${(fascia.percentuale * 100).toString().replace(".", ",")}% x ${numeroLeggibile(effettivo)} (percentuale scelta sul reddito annualizzato di ${numeroLeggibile(annualizzato)})`,
  };
}

/**
 * Trattamento integrativo, D.L. 3/2020 art. 1 co. 1.
 *
 * La condizione di capienza NON è `imposta lorda > detrazione art. 13`, ma
 * `imposta lorda > (detrazione art. 13 co. 1 - 75 euro)`. La franchigia è stata
 * inserita dall'art. 1 co. 3 della L. 207/2024 e non è un numero arbitrario:
 * neutralizza l'incremento della detrazione da 1.880 a 1.955 euro, che
 * altrimenti avrebbe fatto perdere il beneficio a lavoratori che prima ne erano
 * destinatari. 1.955 - 75 = 1.880, cioè la soglia di capienza resta quella
 * storica.
 *
 * Due distinzioni che nel caso standard non si vedono ma esistono:
 *  - l'imposta lorda della condizione è quella sui SOLI redditi di lavoro
 *    dipendente e assimilati, non l'imposta lorda complessiva;
 *  - la detrazione di confronto è quella del comma 1, senza la maggiorazione
 *    di 65 euro che sta al comma 1.1 (e che sotto i 15.000 euro non spetta
 *    comunque).
 */
export function calcolaTrattamentoIntegrativo(
  argomenti: {
    redditoComplessivo: Euro;
    impostaLordaLavoroDipendente: Euro;
    detrazioneArt13Comma1: Euro;
    giorniLavorati: number;
  },
  p: ParametriAnno,
): DettaglioAgevolazioni["trattamentoIntegrativo"] {
  const par = p.trattamentoIntegrativo;
  const complessivo = nonNegativo(argomenti.redditoComplessivo);

  const franchigia = par.franchigiaRagguagliabileAiGiorni
    ? par.franchigiaCapienza * (argomenti.giorniLavorati / p.profiloStandard.giorniAnno)
    : par.franchigiaCapienza;

  const sogliaCapienza = argomenti.detrazioneArt13Comma1 - franchigia;
  const formula = `imposta lorda ${argomenti.impostaLordaLavoroDipendente.toFixed(2)} > detrazione art. 13 ${argomenti.detrazioneArt13Comma1.toFixed(2)} - franchigia ${franchigia.toFixed(2)} = ${sogliaCapienza.toFixed(2)}`;

  if (complessivo > par.redditoComplessivoMax) {
    return {
      importo: 0,
      spettante: false,
      motivoNonSpettante: `reddito complessivo > ${par.redditoComplessivoMax} euro`,
      impostaLordaLavoroDipendente: argomenti.impostaLordaLavoroDipendente,
      sogliaCapienza,
      formula: "non spetta",
    };
  }

  if (argomenti.impostaLordaLavoroDipendente <= sogliaCapienza) {
    return {
      importo: 0,
      spettante: false,
      motivoNonSpettante: "incapienza: l'imposta lorda non supera la detrazione al netto della franchigia di 75 euro",
      impostaLordaLavoroDipendente: argomenti.impostaLordaLavoroDipendente,
      sogliaCapienza,
      formula,
    };
  }

  return {
    importo: par.importo,
    spettante: true,
    motivoNonSpettante: null,
    impostaLordaLavoroDipendente: argomenti.impostaLordaLavoroDipendente,
    sogliaCapienza,
    formula,
  };
}
