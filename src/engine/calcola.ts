/**
 * Orchestratore: da RAL a risultato completo.
 *
 * Restituisce ogni step intermedio, non solo il netto finale, cosi' che
 * l'interfaccia possa mostrare la scomposizione completa senza rifare calcoli.
 *
 * LA CATENA
 *
 *   RAL
 *    |- (1) - contributi previdenziali a carico lavoratore (oneri DEDUCIBILI)
 *    v
 *   IMPONIBILE FISCALE = reddito complessivo = reddito di lavoro dipendente
 *    |- (2) - x aliquote IRPEF per scaglioni -----------------> IRPEF LORDA
 *    |        (3) - detrazione lavoro dipendente (art. 13)         |
 *    |        (4) - ulteriore detrazione cuneo (c. 6)              v
 *    |                                                        IRPEF NETTA (min. 0)
 *    |- (5) - x addizionale regionale + comunale
 *    |- (6) + somma esente cuneo (c. 4) e trattamento integrativo
 *    v
 *   NETTO ANNUO = RAL - contributi - IRPEF netta - addizionali + somme esenti
 *
 * I contributi sono oneri deducibili, riducono la base imponibile. Le detrazioni
 * sono sconti d'imposta, riducono l'imposta gia' calcolata. A parita' di importo
 * una detrazione vale molto di piu'. Le addizionali si calcolano sull'imponibile
 * fiscale e non hanno detrazioni proprie.
 */

import { calcolaAddizionaleComunale, calcolaAddizionaleRegionale } from "./addizionali";
import { calcolaContributi } from "./contributi";
import {
  calcolaSommaEsente,
  calcolaTrattamentoIntegrativo,
  calcolaUlterioreDetrazione,
} from "./cuneo";
import { euro, percentuale } from "./formato";
import { calcolaDetrazioneArt13, calcolaIrpefLorda, componiIrpef } from "./irpef";
import { arrotonda, nonNegativo } from "./numerico";
import { parametriPerAnno } from "./parametri";
import { discontinuitaVicine } from "./soglie";
import type {
  ErroreInput,
  Esito,
  Euro,
  InputCalcolo,
  ParametriAnno,
  RisultatoCalcolo,
  VoceCascata,
} from "./tipi";

/** Limite di sanita' sull'input: oltre, quasi certamente un errore di battitura. */
const RAL_MASSIMA_AMMESSA = 100_000_000;

/**
 * Valida l'input senza lanciare eccezioni: gli errori sono un valore di ritorno.
 * Accetta `unknown` perche' il confine con l'interfaccia e' l'unico punto in cui
 * possono arrivare stringhe vuote, NaN o valori assurdi.
 */
export function validaInput(grezzo: unknown, p: ParametriAnno): Esito<InputCalcolo> {
  const errori: ErroreInput[] = [];
  const input = (grezzo ?? {}) as Partial<Record<keyof InputCalcolo, unknown>>;

  const ral = input.ral;
  if (typeof ral !== "number") {
    errori.push({
      codice: "RAL_NON_NUMERICA",
      campo: "ral",
      messaggio: "Inserisci una RAL come numero.",
    });
  } else if (!Number.isFinite(ral)) {
    errori.push({
      codice: "RAL_NON_FINITA",
      campo: "ral",
      messaggio: "La RAL inserita non e' un numero valido.",
    });
  } else if (ral < 0) {
    errori.push({
      codice: "RAL_NEGATIVA",
      campo: "ral",
      messaggio: "La RAL non puo' essere negativa.",
    });
  } else if (ral > RAL_MASSIMA_AMMESSA) {
    errori.push({
      codice: "RAL_FUORI_SCALA",
      campo: "ral",
      messaggio: `La RAL non puo' superare ${euro(RAL_MASSIMA_AMMESSA)} €.`,
    });
  }

  const mensilita = input.mensilita ?? p.mensilita.predefinita;
  if (typeof mensilita !== "number" || !p.mensilita.opzioni.includes(mensilita)) {
    errori.push({
      codice: "MENSILITA_NON_AMMESSA",
      campo: "mensilita",
      messaggio: `Le mensilita' ammesse sono ${p.mensilita.opzioni.join(", ")}.`,
    });
  }

  const giorni = input.giorniLavorati ?? p.profiloStandard.giorniLavorati;
  if (typeof giorni !== "number" || !Number.isFinite(giorni) || giorni < 0 || giorni > p.profiloStandard.giorniAnno) {
    errori.push({
      codice: "GIORNI_NON_VALIDI",
      campo: "giorniLavorati",
      messaggio: `I giorni di lavoro devono essere tra 0 e ${p.profiloStandard.giorniAnno}.`,
    });
  }

  if (errori.length > 0) return { ok: false, errori };

  const tipoContratto = input.tipoContratto === "tempoDeterminato" ? "tempoDeterminato" : "tempoIndeterminato";

  return {
    ok: true,
    valore: {
      ral: ral as number,
      mensilita: mensilita as number,
      tipoContratto,
      giorniLavorati: giorni as number,
    },
  };
}

