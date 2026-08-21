/**
 * La curva dell'aliquota marginale e la vista costo azienda.
 *
 * I valori attesi sono quelli della §4 del dossier, rev. 2, che a loro volta
 * vengono da questo motore: il test verifica che la gobba ci sia e stia dove
 * deve stare, non che una tabella scritta a mano torni.
 */

import { describe, expect, it } from "vitest";

import { calcolaCostoAzienda, calcolaDeltaMarginale, composizioneCosto } from "../costoAzienda";
import { aliquotaMarginale, curvaMarginale } from "../marginale";
import { arrotonda } from "../numerico";
import { parametriPerAnno } from "../parametri";
import { discontinuitaVicine, ralSogliaDi, ralSogliaVisualizzata } from "../soglie";

const p = parametriPerAnno();
const marginale = (ral: number) => aliquotaMarginale(ral, 100, p);

describe("la curva dell'aliquota marginale non è monotona", () => {
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
    // la marginale schizza oltre il 200%. Il massimo che interessa è quello del
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

  it("il netto lungo la curva è sempre positivo e crescente a scala di 100 €", () => {
    const punti = curvaMarginale({ da: 20000, a: 80000, passo: 100 }, p);
    for (const punto of punti) expect(punto.nettoAnnuo).toBeGreaterThan(0);
  });
});

