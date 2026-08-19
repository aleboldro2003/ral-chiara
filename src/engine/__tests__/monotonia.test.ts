/**
 * La property piu' importante del motore: al crescere della RAL il netto cresce.
 *
 * La property e' FALSA come enunciato assoluto, ed e' corretto che lo sia: il
 * sistema fiscale italiano ha soglie a gradino in cui il beneficio non si riduce
 * gradualmente ma sparisce. Il test quindi non allenta la property con una
 * tolleranza generosa — nasconderebbe l'informazione piu' interessante del
 * modello — ma la enuncia come MONOTONIA A TRATTI:
 *
 *   il netto cresce ovunque, TRANNE nelle quattro soglie dichiarate, dove il
 *   salto deve essere esattamente quello previsto dalla norma.
 *
 * Se un giorno una di queste asserzioni cade, non e' il test da aggiustare: o e'
 * cambiata la norma, o e' rotto il motore.
 *
 * Due tipi di soglia, con meccanismi giuridici diversi:
 *   - REDDITUALI: superata una soglia di reddito il beneficio cessa
 *     (esenzione comunale, maggiorazione 65 €, fasce della somma esente)
 *   - DI CAPIENZA: quando l'IRPEF netta diventa positiva, le addizionali
 *     diventano dovute sull'intero imponibile
 *     (art. 50 D.Lgs. 446/1997 e art. 1 D.Lgs. 360/1998)
 */

import { describe, expect, it } from "vitest";

import { nettoAnnuo } from "../calcola";
import { calcolaContributi } from "../contributi";
import { misuraDiscontinuita } from "../marginale";
import { arrotonda } from "../numerico";
import { parametriPerAnno } from "../parametri";
import { ralPerImponibile, ralSogliaDi, sogliaImponibileDi } from "../soglie";

const p = parametriPerAnno();
const netto = (ral: number) => nettoAnnuo(ral, p);
const SOGLIE = p.discontinuita.soglie;
const TOLLERANZA = p.discontinuita.tolleranzaScalinata;

/**
 * Le RAL esatte delle soglie, derivate dall'imponibile normativo. Il file dei
 * parametri non memorizza piu' la RAL: memorizzarla arrotondata accanto a valori
 * autorevoli era una mina, ed era gia' esplosa una volta.
 */
const RAL_SOGLIE = SOGLIE.map((s) => ralSogliaDi(s, p));

/** Solo le soglie che fanno SCENDERE il netto rompono la monotonia. */
const RAL_SOGLIE_NEGATIVE = SOGLIE.filter((s) => s.saltoNormativo < 0).map((s) =>
  ralSogliaDi(s, p),
);

/** Vero se l'intervallo (a, b] contiene una soglia che fa scendere il netto. */
function attraversaSogliaNegativa(a: number, b: number): boolean {
  return RAL_SOGLIE_NEGATIVE.some((s) => s > a - 1e-9 && s <= b + 1e-9);
}

/** Vero se l'intervallo (a, b] contiene una soglia qualsiasi. */
function attraversaSoglia(a: number, b: number): boolean {
  return RAL_SOGLIE.some((s) => s > a - 1e-9 && s <= b + 1e-9);
}

describe("dove cadono le soglie", () => {
  it("sono sette: quattro fanno scendere il netto, tre lo fanno salire", () => {
    expect(SOGLIE).toHaveLength(7);
    expect(SOGLIE.filter((s) => s.saltoNormativo < 0)).toHaveLength(4);
    expect(SOGLIE.filter((s) => s.saltoNormativo > 0)).toHaveLength(3);
  });

  it("stanno tutte in un solo array: il segno del salto e' l'unica differenza", () => {
    // separarle in due array codificherebbe nei dati una distinzione che nella
    // norma non esiste, ed e' una preoccupazione della sola interfaccia
    expect(Object.keys(p.discontinuita)).not.toContain("soglieFavorevoli");
    for (const s of SOGLIE) expect(s.saltoNormativo).not.toBe(0);
  });

  it("nessuna memorizza la RAL: si deriva dall'imponibile", () => {
    for (const s of SOGLIE) expect(s).not.toHaveProperty("ralSoglia");
  });

  it.each(SOGLIE)("$id: i componenti sommano al salto normativo", (d) => {
    const somma = d.componenti.reduce((t, c) => t + c.importo, 0);
    expect(arrotonda(somma)).toBeCloseTo(d.saltoNormativo, 2);
  });

  it("la soglia di capienza del trattamento integrativo e' derivata, non memorizzata", () => {
    const ti = SOGLIE.find((s) => s.id === "trattamento-integrativo-capienza")!;
    expect(ti.sogliaImponibile).toBeNull();
    expect(ti.sogliaDerivata?.tipo).toBe("capienzaTrattamentoIntegrativo");
    // (1.955 - 75) / 0,23 = 8.173,91: l'incrocio di tre parametri diversi
    expect(sogliaImponibileDi(ti, p)).toBeCloseTo(8173.913, 3);
  });

  it("la RAL di soglia e' un'inversione a tratti, non una divisione per 0,9081", () => {
    for (const d of SOGLIE) {
      const imponibile = sogliaImponibileDi(d, p);
      const ral = ralPerImponibile(imponibile, p);
      const ricalcolato = ral - calcolaContributi(ral, p.contributiLavoratore).totale;
      expect(ricalcolato).toBeCloseTo(imponibile, 6);
    }
  });
});

