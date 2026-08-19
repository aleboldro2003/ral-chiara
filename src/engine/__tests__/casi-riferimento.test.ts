/**
 * Test di regressione sui tre casi di riferimento del dossier (§3), verificati
 * VOCE PER VOCE e non solo sul netto finale.
 *
 * Tolleranza: 1 centesimo. Il motore lavora in piena precisione e arrotonda solo
 * in presentazione, mentre i casi del dossier sono stati calcolati arrotondando
 * ogni voce. La differenza si manifesta una volta sola, sull'IRPEF netta del
 * caso 35.000, e vale 1 centesimo. La scelta e' documentata nella §8 del dossier:
 * un motore mensile richiederebbe l'arrotondamento a ogni step perche' il
 * sostituto d'imposta lavora in centesimi; con il calcolo annuale la scelta
 * opposta e' preferibile, perche' l'arrotondamento intermedio introduce da solo
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

  it("netto mensile su 13 mensilita'", () => {
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

describe("il numero di mensilita' non cambia il netto annuo", () => {
  it.each(p.mensilita.opzioni)("con %i mensilita'", (mensilita) => {
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