/** Il risultato numerico, senza la cascata di presentazione. */
export type RisultatoNumerico = Pick<
  RisultatoCalcolo,
  | "redditi"
  | "contributi"
  | "irpef"
  | "addizionaleRegionale"
  | "addizionaleComunale"
  | "agevolazioni"
  | "nettoAnnuo"
>;

/**
 * Il calcolo vero e proprio, separato dalla presentazione.
 *
 * `calcola()` gli aggiunge sopra la cascata con le formule e le fonti, che
 * costa formattazione locale. La curva marginale e la property di monotonia
 * fanno centinaia di migliaia di valutazioni e non hanno bisogno di stringhe:
 * chiamano direttamente questa.
 *
 * Funzione pura: stesso input, stesso output, nessun accesso al DOM, nessuna
 * dipendenza da React, gira in Node da sola.
 */
export function calcolaNumerico(
  input: InputCalcolo,
  parametri?: ParametriAnno,
): RisultatoNumerico {
  const p = parametri ?? parametriPerAnno();
  const giorniLavorati = input.giorniLavorati ?? p.profiloStandard.giorniLavorati;
  const tipoContratto = input.tipoContratto ?? p.profiloStandard.tipoContratto;
  const ral = nonNegativo(input.ral);

  // (1) contributi
  const contributi = calcolaContributi(ral, p.contributiLavoratore);

  // le tre grandezze reddituali, che nel caso standard coincidono
  const redditoLavoroDipendente = nonNegativo(ral - contributi.totale);
  const redditoComplessivo = redditoLavoroDipendente;
  const imponibileFiscale = redditoLavoroDipendente;

  // (2) IRPEF lorda
  const lorda = calcolaIrpefLorda(imponibileFiscale, p);

  // (3) detrazione art. 13
  const art13 = calcolaDetrazioneArt13(redditoComplessivo, p, { tipoContratto, giorniLavorati });

  // (4) ulteriore detrazione cuneo, comma 6
  const cuneo = calcolaUlterioreDetrazione(redditoComplessivo, p, { giorniLavorati });

  const irpef = componiIrpef(lorda, art13, cuneo.spettante, cuneo.formula, cuneo.coefficiente);

  // (5) addizionali, dovute solo se l'IRPEF e' dovuta
  const ctx = { baseImponibile: imponibileFiscale, irpefNetta: irpef.netta };
  const addizionaleRegionale = calcolaAddizionaleRegionale(ctx, p.addizionaleRegionale);
  const addizionaleComunale = calcolaAddizionaleComunale(ctx, p.addizionaleComunale);

  // (6) somme che non concorrono al reddito
  const sommaEsente = calcolaSommaEsente(
    { redditoLavoroDipendente, redditoComplessivo, giorniLavorati },
    p,
  );
  const trattamentoIntegrativo = calcolaTrattamentoIntegrativo(
    {
      redditoComplessivo,
      // nel caso standard l'imposta lorda complessiva coincide con quella sui
      // soli redditi di lavoro dipendente, ma la condizione guarda la seconda
      impostaLordaLavoroDipendente: lorda.lorda,
      // la condizione guarda il comma 1, senza la maggiorazione del comma 1.1
      detrazioneArt13Comma1: art13.comma1,
      giorniLavorati,
    },
    p,
  );

  const nettoAnnuo =
    ral -
    contributi.totale -
    irpef.netta -
    addizionaleRegionale.importo -
    addizionaleComunale.importo +
    sommaEsente.importo +
    trattamentoIntegrativo.importo;

  return {
    redditi: { ral, redditoLavoroDipendente, redditoComplessivo, imponibileFiscale },
    contributi,
    irpef,
    addizionaleRegionale,
    addizionaleComunale,
    agevolazioni: { sommaEsente, trattamentoIntegrativo },
    nettoAnnuo,
  };
}

/**
 * Calcolo completo con la cascata pronta per l'interfaccia. E' il punto di
 * ingresso che la UI usa; il motore internamente passa da `calcolaNumerico`.
 */