describe("ampiezza dei gradini — tutte e sette, favorevoli comprese", () => {
  /**
   * La seconda meta' della property, e quella che copre il buco: i tre salti
   * verso l'alto non violano la monotonia, quindi il test di monotonia non li
   * guarda. Senza questa asserzione, se domani qualcuno toccasse la formula
   * dell'art. 13 e il gradino a imponibile 15.000 passasse da +1.145 a +1.100,
   * nessun test protesterebbe: il netto continuerebbe a salire e i tre casi di
   * riferimento stanno tutti sopra quella soglia.
   */
  const misurate = misuraDiscontinuita(p);

  it("sono misurate tutte e sette", () => {
    expect(misurate).toHaveLength(7);
  });

  it.each(misurate)("$id: salto atteso $saltoNormativo €", (d) => {
    expect(Math.sign(d.saltoMisurato)).toBe(Math.sign(d.saltoNormativo));
    expect(Math.abs(d.saltoMisurato - d.saltoNormativo)).toBeLessThanOrEqual(TOLLERANZA);
  });

  it("attraversando una soglia negativa il netto scende", () => {
    for (const d of misurate.filter((x) => x.saltoNormativo < 0)) {
      expect(netto(d.ralEsatta + 0.01)).toBeLessThan(netto(d.ralEsatta - 0.01));
    }
  });

  it("attraversando una soglia positiva il netto sale piu' del normale", () => {
    for (const d of misurate.filter((x) => x.saltoNormativo > 0)) {
      const salto = netto(d.ralEsatta + 0.01) - netto(d.ralEsatta - 0.01);
      // due centesimi di RAL portano al massimo un centesimo di netto: qualunque
      // cosa di piu' e' il gradino
      expect(salto).toBeGreaterThan(1);
    }
  });
});

describe("monotonia a tratti sull'intero dominio", () => {
  /**
   * Passo di 1 euro su 5.000-130.000: 125.000 valutazioni. Il passo fine serve
   * perche' i gradini piu' piccoli sarebbero invisibili con un campionamento
   * grossolano.
   */
  it("il netto cresce ovunque tranne nelle soglie dichiarate", () => {
    const violazioni: { da: number; a: number; delta: number }[] = [];
    let precedente = netto(5000);

    for (let ral = 5001; ral <= 130000; ral += 1) {
      const corrente = netto(ral);
      const delta = corrente - precedente;
      if (delta < -TOLLERANZA && !attraversaSogliaNegativa(ral - 1, ral)) {
        violazioni.push({ da: ral - 1, a: ral, delta: arrotonda(delta) });
      }
      precedente = corrente;
    }

    expect(violazioni.slice(0, 10)).toEqual([]);
  });

  it("su scala grossolana, lontano dalle soglie, la crescita e' netta", () => {
    for (let ral = 20000; ral <= 120000; ral += 1000) {
      if (attraversaSogliaNegativa(ral, ral + 1000)) continue;
      expect(netto(ral + 1000)).toBeGreaterThan(netto(ral) + 300);
    }
  });
});

