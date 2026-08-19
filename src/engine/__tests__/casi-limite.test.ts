/**
 * Casi limite obbligatori della §3 del dossier, più la validazione dell'input.
 *
 * I casi del dossier sono espressi in IMPONIBILE, mentre l'input del motore è la
 * RAL: `ralPerImponibile` fa l'inversione, che ha tre rami perché la funzione
 * contributiva è lineare a tratti.
 */

import { describe, expect, it } from "vitest";

import { calcola, calcolaNumerico, nettoAnnuo, validaInput } from "../calcola";
import { ralPerImponibileFiscale } from "../contributi";
import { arrotonda } from "../numerico";
import { parametriPerAnno } from "../parametri";

const p = parametriPerAnno();

/**
 * Inversione esatta su tutti e tre i rami della funzione contributiva. La
 * versione a un solo ramo, `imponibile / 0,9081`, è corretta solo sotto la
 * prima fascia pensionabile e sbaglia di decine di euro sopra: è il motivo per
 * cui esiste `ralPerImponibileFiscale` nel motore.
 */
function ralPerImponibile(imponibile: number): number {
  return ralPerImponibileFiscale(imponibile, p.contributiLavoratore);
}

const netto = (ral: number) => nettoAnnuo(ral, p);
const r = (ral: number) => calcolaNumerico({ ral, mensilita: 13 }, p);

describe("imponibile 23.000,00 vs 23.000,01 — esenzione comunale, non franchigia", () => {
  const sotto = r(ralPerImponibile(23000));
  const sopra = r(ralPerImponibile(23000.01));

  it("a 23.000,00 l'addizionale comunale non è dovuta", () => {
    expect(sotto.addizionaleComunale.importo).toBe(0);
    expect(sotto.addizionaleComunale.esenzioneApplicata).toBe(true);
  });

  it("a 23.000,01 si applica sull'INTERO reddito, non sull'eccedenza", () => {
    expect(arrotonda(sopra.addizionaleComunale.importo)).toBeCloseTo(184, 2);
    // se fosse una franchigia sarebbe 0,8% x 0,01 = 0,00008
    expect(sopra.addizionaleComunale.baseImponibile).toBeCloseTo(23000.01, 2);
  });

  it("il salto sul netto è di 184 euro", () => {
    const salto = netto(ralPerImponibile(23000.01)) - netto(ralPerImponibile(23000));
    expect(salto).toBeLessThan(-183.9);
    expect(salto).toBeGreaterThan(-184.1);
  });
});

describe("imponibile 28.000 — confine di scaglione e cambio formula detrazione", () => {
  it("la detrazione è continua attraverso il confine", () => {
    const a = r(ralPerImponibile(28000)).irpef.detrazioneLavoroDipendente.spettante;
    const b = r(ralPerImponibile(28000.01)).irpef.detrazioneLavoroDipendente.spettante;
    // entrambe le formule danno 1.910 a 28.000: 1910 + 1190x0 e 1910x1
    expect(arrotonda(a)).toBeCloseTo(1910 + 65, 2);
    expect(Math.abs(a - b)).toBeLessThan(0.2);
  });

  it("l'aliquota IRPEF passa dal 23% al 33%", () => {
    const dettagli = r(ralPerImponibile(30000)).irpef.scaglioni;
    expect(dettagli[0]!.aliquota).toBe(0.23);
    expect(dettagli[1]!.aliquota).toBe(0.33);
    expect(dettagli[1]!.imponibileNelloScaglione).toBeCloseTo(2000, 2);
  });
});

describe("imponibile 50.000,00 vs 50.000,01 — azzeramento detrazione e terzo scaglione", () => {
  it("la detrazione art. 13 è già zero a 50.000 e resta zero sopra", () => {
    expect(r(ralPerImponibile(50000)).irpef.detrazioneLavoroDipendente.spettante).toBeCloseTo(0, 6);
    expect(r(ralPerImponibile(50000.01)).irpef.detrazioneLavoroDipendente.spettante).toBe(0);
  });

  it("il minimo di 690 euro NON si applica sopra i 50.000", () => {
    expect(r(ralPerImponibile(60000)).irpef.detrazioneLavoroDipendente.spettante).toBe(0);
  });

  it("l'azzeramento è continuo: nessun gradino", () => {
    const salto = netto(ralPerImponibile(50000.01)) - netto(ralPerImponibile(50000));
    expect(Math.abs(salto)).toBeLessThan(0.5);
  });

  it("oltre 50.000 entra il terzo scaglione al 43%", () => {
    const dettagli = r(ralPerImponibile(55000)).irpef.scaglioni;
    expect(dettagli[2]!.aliquota).toBe(0.43);
    expect(dettagli[2]!.imponibileNelloScaglione).toBeCloseTo(5000, 2);
  });
});

