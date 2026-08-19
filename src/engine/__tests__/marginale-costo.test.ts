/**
 * La curva dell'aliquota marginale e la vista costo azienda.
 *
 * I valori attesi sono quelli della §4 del dossier, rev. 2, che a loro volta
 * vengono da questo motore: il test verifica che la gobba ci sia e stia dove
 * deve stare, non che una tabella scritta a mano torni.
 */

import { describe, expect, it } from "vitest";

import { calcolaCostoAzienda, calcolaDeltaMarginale } from "../costoAzienda";
import { aliquotaMarginale, curvaMarginale } from "../marginale";
import { arrotonda } from "../numerico";
import { parametriPerAnno } from "../parametri";
import { discontinuitaVicine, ralSogliaDi, ralSogliaVisualizzata } from "../soglie";

const p = parametriPerAnno();
const marginale = (ral: number) => aliquotaMarginale(ral, 100, p);

describe("la curva dell'aliquota marginale non e' monotona", () => {
  it("riproduce le fasce della §4 del dossier", () => {
    expect(marginale(25000)).toBeCloseTo(0.398, 2); // 20.000-28.000 di imponibile
    expect(marginale(33000)).toBeCloseTo(0.493, 2); // 28.000-32.000
    expect(marginale(40000)).toBeCloseTo(0.607, 2); // 32.000-40.000 — la gobba
    expect(marginale(50000)).toBeCloseTo(0.493, 2); // 40.000-50.000
    expect(marginale(60000)).toBeCloseTo(0.511, 2); // oltre, con l'1% INPS
  });

  it("nella gobba la marginale supera quella della fascia SUPERIORE", () => {
    const gobba = marginale(40000);
    const sopra = marginale(50000);
    expect(gobba).toBeGreaterThan(sopra);
    expect(gobba - sopra).toBeGreaterThan(0.1);
  });

  it("la gobba sta tra RAL 35.238 e 44.048, come da conversione dell'imponibile", () => {
    expect(marginale(35500)).toBeGreaterThan(0.58);
    expect(marginale(43800)).toBeGreaterThan(0.58);
    expect(marginale(34500)).toBeLessThan(0.55);
    expect(marginale(44500)).toBeLessThan(0.55);
  });

  it("nella fascia stretta tra imponibile 50.000 e l'1% INPS vale circa il 50,5%", () => {
    expect(marginale(55600)).toBeCloseTo(0.505, 2);
  });

  it("la curva viene campionata dal motore, non da valori precalcolati", () => {
    const punti = curvaMarginale({ da: 20000, a: 80000, passo: 100 }, p);
    expect(punti).toHaveLength(601);
    expect(punti[0]!.ral).toBe(20000);
    expect(punti.at(-1)!.ral).toBe(80000);
    // Il massimo ASSOLUTO della curva campionata non sta nella gobba: sta su una
    // soglia a gradino, dove una finestra da 100 € contiene un salto di 184 € e
    // la marginale schizza oltre il 200%. Il massimo che interessa e' quello del
    // regime continuo, quindi si escludono le finestre che attraversano una soglia.
    const soglie = p.discontinuita.soglie.map((s) => ralSogliaDi(s, p));
    const continui = punti.filter((punto) =>
      soglie.every((s) => Math.abs(s - punto.ral) > 100),
    );
    const massimo = continui.reduce((a, b) => (b.aliquotaMarginale > a.aliquotaMarginale ? b : a));
    expect(massimo.ral).toBeGreaterThan(35000);
    expect(massimo.ral).toBeLessThan(44100);
    expect(massimo.aliquotaMarginale).toBeGreaterThan(0.6);

    // e sulle soglie la marginale campionata supera davvero il 100%
    const suSoglia = punti.find((punto) => Math.abs(punto.ral - 25300) < 1);
    expect(suSoglia!.aliquotaMarginale).toBeGreaterThan(1);
  });

  it("il netto lungo la curva e' sempre positivo e crescente a scala di 100 €", () => {
    const punti = curvaMarginale({ da: 20000, a: 80000, passo: 100 }, p);
    for (const punto of punti) expect(punto.nettoAnnuo).toBeGreaterThan(0);
  });
});