describe("la scalinata introdotta dal troncamento", () => {
  /**
   * Effetto collaterale della regola dell'Agenzia: il coefficiente scende a
   * scatti di 0,0001, quindi la detrazione scende a scatti di 0,119 € nella
   * fascia 15.000-28.000 e di 0,191 € in quella 28.000-50.000. Il netto non e'
   * strettamente crescente nemmeno lontano dalle soglie.
   *
   * Non e' un bug ed e' fissato qui invece che nascosto sotto una tolleranza:
   * se l'ampiezza cambia, qualcuno ha toccato la regola di troncamento.
   */
  it("esiste, e non supera mai il gradino teorico dichiarato", () => {
    const teorico = p.scalinataTroncamento.gradinoTeoricoMassimo;
    let gradinoMassimo = 0;
    let dove = 0;
    // Finestra di 500 € dentro la fascia 28.000-50.000 di imponibile, dove il
    // fattore e' 1.910. La scalinata si ripete ogni ~1,43 € di RAL, quindi la
    // finestra ne contiene circa 350: abbastanza per trovarne il massimo senza
    // scandire 4 milioni di punti.
    let precedente = netto(39000);

    for (let ral = 39000.01; ral <= 39500; ral = arrotonda(ral + 0.01)) {
      const corrente = netto(ral);
      const delta = precedente - corrente;
      if (delta > gradinoMassimo && !attraversaSoglia(ral - 0.01, ral)) {
        gradinoMassimo = delta;
        dove = ral;
      }
      precedente = corrente;
    }

    // la scalinata c'e' davvero, ed e' dell'ordine di grandezza previsto
    expect(gradinoMassimo).toBeGreaterThan(teorico * 0.9);
    expect(gradinoMassimo).toBeLessThanOrEqual(teorico);
    // e cade nella fascia 28.000-50.000 di imponibile, dove il fattore e' 1.910
    expect(dove).toBeGreaterThan(30834);
    expect(dove).toBeLessThan(55060);
    // la tolleranza usata dagli altri test la copre
    expect(gradinoMassimo).toBeLessThanOrEqual(TOLLERANZA);
  });

  it("l'ampiezza del gradino e' fattore x 0,0001", () => {
    const cifre = p.convenzioniNumeriche.cifreTroncamentoCoefficiente;
    const passo = 10 ** -cifre;
    expect(1190 * passo).toBeCloseTo(0.119, 6);
    expect(1910 * passo).toBeCloseTo(0.191, 6);
    expect(p.scalinataTroncamento.gradinoTeoricoMassimo).toBeCloseTo(1910 * passo, 6);

    // l'ulteriore detrazione cuneo non contribuisce: il suo coefficiente non e'
    // troncato. Se un giorno lo diventasse, il gradino salirebbe a 0,291.
    expect(p.cuneoFiscale.ulterioreDetrazione.fasce[2]!.coefficiente!.tronca).toBe(false);
    expect(1910 * passo + 1000 * passo).toBeCloseTo(0.291, 6);
  });
});

describe("proprieta' strutturali che devono valere ovunque", () => {
  const campione = [0, 500, 5000, 9000, 15000, 22000, 28000, 35000, 45000, 60000, 90000, 130000, 250000];

  it("il netto non supera mai la RAL, tranne dove le somme esenti lo consentono", () => {
    for (const ral of campione) {
      const n = netto(ral);
      expect(n).toBeGreaterThanOrEqual(0);
      // sopra i 20.000 di imponibile non ci sono somme esenti: il netto e' sempre < RAL
      if (ral > 25000) expect(n).toBeLessThan(ral);
    }
  });

  it("l'aliquota media effettiva cresce con la RAL, sopra le soglie del cuneo", () => {
    let precedente = -1;
    for (const ral of [30000, 40000, 50000, 60000, 80000, 120000]) {
      const media = (ral - netto(ral)) / ral;
      expect(media).toBeGreaterThan(precedente);
      precedente = media;
    }
  });

  it("fuori dalle soglie l'aliquota marginale non supera mai il 100%", () => {
    for (let ral = 5000; ral <= 130000; ral += 250) {
      if (attraversaSoglia(ral, ral + 250)) continue;
      expect(1 - (netto(ral + 250) - netto(ral)) / 250).toBeLessThan(1);
    }
  });

  it("SULLE soglie invece lo supera, ed e' esattamente il punto", () => {
    // una finestra da 250 € che contiene il gradino da 184 € dell'addizionale
    // comunale produce una marginale oltre il 100%: per quel tratto di reddito
    // un aumento lordo si traduce in una perdita netta.
    const soglia = ralSogliaDi(SOGLIE.find((d) => d.id === "addizionale-comunale-23000")!, p);
    const marginale = 1 - (netto(soglia + 125) - netto(soglia - 125)) / 250;
    expect(marginale).toBeGreaterThan(1);
  });
});