describe("imponibile 20.000,00 vs 20.000,01 — somma esente cede all'ulteriore detrazione", () => {
  const sotto = r(ralPerImponibile(20000));
  const sopra = r(ralPerImponibile(20000.01));

  it("a 20.000 spetta la somma esente al 4,8% e non l'ulteriore detrazione", () => {
    expect(sotto.agevolazioni.sommaEsente.spettante).toBe(true);
    expect(sotto.agevolazioni.sommaEsente.percentualeApplicata).toBe(0.048);
    expect(arrotonda(sotto.agevolazioni.sommaEsente.importo)).toBeCloseTo(960, 2);
    expect(sotto.irpef.ulterioreDetrazioneCuneo.spettante).toBe(0);
  });

  it("a 20.000,01 spetta l'ulteriore detrazione e non la somma esente", () => {
    expect(sopra.agevolazioni.sommaEsente.spettante).toBe(false);
    expect(sopra.agevolazioni.sommaEsente.importo).toBe(0);
    expect(arrotonda(sopra.irpef.ulterioreDetrazioneCuneo.spettante)).toBe(1000);
  });

  it("non sono mai cumulabili", () => {
    for (const imponibile of [8000, 15000, 19999, 20000, 20001, 30000, 39999]) {
      const x = r(ralPerImponibile(imponibile));
      const entrambe =
        x.agevolazioni.sommaEsente.importo > 0 && x.irpef.ulterioreDetrazioneCuneo.spettante > 0;
      expect(entrambe).toBe(false);
    }
  });
});

describe("imponibile 32.000 e 40.000 — inizio e fine del phase-out del cuneo", () => {
  it("a 32.000 l'ulteriore detrazione è ancora piena", () => {
    expect(arrotonda(r(ralPerImponibile(32000)).irpef.ulterioreDetrazioneCuneo.spettante)).toBe(1000);
  });

  it("a metà del phase-out vale la metà", () => {
    expect(
      arrotonda(r(ralPerImponibile(36000)).irpef.ulterioreDetrazioneCuneo.spettante),
    ).toBeCloseTo(500, 2);
  });

  it("a 40.000 si è azzerata, con continuità", () => {
    expect(r(ralPerImponibile(40000)).irpef.ulterioreDetrazioneCuneo.spettante).toBeCloseTo(0, 6);
    expect(r(ralPerImponibile(40000.01)).irpef.ulterioreDetrazioneCuneo.spettante).toBe(0);
  });
});

describe("imponibile 25.000,01 e 35.000 — maggiorazione di 65 euro", () => {
  it("non spetta a 25.000,00 e spetta a 25.000,01", () => {
    expect(r(ralPerImponibile(25000)).irpef.maggiorazioneApplicata).toBe(0);
    expect(r(ralPerImponibile(25000.01)).irpef.maggiorazioneApplicata).toBe(65);
  });

  it("spetta ancora a 35.000,00 e non più a 35.000,01", () => {
    expect(r(ralPerImponibile(35000)).irpef.maggiorazioneApplicata).toBe(65);
    expect(r(ralPerImponibile(35000.01)).irpef.maggiorazioneApplicata).toBe(0);
  });
});

describe("RAL 56.224 vs 56.225 — attivazione dell'1% INPS aggiuntivo", () => {
  it("a 56.224 l'aliquota aggiuntiva non è ancora attiva", () => {
    const x = r(56224);
    expect(x.contributi.sogliaAggiuntivaSuperata).toBe(false);
    expect(x.contributi.quotaAggiuntiva).toBe(0);
    expect(arrotonda(x.contributi.totale)).toBeCloseTo(56224 * 0.0919, 2);
  });

  it("a 56.225 si attiva sull'eccedenza, non sull'intero", () => {
    const x = r(56225);
    expect(x.contributi.sogliaAggiuntivaSuperata).toBe(true);
    expect(arrotonda(x.contributi.quotaAggiuntiva)).toBeCloseTo(0.01, 2);
  });

  it("sopra la soglia l'aliquota marginale contributiva è il 10,19%", () => {
    const marginale = (r(57000).contributi.totale - r(56224).contributi.totale) / 776;
    expect(marginale).toBeCloseTo(0.1019, 8);
  });
});

describe("RAL 130.000 — massimale contributivo", () => {
  const x = r(130000);

  it("l'imponibile previdenziale si ferma al massimale", () => {
    expect(x.contributi.massimaleRaggiunto).toBe(true);
    expect(x.contributi.imponibilePrevidenziale).toBe(122295);
  });

  it("oltre il massimale i contributi non crescono più", () => {
    expect(r(200000).contributi.totale).toBeCloseTo(x.contributi.totale, 8);
  });

  it("oltre il massimale l'aliquota marginale è solo IRPEF e addizionali", () => {
    const marginale = 1 - (netto(131000) - netto(130000)) / 1000;
    expect(marginale).toBeCloseTo(0.43 + 0.0173 + 0.008, 4);
  });
});