describe("costo azienda", () => {
  const c = calcolaCostoAzienda(35000, {}, p);

  it("somma RAL, contributi datore e quota TFR netta", () => {
    expect(arrotonda(c.contributiDatore)).toBeCloseTo(35000 * 0.3, 2);
    expect(arrotonda(c.tfrQuotaLorda)).toBeCloseTo(35000 / 13.5, 2);
    // 35.000 + 10.500 + 2.417,59 (quota netta, non 2.592,59 lorda)
    expect(arrotonda(c.costoTotale)).toBeCloseTo(35000 + 10500 + 2417.59, 2);
  });

  /**
   * La regressione che questo blocco presidia: lo 0,50% dell'art. 3 ultimo comma
   * L. 297/1982 è una maggiorazione dell'aliquota IVS, quindi è già dentro il 30%
   * dei contributi datore. Sommare la quota TFR lorda lo conterebbe due volte.
   * Il Fondo di Garanzia dell'art. 2 c. 8 è tutt'altra voce e vale lo 0,20%.
   */
  it("non conta due volte lo 0,50%: il costo usa la quota TFR netta", () => {
    expect(c.tfrContributoAggiuntivoIvs).toBeCloseTo(35000 * 0.005, 6);
    expect(c.tfrQuotaNetta).toBeCloseTo(c.tfrQuotaLorda - c.tfrContributoAggiuntivoIvs, 8);

    expect(c.tfrQuotaLorda / 35000).toBeCloseTo(0.074074, 6);
    expect(c.tfrQuotaNetta / 35000).toBeCloseTo(0.069074, 6);

    // il costo totale contiene la netta, non la lorda
    expect(c.costoTotale).toBeCloseTo(35000 + c.contributiDatore + c.tfrQuotaNetta, 8);
    expect(c.costoTotale).toBeLessThan(35000 + c.contributiDatore + c.tfrQuotaLorda);
  });

  it("il Fondo di Garanzia è lo 0,20%, voce distinta dallo 0,50% dell'IVS", () => {
    expect(c.tfrFondoGaranzia).toBeCloseTo(35000 * 0.002, 6);
    expect(p.costoDatore.tfr.contributoFondoGaranzia).toBe(0.002);
    expect(p.costoDatore.tfr.contributoAggiuntivoIvs).toBe(0.005);
    expect(p.costoDatore.tfr.contributoFondoGaranzia).not.toBe(
      p.costoDatore.tfr.contributoAggiuntivoIvs,
    );
    // il Fondo di Garanzia non entra come addendo autonomo nel costo totale
    expect(c.costoTotale).not.toBeCloseTo(
      35000 + c.contributiDatore + c.tfrQuotaNetta + c.tfrFondoGaranzia,
      2,
    );
  });

  it("il moltiplicatore predefinito è 1,369 e coincide con i parametri", () => {
    expect(c.moltiplicatore).toBeCloseTo(p.costoDatore.moltiplicatorePredefinito, 4);
    expect(c.moltiplicatore).toBeCloseTo(1.369, 3);
    expect(arrotonda(c.moltiplicatore, 3)).toBe(1.369);
    // 36,91% in più della RAL
    expect(c.costoTotale / 35000 - 1).toBeCloseTo(0.369074, 6);
    expect(c.moltiplicatore).toBeGreaterThan(1.35);
    expect(c.moltiplicatore).toBeLessThan(1.4);
  });

  it("espone il range e non solo il valore centrale", () => {
    expect(c.costoMinimo).toBeLessThan(c.costoTotale);
    expect(c.costoMassimo).toBeGreaterThan(c.costoTotale);
    expect(arrotonda(c.costoMinimo)).toBeCloseTo(35000 * 1.28 + c.tfrQuotaNetta, 2);
  });

  it("l'INAIL è escluso per impostazione predefinita e attivabile a parte", () => {
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

  it("fuori dalla gobba il rapporto è sensibilmente migliore", () => {
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

describe("avviso di prossimità alle soglie", () => {
  it("segnala la soglia comunale a chi ha una RAL vicina a 25.328", () => {
    expect(discontinuitaVicine(25200, p).map((v) => v.id)).toContain("addizionale-comunale-23000");
  });

  it("segnala anche le soglie favorevoli, non solo quelle sfavorevoli", () => {
    expect(discontinuitaVicine(27400, p).map((v) => v.id)).toContain("maggiorazione-art13-25000");
  });

  it("non segnala nulla lontano da ogni soglia", () => {
    expect(discontinuitaVicine(70000, p)).toHaveLength(0);
  });

  it("la RAL mostrata all'utente è arrotondata per eccesso, sempre", () => {
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

/**
 * La composizione del costo aziendale, cioè i dati del donut.
 *
 * Vive nel motore proprio per essere verificabile qui: il componente grafico
 * riceve quote e importi già fatti e ci mette soltanto colore e geometria,
 * senza ricalcolare una sola regola contributiva.
 */
describe("composizione del costo aziendale", () => {
  const campione = [8000, 18387, 25000, 35000, 60000, 122295, 140000];

  it("senza INAIL produce esattamente tre segmenti", () => {
    for (const ral of campione) {
      const voci = composizioneCosto(calcolaCostoAzienda(ral, { includiInail: false }, p));
      expect(voci.length, `RAL ${ral}`).toBe(3);
      expect(voci.map((v) => v.id)).toEqual(["ral", "contributiDatore", "tfr"]);
    }
  });

  it("con INAIL produce esattamente quattro segmenti", () => {
    for (const ral of campione) {
      const voci = composizioneCosto(calcolaCostoAzienda(ral, { includiInail: true }, p));
      expect(voci.length, `RAL ${ral}`).toBe(4);
      expect(voci.map((v) => v.id)).toEqual(["ral", "contributiDatore", "tfr", "inail"]);
    }
  });

  it("il segmento INAIL non esiste quando l'opzione è disattivata", () => {
    const voci = composizioneCosto(calcolaCostoAzienda(35000, { includiInail: false }, p));
    expect(voci.some((v) => v.id === "inail")).toBe(false);
    expect(voci.some((v) => /INAIL/i.test(v.etichetta))).toBe(false);
  });

  it("le percentuali mostrate sommano sempre a 100,0%", () => {
    for (const ral of campione) {
      for (const includiInail of [false, true]) {
        const voci = composizioneCosto(calcolaCostoAzienda(ral, { includiInail }, p));
        // somma al decimo di punto, cioè la precisione con cui la legenda le stampa
        const somma = voci.reduce((a, v) => a + Math.round(v.quota * 1000), 0);
        expect(somma, `RAL ${ral} inail=${includiInail}`).toBe(1000);
      }
    }
  });

  it("gli importi dei segmenti quadrano con il costo aziendale mostrato", () => {
    for (const ral of campione) {
      for (const includiInail of [false, true]) {
        const costo = calcolaCostoAzienda(ral, { includiInail }, p);
        const voci = composizioneCosto(costo);
        const somma = arrotonda(voci.reduce((a, v) => a + v.importo, 0));
        expect(somma, `RAL ${ral} inail=${includiInail}`).toBe(costo.mostrati.costoTotale);
      }
    }
  });

  it("a costo totale nullo restituisce un elenco vuoto invece di dividere per zero", () => {
    for (const ral of [0, -1000]) {
      const voci = composizioneCosto(calcolaCostoAzienda(ral, { includiInail: true }, p));
      expect(voci, `RAL ${ral}`).toEqual([]);
    }
  });

  it("nessuna quota è NaN o fuori dall'intervallo", () => {
    for (const ral of campione) {
      for (const voce of composizioneCosto(calcolaCostoAzienda(ral, { includiInail: true }, p))) {
        expect(Number.isFinite(voce.quota)).toBe(true);
        expect(voce.quota).toBeGreaterThan(0);
        expect(voce.quota).toBeLessThanOrEqual(1);
        expect(Number.isFinite(voce.importo)).toBe(true);
      }
    }
  });

  /**
   * "TFR netto" da solo si legge come importo netto che arriva al dipendente,
   * che è il contrario di quello che la voce misura: è la quota che l'azienda
   * accantona. L'etichetta lo dice, e la descrizione estesa spiega perché non
   * coincide con la quota lorda dell'art. 2120 c.c.
   */
  it("la voce TFR è etichettata come quota a carico dell'azienda", () => {
    const voci = composizioneCosto(calcolaCostoAzienda(35000, {}, p));
    const tfr = voci.find((v) => v.id === "tfr");
    expect(tfr?.etichetta).toBe("TFR — quota azienda");
    expect(tfr?.etichetta).not.toMatch(/netto|netta/i);
    expect(tfr?.descrizione).toBe(
      "Quota TFR maturata al netto dello 0,50% già incluso nei contributi del datore di lavoro.",
    );
  });

  it("ogni voce porta una descrizione estesa non vuota", () => {
    for (const voce of composizioneCosto(calcolaCostoAzienda(35000, { includiInail: true }, p))) {
      expect(voce.descrizione.length).toBeGreaterThan(20);
      expect(voce.etichetta.length).toBeGreaterThan(0);
    }
  });
});
