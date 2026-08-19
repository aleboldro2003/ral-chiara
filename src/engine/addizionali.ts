/**
 * Step 5 della catena: addizionale regionale e comunale all'IRPEF.
 *
 * Due caratteristiche che le distinguono dall'IRPEF e che sono la causa di due
 * delle quattro soglie a gradino del modello:
 *
 *  - non hanno detrazioni proprie: si applicano al reddito complessivo secco;
 *  - sono dovute SOLO se per lo stesso anno risulta dovuta l'IRPEF al netto
 *    delle detrazioni. Se l'IRPEF netta e' zero, non si applicano. Questa e' una
 *    soglia di CAPIENZA, e vale per entrambe: art. 50 D.Lgs. 446/1997 per la
 *    regionale, art. 1 D.Lgs. 360/1998 per la comunale.
 *
 * L'esenzione comunale e' inoltre un'ESENZIONE e non una franchigia: superata la
 * soglia il tributo si applica sull'intero reddito, non sulla sola eccedenza.
 * Il tipo e' un dato del file di parametri, non un ramo cablato nel codice,
 * perche' altri comuni deliberano franchigie vere.
 */

import { applicaScalaProgressiva, nonNegativo, sommaScaglioni } from "./numerico";
import type {
  DettaglioAddizionale,
  Euro,
  ParametriAddizionaleComunale,
  ParametriAddizionaleRegionale,
} from "./tipi";

interface ContestoAddizionali {
  readonly baseImponibile: Euro;
  readonly irpefNetta: Euro;
}

export function calcolaAddizionaleRegionale(
  ctx: ContestoAddizionali,
  p: ParametriAddizionaleRegionale,
): DettaglioAddizionale {
  const base = nonNegativo(ctx.baseImponibile);

  if (p.dovutaSoloSeIrpefDovuta && ctx.irpefNetta <= 0) {
    return {
      importo: 0,
      dovuta: false,
      motivoNonDovuta:
        "l'IRPEF netta e' pari a zero: l'addizionale regionale e' dovuta solo se per lo stesso anno risulta dovuta l'IRPEF (art. 50 D.Lgs. 446/1997)",
      baseImponibile: base,
      scaglioni: [],
    };
  }

  const scaglioni = applicaScalaProgressiva(base, p.scaglioni);

  return {
    importo: sommaScaglioni(scaglioni),
    dovuta: true,
    motivoNonDovuta: null,
    baseImponibile: base,
    scaglioni,
  };
}

export function calcolaAddizionaleComunale(
  ctx: ContestoAddizionali,
  p: ParametriAddizionaleComunale,
): DettaglioAddizionale {
  const base = nonNegativo(ctx.baseImponibile);

  if (p.dovutaSoloSeIrpefDovuta && ctx.irpefNetta <= 0) {
    return {
      importo: 0,
      dovuta: false,
      motivoNonDovuta:
        "l'IRPEF netta e' pari a zero: l'addizionale comunale e' dovuta solo se per lo stesso anno risulta dovuta l'IRPEF (art. 1 D.Lgs. 360/1998)",
      baseImponibile: base,
      esenzioneApplicata: false,
    };
  }

  const esenzione = p.esenzione;
  if (esenzione && base <= esenzione.soglia) {
    return {
      importo: 0,
      dovuta: false,
      motivoNonDovuta: `reddito imponibile entro la soglia di esenzione di ${esenzione.soglia} euro`,
      baseImponibile: base,
      esenzioneApplicata: true,
    };
  }

  /**
   * Qui sta la differenza che vale 184 euro. Con `tipo: "esenzione"` la base
   * resta l'intero reddito; con `tipo: "franchigia"` sarebbe la sola eccedenza.
   * Milano usa la prima, e da qui il gradino.
   */
  const baseEffettiva =
    esenzione && esenzione.tipo === "franchigia" ? base - esenzione.soglia : base;

  return {
    importo: baseEffettiva * p.aliquota,
    dovuta: true,
    motivoNonDovuta: null,
    baseImponibile: baseEffettiva,
    esenzioneApplicata: false,
  };
}