describe("RAL basse — l'IRPEF netta non scende mai sotto zero", () => {
  it.each([0, 1, 100, 1000, 5000, 8000, 8500, 9000, 10000, 12000, 15000])(
    "RAL %i",
    (ral) => {
      const x = r(ral);
      expect(x.irpef.netta).toBeGreaterThanOrEqual(0);
      expect(x.addizionaleRegionale.importo).toBeGreaterThanOrEqual(0);
      expect(x.addizionaleComunale.importo).toBeGreaterThanOrEqual(0);
    },
  );

  it("in incapienza le detrazioni non godute sono esposte, non nascoste", () => {
    const x = r(9000);
    expect(x.irpef.azzerataPerIncapienza).toBe(true);
    expect(x.irpef.detrazioniNonGodute).toBeGreaterThan(0);
    expect(x.nettoAnnuo).toBeGreaterThan(0);
  });

  it("senza IRPEF dovuta nessuna delle due addizionali si applica", () => {
    const x = r(9000);
    expect(x.irpef.netta).toBe(0);
    expect(x.addizionaleRegionale.dovuta).toBe(false);
    expect(x.addizionaleComunale.dovuta).toBe(false);
    expect(x.addizionaleRegionale.motivoNonDovuta).toMatch(/art\. 50 D\.Lgs\. 446\/1997/);
  });

  it("a RAL zero il netto è zero", () => {
    expect(r(0).nettoAnnuo).toBe(0);
  });
});

describe("trattamento integrativo — la franchigia di 75 euro sposta la soglia", () => {
  it("non spetta appena sotto imponibile 8.173,91", () => {
    expect(r(ralPerImponibile(8100)).agevolazioni.trattamentoIntegrativo.spettante).toBe(false);
  });

  it("spetta appena sopra, e vale 1.200 euro", () => {
    const x = r(ralPerImponibile(8300));
    expect(x.agevolazioni.trattamentoIntegrativo.spettante).toBe(true);
    expect(x.agevolazioni.trattamentoIntegrativo.importo).toBe(1200);
  });

  it("la soglia di capienza è 1.955 - 75 = 1.880, cioè quella storica", () => {
    expect(r(ralPerImponibile(10000)).agevolazioni.trattamentoIntegrativo.sogliaCapienza).toBe(1880);
  });

  it("senza la franchigia la soglia sarebbe stata imponibile 8.500", () => {
    // 1.880 / 0,23 = 8.173,91 con franchigia; 1.955 / 0,23 = 8.500 senza
    expect(1880 / 0.23).toBeCloseTo(8173.91, 2);
    expect(1955 / 0.23).toBeCloseTo(8500, 2);
  });

  it("non spetta sopra i 15.000 di reddito complessivo", () => {
    expect(r(ralPerImponibile(15000.01)).agevolazioni.trattamentoIntegrativo.spettante).toBe(false);
  });

  it("è cumulabile con la somma esente del cuneo", () => {
    const x = r(ralPerImponibile(12000));
    expect(x.agevolazioni.trattamentoIntegrativo.importo).toBe(1200);
    expect(x.agevolazioni.sommaEsente.importo).toBeGreaterThan(0);
  });
});

describe("somma esente — aliquota unica, non a scaglioni", () => {
  it("a 18.000 di imponibile vale 864 euro e non 1.092", () => {
    const x = r(ralPerImponibile(18000));
    expect(arrotonda(x.agevolazioni.sommaEsente.importo)).toBeCloseTo(864, 2);
    // il calcolo a scaglioni, sbagliato, darebbe:
    const aScaglioni = 8500 * 0.071 + 6500 * 0.053 + 3000 * 0.048;
    expect(arrotonda(aScaglioni)).toBeCloseTo(1092, 2);
  });

  it("la percentuale si applica all'intero reddito della fascia", () => {
    const x = r(ralPerImponibile(10000));
    expect(x.agevolazioni.sommaEsente.percentualeApplicata).toBe(0.053);
    expect(arrotonda(x.agevolazioni.sommaEsente.importo)).toBeCloseTo(530, 2);
  });

  it("a 365 giorni reddito annualizzato ed effettivo coincidono", () => {
    const x = r(ralPerImponibile(12000));
    expect(x.agevolazioni.sommaEsente.redditoAnnualizzatoPerFascia).toBeCloseTo(
      x.agevolazioni.sommaEsente.redditoEffettivo,
      8,
    );
  });

  it("comma 5: la fascia si sceglie sull'annualizzato, la percentuale si applica all'effettivo", () => {
    // Esempio della Circolare AdE 4/E del 16 maggio 2025: 3.000 euro in 92 giorni.
    // Annualizzato 11.902,17 -> fascia b) 5,3% -> spettante 5,3% x 3.000 = 159.
    const ral = 3000 / (1 - p.contributiLavoratore.aliquotaBase);
    const x = calcolaNumerico({ ral, mensilita: 13, giorniLavorati: 92 }, p);
    const se = x.agevolazioni.sommaEsente;
    expect(se.redditoEffettivo).toBeCloseTo(3000, 6);
    expect(se.redditoAnnualizzatoPerFascia).toBeCloseTo(11902.17, 1);
    expect(se.percentualeApplicata).toBe(0.053);
    expect(arrotonda(se.importo)).toBeCloseTo(159, 2);
    // applicando la percentuale all'annualizzato, sbagliando, verrebbe 630,81
    expect(arrotonda(11902.17 * 0.053)).toBeCloseTo(630.82, 2);
  });

  it("senza giorni retribuiti non spetta (Risposta AdE 7/2026)", () => {
    const x = calcolaNumerico({ ral: 10000, mensilita: 13, giorniLavorati: 0 }, p);
    expect(x.agevolazioni.sommaEsente.spettante).toBe(false);
    expect(x.agevolazioni.sommaEsente.motivoNonSpettante).toMatch(/7\/2026/);
  });
});