export function calcola(input: InputCalcolo, parametri?: ParametriAnno): RisultatoCalcolo {
  const p = parametri ?? parametriPerAnno();
  const numerico = calcolaNumerico(input, p);

  return {
    annoImposta: p.annoImposta,
    revisioneParametri: p.revisione,
    input: {
      ...input,
      giorniLavorati: input.giorniLavorati ?? p.profiloStandard.giorniLavorati,
      tipoContratto: input.tipoContratto ?? p.profiloStandard.tipoContratto,
    },
    ...numerico,
    nettoMensile: input.mensilita > 0 ? numerico.nettoAnnuo / input.mensilita : 0,
    aliquotaMediaEffettiva:
      numerico.redditi.ral > 0
        ? (numerico.redditi.ral - numerico.nettoAnnuo) / numerico.redditi.ral
        : 0,
    cascata: componiCascata(numerico, p),
    discontinuitaVicine: discontinuitaVicine(numerico.redditi.ral, p),
  };
}

/**
 * Costruisce la cascata da mostrare in interfaccia. Ogni voce porta la formula
 * con i numeri gia' sostituiti e il riferimento normativo preso dal campo
 * `fonte` dei parametri: la UI non riscrive mai una fonte a mano.
 */
function componiCascata(r: RisultatoNumerico, p: ParametriAnno): VoceCascata[] {
  const voci: VoceCascata[] = [
    {
      id: "ral",
      etichetta: "Retribuzione annua lorda",
      importo: r.redditi.ral,
      segno: "totale",
      formula: "valore inserito",
      fonte: "Input",
    },
    {
      id: "contributi",
      etichetta: "Contributi previdenziali INPS",
      importo: r.contributi.totale,
      segno: "sottraendo",
      formula:
        `${percentuale(p.contributiLavoratore.aliquotaBase)} x ${euro(r.contributi.imponibilePrevidenziale)}` +
        (r.contributi.sogliaAggiuntivaSuperata
          ? ` + ${percentuale(p.contributiLavoratore.aliquotaAggiuntiva)} x ${euro(r.contributi.imponibilePrevidenziale - p.contributiLavoratore.sogliaAliquotaAggiuntiva)} oltre la prima fascia`
          : "") +
        (r.contributi.massimaleRaggiunto ? " [massimale contributivo raggiunto]" : ""),
      fonte: p.contributiLavoratore.fonte,
      ...(p.contributiLavoratore.url ? { url: p.contributiLavoratore.url } : {}),
    },
    {
      id: "imponibile",
      etichetta: "Imponibile fiscale",
      importo: r.redditi.imponibileFiscale,
      segno: "totale",
      formula: `${euro(r.redditi.ral)} - ${euro(r.contributi.totale)}`,
      fonte: "I contributi obbligatori sono oneri deducibili: art. 10 co. 1 lett. e) TUIR",
    },
    {
      id: "irpef-lorda",
      etichetta: "IRPEF lorda",
      importo: r.irpef.lorda,
      segno: "sottraendo",
      formula: r.irpef.scaglioni
        .filter((s) => s.imponibileNelloScaglione > 0)
        .map((s) => `${percentuale(s.aliquota)} x ${euro(s.imponibileNelloScaglione)}`)
        .join(" + "),
      fonte: p.irpef.fonte,
      ...(p.irpef.url ? { url: p.irpef.url } : {}),
    },
    {
      id: "detrazione-art13",
      etichetta: "Detrazione lavoro dipendente (art. 13 TUIR)",
      importo: r.irpef.detrazioneLavoroDipendente.goduta,
      segno: "addendo",
      formula:
        r.irpef.detrazioneLavoroDipendente.formula +
        (r.irpef.detrazioneLavoroDipendente.nonGoduta > 0
          ? ` — di cui ${euro(r.irpef.detrazioneLavoroDipendente.nonGoduta)} non goduti per incapienza`
          : ""),
      fonte: p.detrazioneLavoroDipendente.fonte,
      ...(p.detrazioneLavoroDipendente.url ? { url: p.detrazioneLavoroDipendente.url } : {}),
    },
    {
      id: "detrazione-cuneo",
      etichetta: "Ulteriore detrazione cuneo (art. 1 c. 6 L. 207/2024)",
      importo: r.irpef.ulterioreDetrazioneCuneo.goduta,
      segno: "addendo",
      formula:
        r.irpef.ulterioreDetrazioneCuneo.formula +
        (r.irpef.ulterioreDetrazioneCuneo.nonGoduta > 0
          ? ` — di cui ${euro(r.irpef.ulterioreDetrazioneCuneo.nonGoduta)} non goduti per incapienza`
          : ""),
      fonte: p.cuneoFiscale.ulterioreDetrazione.fonte,
      ...(p.cuneoFiscale.ulterioreDetrazione.url ? { url: p.cuneoFiscale.ulterioreDetrazione.url } : {}),
    },
    {
      id: "irpef-netta",
      etichetta: "IRPEF netta",
      importo: r.irpef.netta,
      segno: "sottraendo",
      formula:
        `${euro(r.irpef.lorda)} - ${euro(r.irpef.detrazioneLavoroDipendente.goduta)} - ${euro(r.irpef.ulterioreDetrazioneCuneo.goduta)}` +
        (r.irpef.azzerataPerIncapienza
          ? " [azzerata: le detrazioni non generano credito rimborsabile]"
          : ""),
      fonte: "art. 11 TUIR; le detrazioni non possono generare credito rimborsabile",
    },
    {
      id: "addizionale-regionale",
      etichetta: `Addizionale regionale ${p.addizionaleRegionale.regione}`,
      importo: r.addizionaleRegionale.importo,
      segno: "sottraendo",
      formula: r.addizionaleRegionale.dovuta
        ? (r.addizionaleRegionale.scaglioni ?? [])
            .filter((s) => s.imponibileNelloScaglione > 0)
            .map((s) => `${percentuale(s.aliquota)} x ${euro(s.imponibileNelloScaglione)}`)
            .join(" + ")
        : (r.addizionaleRegionale.motivoNonDovuta ?? "non dovuta"),
      fonte: p.addizionaleRegionale.fonte,
      ...(p.addizionaleRegionale.url ? { url: p.addizionaleRegionale.url } : {}),
    },
    {
      id: "addizionale-comunale",
      etichetta: `Addizionale comunale ${p.addizionaleComunale.comune}`,
      importo: r.addizionaleComunale.importo,
      segno: "sottraendo",
      formula: r.addizionaleComunale.dovuta
        ? `${percentuale(p.addizionaleComunale.aliquota, 3)} x ${euro(r.addizionaleComunale.baseImponibile)} (sull'intero reddito: e' esenzione, non franchigia)`
        : (r.addizionaleComunale.motivoNonDovuta ?? "non dovuta"),
      fonte: p.addizionaleComunale.fonte,
      ...(p.addizionaleComunale.url ? { url: p.addizionaleComunale.url } : {}),
    },
  ];

  if (r.agevolazioni.sommaEsente.spettante) {
    voci.push({
      id: "somma-esente",
      etichetta: "Somma esente cuneo (art. 1 c. 4 L. 207/2024)",
      importo: r.agevolazioni.sommaEsente.importo,
      segno: "addendo",
      formula: r.agevolazioni.sommaEsente.formula,
      fonte: p.cuneoFiscale.sommaEsente.fonte,
      ...(p.cuneoFiscale.sommaEsente.url ? { url: p.cuneoFiscale.sommaEsente.url } : {}),
    });
  }

  if (r.agevolazioni.trattamentoIntegrativo.spettante) {
    voci.push({
      id: "trattamento-integrativo",
      etichetta: "Trattamento integrativo (D.L. 3/2020)",
      importo: r.agevolazioni.trattamentoIntegrativo.importo,
      segno: "addendo",
      formula: r.agevolazioni.trattamentoIntegrativo.formula,
      fonte: p.trattamentoIntegrativo.fonte,
      ...(p.trattamentoIntegrativo.url ? { url: p.trattamentoIntegrativo.url } : {}),
    });
  }

  voci.push({
    id: "netto",
    etichetta: "Netto annuo",
    importo: r.nettoAnnuo,
    segno: "totale",
    formula: `${euro(r.redditi.ral)} - ${euro(r.contributi.totale)} - ${euro(r.irpef.netta)} - ${euro(r.addizionaleRegionale.importo)} - ${euro(r.addizionaleComunale.importo)}${
      r.agevolazioni.sommaEsente.importo > 0 ? ` + ${euro(r.agevolazioni.sommaEsente.importo)}` : ""
    }${
      r.agevolazioni.trattamentoIntegrativo.importo > 0
        ? ` + ${euro(r.agevolazioni.trattamentoIntegrativo.importo)}`
        : ""
    }`,
    fonte: "Composizione della catena di calcolo",
  });

  return voci;
}

/**
 * Netto annuo in piena precisione, per il percorso caldo: curva marginale,
 * delta marginale e property test. Salta la costruzione della cascata.
 */
export function nettoAnnuo(ral: Euro, p?: ParametriAnno): Euro {
  const parametri = p ?? parametriPerAnno();
  return calcolaNumerico({ ral, mensilita: parametri.mensilita.predefinita }, parametri)
    .nettoAnnuo;
}

/** Arrotondamento di presentazione applicato all'intero risultato. */
export function arrotondaPerOutput(valore: Euro, p?: ParametriAnno): Euro {
  return arrotonda(valore, (p ?? parametriPerAnno()).convenzioniNumeriche.decimaliOutput);
}