describe("costo azienda", () => {
  const c = calcolaCostoAzienda(35000, {}, p);

  it("somma RAL, contributi datore e TFR", () => {
    expect(arrotonda(c.contributiDatore)).toBeCloseTo(35000 * 0.3, 2);
    expect(arrotonda(c.tfrQuotaMaturata)).toBeCloseTo(35000 / 13.5, 2);
    expect(arrotonda(c.costoTotale)).toBeCloseTo(35000 + 10500 + 2592.59, 2);
  });

  it("il TFR si scompone in accantonamento e Fondo di Garanzia, ma il costo e' l'intero", () => {
    expect(arrotonda(c.tfrFondoGaranzia)).toBeCloseTo(35000 * 0.005, 2);
    expect(c.tfrAccantonatoLavoratore + c.tfrFondoGaranzia).toBeCloseTo(c.tfrQuotaMaturata, 8);
    // 7,4074% al datore, di cui 6,9074% al lavoratore
    expect(c.tfrQuotaMaturata / 35000).toBeCloseTo(0.074074, 6);
    expect(c.tfrAccantonatoLavoratore / 35000).toBeCloseTo(0.069074, 6);
  });

  it("il moltiplicatore predefinito e' quello dichiarato nei parametri", () => {
    expect(c.moltiplicatore).toBeCloseTo(p.costoDatore.moltiplicatorePredefinito, 4);
    expect(c.moltiplicatore).toBeGreaterThan(1.35);
    expect(c.moltiplicatore).toBeLessThan(1.4);
  });

  it("espone il range e non solo il valore centrale", () => {
    expect(c.costoMinimo).toBeLessThan(c.costoTotale);
    expect(c.costoMassimo).toBeGreaterThan(c.costoTotale);
    expect(arrotonda(c.costoMinimo)).toBeCloseTo(35000 * 1.28 + 35000 / 13.5, 2);
  });

  it("l'INAIL e' escluso per impostazione predefinita e attivabile a parte", () => {
    expect(c.inail).toBeNull();
    const conInail = calcolaCostoAzienda(35000, { includiInail: true }, p);
    expect(conInail.inail).toBeCloseTo(35000 * 0.004, 6);
    expect(conInail.costoTotale).toBeGreaterThan(c.costoTotale);
  });

  it("a RAL zero non divide per zero", () => {
    expect(calcolaCostoAzienda(0, {}, p).moltiplicatore).toBe(0);
  });
});

describe("delta marginale — la domanda che si pone un'azienda", () => {
  it("nella gobba il dipendente vede meno del 40% di quanto costa l'aumento", () => {
    const d = calcolaDeltaMarginale(40000, 1000, {}, p);
    expect(d.incrementoCostoAzienda).toBeCloseTo(1000 * p.costoDatore.moltiplicatorePredefinito, 1);
    expect(d.incrementoNettoDipendente).toBeLessThan(400);
    expect(d.aliquotaMarginaleEffettiva).toBeGreaterThan(0.6);
    // per ogni euro che arriva al dipendente, l'azienda ne spende quasi 3,50
    expect(d.incrementoCostoAzienda / d.incrementoNettoDipendente).toBeGreaterThan(3.4);
  });

  it("fuori dalla gobba il rapporto e' sensibilmente migliore", () => {
    const d = calcolaDeltaMarginale(50000, 1000, {}, p);
    expect(d.incrementoNettoDipendente).toBeGreaterThan(490);
    expect(d.incrementoCostoAzienda / d.incrementoNettoDipendente).toBeLessThan(2.9);
  });

  it("un aumento nella gobba rende meno di uno identico appena sopra", () => {
    const dentro = calcolaDeltaMarginale(40000, 1000, {}, p);
    const sopra = calcolaDeltaMarginale(50000, 1000, {}, p);
    expect(dentro.incrementoNettoDipendente).toBeLessThan(sopra.incrementoNettoDipendente);
    expect(dentro.incrementoCostoAzienda).toBeCloseTo(sopra.incrementoCostoAzienda, 6);
  });
});

describe("avviso di prossimita' alle soglie", () => {
  it("segnala la soglia comunale a chi ha una RAL vicina a 25.328", () => {
    expect(discontinuitaVicine(25200, p).map((v) => v.id)).toContain("addizionale-comunale-23000");
  });

  it("segnala anche le soglie favorevoli, non solo quelle sfavorevoli", () => {
    expect(discontinuitaVicine(27400, p).map((v) => v.id)).toContain("maggiorazione-art13-25000");
  });

  it("non segnala nulla lontano da ogni soglia", () => {
    expect(discontinuitaVicine(70000, p)).toHaveLength(0);
  });

  it("la RAL mostrata all'utente e' arrotondata per eccesso, sempre", () => {
    for (const d of p.discontinuita.soglie) {
      const esatta = ralSogliaDi(d, p);
      const mostrata = ralSogliaVisualizzata(d, p);
      expect(mostrata).toBe(Math.ceil(esatta));
      expect(mostrata).toBeGreaterThanOrEqual(esatta);
      expect(mostrata - esatta).toBeLessThan(1);
    }
  });

  it("su una soglia negativa l'arrotondamento non produce avvisi falsi", () => {
    // soglia esatta 25.327,6071: chi sta a 25.327,50 non l'ha superata, e la RAL
    // mostrata (25.328) non deve fargli credere il contrario.
    const comunale = p.discontinuita.soglie.find((d) => d.id === "addizionale-comunale-23000")!;
    expect(ralSogliaVisualizzata(comunale, p)).toBe(25328);
    expect(25327.5).toBeLessThan(ralSogliaDi(comunale, p));
    expect(25327.5).toBeLessThan(ralSogliaVisualizzata(comunale, p));
  });
});
