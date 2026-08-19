/**
 * Test di regressione sui tre casi di riferimento del dossier (§3), verificati
 * VOCE PER VOCE e non solo sul netto finale.
 *
 * Tolleranza: 1 centesimo. Il motore lavora in piena precisione e arrotonda solo
 * in presentazione, mentre i casi del dossier sono stati calcolati arrotondando
 * ogni voce. La differenza si manifesta una volta sola, sull'IRPEF netta del
 * caso 35.000, e vale 1 centesimo. La scelta è documentata nella §8 del dossier:
 * un motore mensile richiederebbe l'arrotondamento a ogni step perché il
 * sostituto d'imposta lavora in centesimi; con il calcolo annuale la scelta
 * opposta è preferibile, perché l'arrotondamento intermedio introduce da solo
 * decine di migliaia di micro-violazioni di monotonia.
 */

import { describe, expect, it } from "vitest";

import { calcola } from "../calcola";
import { arrotonda } from "../numerico";
import { parametriPerAnno } from "../parametri";

const p = parametriPerAnno();
const CENTESIMO = 0.01;

interface CasoRiferimento {
  ral: number;
  contributi: number;
  imponibile: number;
  irpefLorda: number;
  detrazioneArt13: number;
  maggiorazione: number;
  ulterioreDetrazione: number;
  irpefNetta: number;
  addizionaleRegionale: number;
  addizionaleComunale: number;
  sommaEsente: number;
  trattamentoIntegrativo: number;
  nettoAnnuo: number;
  nettoMensile13: number;
}

const CASI: readonly CasoRiferimento[] = [
  {
    ral: 25000,
    contributi: 2297.5,
    imponibile: 22702.5,
    irpefLorda: 5221.58,
    detrazioneArt13: 2394.93,
    maggiorazione: 0,
    ulterioreDetrazione: 1000,
    irpefNetta: 1826.65,
    addizionaleRegionale: 306.2,
    addizionaleComunale: 0, // imponibile <= 23.000: esente
    sommaEsente: 0,
    trattamentoIntegrativo: 0,
    nettoAnnuo: 20569.65,
    nettoMensile13: 1582.28,
  },
  {
    ral: 35000,
    contributi: 3216.5,
    imponibile: 31783.5,
    irpefLorda: 7688.56,
    detrazioneArt13: 1646.48, // 1.581,48 + 65 — rev. 2, con coefficiente troncato
    maggiorazione: 65,
    ulterioreDetrazione: 1000,
    irpefNetta: 5042.08,
    addizionaleRegionale: 454.98,
    addizionaleComunale: 254.27,
    sommaEsente: 0,
    trattamentoIntegrativo: 0,
    nettoAnnuo: 26032.18,
    nettoMensile13: 2002.48,
  },
  {
    ral: 60000,
    contributi: 5551.76, // 9,19% + 1% sull'eccedenza di 56.224
    imponibile: 54448.24,
    irpefLorda: 15612.74,
    detrazioneArt13: 0, // reddito complessivo > 50.000
    maggiorazione: 0,
    ulterioreDetrazione: 0, // reddito complessivo > 40.000
    irpefNetta: 15612.74,
    addizionaleRegionale: 845.25,
    addizionaleComunale: 435.59,
    sommaEsente: 0,
    trattamentoIntegrativo: 0,
    nettoAnnuo: 37554.66,
    nettoMensile13: 2888.82,
  },
];

describe.each(CASI)("caso di riferimento RAL $ral", (caso) => {
  const r = calcola({ ral: caso.ral, mensilita: 13 }, p);

  it("contributi INPS", () => {
    expect(arrotonda(r.contributi.totale)).toBeCloseTo(caso.contributi, 2);
  });

  it("imponibile fiscale", () => {
    expect(arrotonda(r.redditi.imponibileFiscale)).toBeCloseTo(caso.imponibile, 2);
  });

  it("IRPEF lorda", () => {
    expect(arrotonda(r.irpef.lorda)).toBeCloseTo(caso.irpefLorda, 2);
  });

  it("detrazione art. 13 spettante, maggiorazione inclusa", () => {
    expect(arrotonda(r.irpef.detrazioneLavoroDipendente.spettante)).toBeCloseTo(
      caso.detrazioneArt13,
      2,
    );
  });

  it("maggiorazione art. 13 co. 1.1", () => {
    expect(arrotonda(r.irpef.maggiorazioneApplicata)).toBe(caso.maggiorazione);
  });

  it("ulteriore detrazione cuneo", () => {
    expect(arrotonda(r.irpef.ulterioreDetrazioneCuneo.spettante)).toBeCloseTo(
      caso.ulterioreDetrazione,
      2,
    );
  });

  it("IRPEF netta", () => {
    expect(Math.abs(arrotonda(r.irpef.netta) - caso.irpefNetta)).toBeLessThanOrEqual(CENTESIMO);
  });

  it("addizionale regionale Lombardia", () => {
    expect(arrotonda(r.addizionaleRegionale.importo)).toBeCloseTo(caso.addizionaleRegionale, 2);
  });

  it("addizionale comunale Milano", () => {
    expect(arrotonda(r.addizionaleComunale.importo)).toBeCloseTo(caso.addizionaleComunale, 2);
  });

  it("somma esente cuneo", () => {
    expect(arrotonda(r.agevolazioni.sommaEsente.importo)).toBe(caso.sommaEsente);
  });

  it("trattamento integrativo", () => {
    expect(arrotonda(r.agevolazioni.trattamentoIntegrativo.importo)).toBe(
      caso.trattamentoIntegrativo,
    );
  });

  it("netto annuo", () => {
    expect(Math.abs(arrotonda(r.nettoAnnuo) - caso.nettoAnnuo)).toBeLessThanOrEqual(CENTESIMO);
  });

  it("netto mensile su 13 mensilità", () => {
    expect(Math.abs(arrotonda(r.nettoMensile) - caso.nettoMensile13)).toBeLessThanOrEqual(
      CENTESIMO,
    );
  });

  it("la catena torna: RAL - contributi - imposte + esenti = netto", () => {
    const ricomposto =
      caso.ral -
      r.contributi.totale -
      r.irpef.netta -
      r.addizionaleRegionale.importo -
      r.addizionaleComunale.importo +
      r.agevolazioni.sommaEsente.importo +
      r.agevolazioni.trattamentoIntegrativo.importo;
    expect(ricomposto).toBeCloseTo(r.nettoAnnuo, 10);
  });
});