describe("minimi della detrazione art. 13", () => {
  it("a tempo indeterminato e anno intero il minimo non morde mai", () => {
    const x = r(ralPerImponibile(12000));
    expect(arrotonda(x.irpef.detrazioneLavoroDipendente.spettante)).toBe(1955);
  });

  it("a tempo determinato con pochi giorni il minimo è 1.380 e non 690", () => {
    const ral = ralPerImponibile(12000);
    const determinato = calcolaNumerico(
      { ral, mensilita: 13, giorniLavorati: 60, tipoContratto: "tempoDeterminato" },
      p,
    );
    const indeterminato = calcolaNumerico(
      { ral, mensilita: 13, giorniLavorati: 60, tipoContratto: "tempoIndeterminato" },
      p,
    );
    expect(arrotonda(determinato.irpef.detrazioneLavoroDipendente.spettante)).toBe(1380);
    expect(arrotonda(indeterminato.irpef.detrazioneLavoroDipendente.spettante)).toBe(690);
  });
});

describe("validazione dell'input", () => {
  it.each([
    [{ ral: -1, mensilita: 13 }, "RAL_NEGATIVA"],
    [{ ral: Number.NaN, mensilita: 13 }, "RAL_NON_FINITA"],
    [{ ral: Number.POSITIVE_INFINITY, mensilita: 13 }, "RAL_NON_FINITA"],
    [{ ral: "" as unknown as number, mensilita: 13 }, "RAL_NON_NUMERICA"],
    [{ ral: undefined as unknown as number, mensilita: 13 }, "RAL_NON_NUMERICA"],
    [{ ral: 1e12, mensilita: 13 }, "RAL_FUORI_SCALA"],
    [{ ral: 30000, mensilita: 15 }, "MENSILITA_NON_AMMESSA"],
    [{ ral: 30000, mensilita: 13, giorniLavorati: 400 }, "GIORNI_NON_VALIDI"],
    [{ ral: 30000, mensilita: 13, giorniLavorati: -5 }, "GIORNI_NON_VALIDI"],
  ])("rifiuta %o con codice %s", (input, codice) => {
    const esito = validaInput(input, p);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errori.map((e) => e.codice)).toContain(codice);
  });

  it("accetta zero: è un valore legittimo, non un errore", () => {
    expect(validaInput({ ral: 0, mensilita: 13 }, p).ok).toBe(true);
  });

  it("applica i valori predefiniti quando i campi opzionali mancano", () => {
    const esito = validaInput({ ral: 30000 }, p);
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.valore.mensilita).toBe(13);
      expect(esito.valore.giorniLavorati).toBe(365);
      expect(esito.valore.tipoContratto).toBe("tempoIndeterminato");
    }
  });

  it("non lancia eccezioni: gli errori sono un valore di ritorno", () => {
    expect(() => validaInput(null, p)).not.toThrow();
    expect(() => validaInput("trentamila", p)).not.toThrow();
  });
});

describe("determinismo e purezza", () => {
  it("stesso input, stesso output", () => {
    const a = calcola({ ral: 42_137.42, mensilita: 14 }, p);
    const b = calcola({ ral: 42_137.42, mensilita: 14 }, p);
    expect(a.nettoAnnuo).toBe(b.nettoAnnuo);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("non muta i parametri ricevuti", () => {
    const prima = JSON.stringify(p);
    calcola({ ral: 35000, mensilita: 13 }, p);
    expect(JSON.stringify(p)).toBe(prima);
  });
});