describe("il numero di mensilità non cambia il netto annuo", () => {
  it.each(p.mensilita.opzioni)("con %i mensilità", (mensilita) => {
    const r = calcola({ ral: 35000, mensilita }, p);
    expect(arrotonda(r.nettoAnnuo)).toBeCloseTo(26032.18, 2);
    expect(r.nettoMensile * mensilita).toBeCloseTo(r.nettoAnnuo, 8);
  });
});

describe("la cascata esposta all'interfaccia", () => {
  const r = calcola({ ral: 35000, mensilita: 13 }, p);

  it("espone ogni passaggio della catena nell'ordine di lettura", () => {
    expect(r.cascata.map((v) => v.id)).toEqual([
      "ral",
      "contributi",
      "imponibile",
      "irpef-lorda",
      "detrazione-art13",
      "detrazione-cuneo",
      "irpef-netta",
      "addizionale-regionale",
      "addizionale-comunale",
      "netto",
    ]);
  });

  it("ogni voce porta una formula con i numeri sostituiti e una fonte", () => {
    for (const voce of r.cascata) {
      expect(voce.formula.length).toBeGreaterThan(0);
      expect(voce.fonte.length).toBeGreaterThan(0);
    }
  });

  it("le fonti vengono dai parametri e non sono riscritte a mano", () => {
    const irpef = r.cascata.find((v) => v.id === "irpef-lorda");
    expect(irpef?.fonte).toBe(p.irpef.fonte);
    expect(irpef?.url).toBe(p.irpef.url);
  });

  it("dichiara l'anno d'imposta e la revisione dei parametri usati", () => {
    expect(r.annoImposta).toBe(2026);
    expect(r.revisioneParametri).toBe(p.revisione);
  });
});

/**
 * Il brief chiede tre output, e il terzo è "quanto sono le tasse". Imposte e
 * contributi restano separati perché sono giuridicamente diversi: i contributi
 * previdenziali finanziano una prestazione futura intestata al lavoratore, le
 * imposte no. Questi test presidiano quella separazione e la sua coerenza con
 * le righe della cascata.
 */
describe("separazione tra imposte e contributi", () => {
  it("a RAL 35.000 le imposte sono 5.751,33 e i contributi 3.216,50", () => {
    const r = calcola({ ral: 35000, mensilita: 13 }, p);
    expect(arrotonda(r.prelievo.imposte)).toBe(5751.33);
    expect(arrotonda(r.prelievo.contributi)).toBe(3216.5);
    expect(arrotonda(r.prelievo.totale)).toBe(8967.83);
  });

  it("le imposte coincidono con la somma delle voci mostrate nella cascata", () => {
    for (const ral of [18000, 25000, 35000, 60000]) {
      const r = calcola({ ral, mensilita: 13 }, p);
      const somma =
        arrotonda(r.irpef.netta) +
        arrotonda(r.addizionaleRegionale.importo) +
        arrotonda(r.addizionaleComunale.importo);
      expect(arrotonda(r.prelievo.imposte)).toBe(arrotonda(somma));
    }
  });

  it("i contributi non sono mai contati tra le imposte", () => {
    for (const ral of [12000, 20000, 35000, 90000, 130000]) {
      const r = calcola({ ral, mensilita: 13 }, p);
      expect(r.prelievo.imposte).not.toBeCloseTo(r.prelievo.totale, 2);
      expect(r.prelievo.totale).toBeCloseTo(r.prelievo.imposte + r.prelievo.contributi, 6);
    }
  });

  it("netto prima dei benefici più benefici fiscali fa il netto annuale", () => {
    for (const ral of [9000, 15000, 18000, 22000, 35000]) {
      const r = calcola({ ral, mensilita: 13 }, p);
      expect(r.prelievo.nettoPrimaDeiBenefici + r.prelievo.beneficiFiscali).toBeCloseTo(
        r.nettoAnnuo,
        6,
      );
    }
  });

  it("sotto i 20.000 i benefici fiscali esistono e il netto li supera", () => {
    const r = calcola({ ral: 18000, mensilita: 13 }, p);
    expect(r.prelievo.beneficiFiscali).toBeGreaterThan(0);
    expect(r.nettoAnnuo).toBeGreaterThan(r.prelievo.nettoPrimaDeiBenefici);
  });

  it("l'incidenza complessiva è quota della RAL, non dell'imponibile", () => {
    const r = calcola({ ral: 35000, mensilita: 13 }, p);
    expect(r.prelievo.incidenzaComplessiva).toBeCloseTo(r.prelievo.totale / 35000, 6);
    expect(r.prelievo.incidenzaImposte + r.prelievo.incidenzaContributi).toBeCloseTo(
      r.prelievo.incidenzaComplessiva,
      6,
    );
  });
});
