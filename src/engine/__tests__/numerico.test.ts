import { describe, expect, it } from "vitest";

import { leggiImporto } from "../formato";

import { calcolaContributi, ralPerImponibileFiscale } from "../contributi";
import {
  applicaScalaProgressiva,
  arrotonda,
  sommaScaglioni,
  troncaA,
  trovaFascia,
  valutaFasciaDetrazione,
} from "../numerico";
import { parametriPerAnno } from "../parametri";

const p = parametriPerAnno();

describe("troncaA — la trappola di floating point", () => {
  /**
   * Questo è il test che ha valore reale. Il coefficiente del caso di
   * riferimento RAL 25.000 vale matematicamente 0,4075 esatto, ma in doppia
   * precisione è 0.40749999999999997. Un troncamento scritto in modo diretto
   * restituisce 0,4074, sbaglia la detrazione di 12 centesimi e sposta il netto
   * da 20.569,65 a 20.569,53.
   */
  it("tronca 0.40749999999999997 a 0,4075 e non a 0,4074", () => {
    const grezzo = (28000 - 22702.5) / 13000;

    // La premessa esatta, che è più sottile di "il valore non è 0,4075":
    // il double PIÙ VICINO a 0,4075 sta leggermente SOTTO 0,4075. La divisione
    // restituisce proprio quel double, quindi `grezzo === 0.4075` è vero, ma
    // moltiplicarlo per 10.000 non dà 4075, dà 4074.9999999999995.
    expect(grezzo).toBe(0.4075);
    expect(grezzo.toPrecision(17)).toBe("0.40749999999999997");
    expect(grezzo * 10000).toBeLessThan(4075);

    expect(troncaA(grezzo, 4)).toBe(0.4075);
  });

  it("l'implementazione ingenua sbaglia: è il motivo per cui la funzione esiste", () => {
    const grezzo = (28000 - 22702.5) / 13000;
    const ingenua = Math.trunc(grezzo * 10000) / 10000;
    expect(ingenua).toBe(0.4074);
    expect(troncaA(grezzo, 4)).not.toBe(ingenua);
  });

  it("normalizzare prima dello scaling non basta", () => {
    const grezzo = (28000 - 22702.5) / 13000;
    const quasi = Math.trunc(Number(grezzo.toFixed(10)) * 10000) / 10000;
    expect(quasi).toBe(0.4074); // ancora sbagliata
    expect(troncaA(grezzo, 4)).toBe(0.4075);
  });

  it("tronca davvero, non arrotonda", () => {
    expect(troncaA(0.82802272, 4)).toBe(0.828);
    expect(troncaA(0.99999, 4)).toBe(0.9999);
    expect(troncaA(0.12349999, 4)).toBe(0.1234);
  });

  it("il coefficiente del caso RAL 35.000 vale 0,8280", () => {
    expect(troncaA((50000 - 31783.5) / 22000, 4)).toBe(0.828);
  });
});

describe("arrotonda — half-up, non banker's rounding", () => {
  it("porta i mezzi lontano dallo zero", () => {
    expect(arrotonda(1.005)).toBe(1.01);
    expect(arrotonda(2.675)).toBe(2.68);
    expect(arrotonda(0.5, 0)).toBe(1);
    expect(arrotonda(1.5, 0)).toBe(2);
    expect(arrotonda(2.5, 0)).toBe(3); // banker's rounding darebbe 2
  });

  it("tratta i negativi in modo simmetrico", () => {
    expect(arrotonda(-1.005)).toBe(-1.01);
    expect(arrotonda(-2.5, 0)).toBe(-3);
  });

  it("riproduce gli importi dei casi di riferimento", () => {
    expect(arrotonda(5221.575)).toBe(5221.58);
    expect(arrotonda(7688.555)).toBe(7688.56);
    expect(arrotonda(454.9762)).toBe(454.98);
  });
});

describe("applicaScalaProgressiva", () => {
  it("scompone l'IRPEF per scaglioni e la somma torna", () => {
    const dettagli = applicaScalaProgressiva(54448.24, p.irpef.scaglioni);
    expect(dettagli).toHaveLength(3);
    expect(dettagli[0]!.imponibileNelloScaglione).toBe(28000);
    expect(dettagli[1]!.imponibileNelloScaglione).toBe(22000);
    expect(arrotonda(dettagli[2]!.imponibileNelloScaglione)).toBe(4448.24);
    expect(arrotonda(sommaScaglioni(dettagli))).toBe(15612.74);
  });

  it("con base sotto il primo scaglione riempie solo quello", () => {
    const dettagli = applicaScalaProgressiva(10000, p.irpef.scaglioni);
    expect(dettagli[0]!.imponibileNelloScaglione).toBe(10000);
    expect(dettagli[1]!.imponibileNelloScaglione).toBe(0);
    expect(arrotonda(sommaScaglioni(dettagli))).toBe(2300);
  });

  it("con base zero non produce imposta", () => {
    expect(sommaScaglioni(applicaScalaProgressiva(0, p.irpef.scaglioni))).toBe(0);
  });

  it("l'addizionale regionale usa la stessa funzione con scaglioni diversi", () => {
    const dettagli = applicaScalaProgressiva(22702.5, p.addizionaleRegionale.scaglioni);
    expect(arrotonda(sommaScaglioni(dettagli))).toBe(306.2);
  });
});

describe("trovaFascia", () => {
  it("il limite appartiene alla fascia che lo nomina", () => {
    const fasce = p.detrazioneLavoroDipendente.fasce;
    expect(trovaFascia(15000, fasce).fino).toBe(15000);
    expect(trovaFascia(15000.01, fasce).fino).toBe(28000);
    expect(trovaFascia(50000, fasce).fino).toBe(50000);
    expect(trovaFascia(50000.01, fasce).fino).toBeNull();
  });

  it("segnala una scala senza fascia di chiusura invece di restituire un valore sbagliato", () => {
    expect(() => trovaFascia(99999, [{ fino: 100 }])).toThrow(/malformata/);
  });
});

describe("valutaFasciaDetrazione — una sola forma per due misure diverse", () => {
  const cifre = p.convenzioniNumeriche.cifreTroncamentoCoefficiente;

  it("fascia senza coefficiente: importo fisso", () => {
    const fascia = p.detrazioneLavoroDipendente.fasce[0]!;
    const esito = valutaFasciaDetrazione(12000, fascia, cifre);
    expect(esito.importo).toBe(1955);
    expect(esito.coefficiente).toBeNull();
  });

  it("fascia 15.000-28.000: base + fattore x coefficiente troncato", () => {
    const fascia = p.detrazioneLavoroDipendente.fasce[1]!;
    const esito = valutaFasciaDetrazione(22702.5, fascia, cifre);
    expect(esito.coefficiente).toBe(0.4075);
    expect(arrotonda(esito.importo)).toBe(2394.93);
  });

  it("fascia 28.000-50.000: il troncamento cambia il risultato di 4 centesimi", () => {
    const fascia = p.detrazioneLavoroDipendente.fasce[2]!;
    const esito = valutaFasciaDetrazione(31783.5, fascia, cifre);
    expect(esito.coefficiente).toBe(0.828);
    expect(arrotonda(esito.importo)).toBe(1581.48);
    // senza troncamento sarebbe stato 1.581,52: è la revisione 2 del dossier
    expect(arrotonda(1910 * ((50000 - 31783.5) / 22000))).toBe(1581.52);
  });

  it("l'ulteriore detrazione cuneo NON tronca: fonte diversa, regola diversa", () => {
    const fascia = p.cuneoFiscale.ulterioreDetrazione.fasce[2]!;
    expect(fascia.coefficiente?.tronca).toBe(false);
    const esito = valutaFasciaDetrazione(35555, fascia, cifre);
    // (40000 - 35555) / 8000 = 0,555625 — con troncamento sarebbe 0,5556
    expect(esito.coefficiente).toBeCloseTo(0.555625, 10);
    expect(esito.importo).toBeCloseTo(555.625, 8);
  });

  it("il coefficiente non scende mai sotto zero", () => {
    const fascia = p.detrazioneLavoroDipendente.fasce[2]!;
    expect(valutaFasciaDetrazione(60000, fascia, cifre).coefficiente).toBe(0);
  });
});

describe("ralPerImponibileFiscale — inversione dei contributi", () => {
  /**
   * Property di round-trip. È il test che ha scoperto un errore di segno nel
   * ramo intermedio dell'inversione: la formula corretta è
   * `(imponibile - b x soglia) / (1 - a - b)` e non `(imponibile + b x soglia)`.
   * Con il segno sbagliato l'inversione era esatta sotto la prima fascia
   * pensionabile e sbagliava di oltre 1.100 € sopra, dove nessuno l'avrebbe
   * notata a occhio.
   */
  it.each([
    0, 1000, 12000, 22702.5, 31783.5, 51057, 51058, 54448.24, 60000, 80000,
    110000, 111095.6, 150000,
  ])("l'andata e ritorno torna esatta per imponibile %s", (imponibile) => {
    const ral = ralPerImponibileFiscale(imponibile, p.contributiLavoratore);
    const ricalcolato = ral - calcolaContributi(ral, p.contributiLavoratore).totale;
    expect(ricalcolato).toBeCloseTo(imponibile, 6);
  });

  it("copre tutti e tre i rami della funzione contributiva", () => {
    const c = p.contributiLavoratore;
    const sotto = ralPerImponibileFiscale(40000, c);
    const mezzo = ralPerImponibileFiscale(55000, c);
    const sopra = ralPerImponibileFiscale(120000, c);

    expect(sotto).toBeLessThan(c.sogliaAliquotaAggiuntiva);
    expect(mezzo).toBeGreaterThan(c.sogliaAliquotaAggiuntiva);
    expect(mezzo).toBeLessThan(c.massimaleAnnuo);
    expect(sopra).toBeGreaterThan(c.massimaleAnnuo);
  });

  it("l'inversione a un solo ramo sbaglia sopra la prima fascia", () => {
    const ingenua = 55000 / (1 - p.contributiLavoratore.aliquotaBase);
    const esatta = ralPerImponibileFiscale(55000, p.contributiLavoratore);
    expect(Math.abs(ingenua - esatta)).toBeGreaterThan(45);
  });
});

/**
 * Il parser dell'input.
 *
 * Presidia due difetti reali della prima versione, che cancellava i caratteri
 * estranei invece di rifiutarli e trattava ogni punto come separatore di
 * migliaia: "abc35000" veniva accettato come 35.000, e "10000.50" diventava
 * 1.000.050, cento volte tanto.
 */
describe("leggiImporto", () => {
  it("legge la convenzione italiana", () => {
    expect(leggiImporto("35.000")).toBe(35000);
    expect(leggiImporto("35000,50")).toBe(35000.5);
    expect(leggiImporto("35.000,50")).toBe(35000.5);
    expect(leggiImporto("1.234.567,89")).toBe(1234567.89);
    expect(leggiImporto("35000")).toBe(35000);
    expect(leggiImporto("0")).toBe(0);
  });

  it("legge anche la convenzione anglosassone quando è inequivocabile", () => {
    // il punto seguito da un numero di cifre diverso da tre è un decimale
    expect(leggiImporto("10000.50")).toBe(10000.5);
    expect(leggiImporto("10.5")).toBe(10.5);
    expect(leggiImporto("0.5")).toBe(0.5);
    expect(leggiImporto("1.2345")).toBe(1.2345);
    // con entrambi i separatori vince l'ultimo come decimale
    expect(leggiImporto("1,234,567.89")).toBe(1234567.89);
  });

  it("rifiuta invece di ripulire: nessun carattere estraneo passa", () => {
    for (const t of ["abc35000", "35000abc", "3e5", "35_000", "trentacinquemila", "35000$", "1/2"]) {
      expect(leggiImporto(t), t).toBeNaN();
    }
  });

  it("tollera solo il rumore che è davvero rumore", () => {
    expect(leggiImporto("35 000")).toBe(35000);
    expect(leggiImporto("€ 35.000")).toBe(35000);
    expect(leggiImporto("\u00A035.000\u00A0")).toBe(35000);
  });

  it("rifiuta i raggruppamenti malformati", () => {
    for (const t of ["12.34.56", "1.23.456", "1234.56.789"]) {
      expect(leggiImporto(t), t).toBeNaN();
    }
  });

  it("rifiuta il vuoto e i separatori isolati", () => {
    for (const t of ["", "   ", ",", ".", ",,", "--5", "-", "+"]) {
      expect(leggiImporto(t), t).toBeNaN();
    }
  });

  it("il segno negativo si legge, così la validazione lo può rifiutare come tale", () => {
    expect(leggiImporto("-5000")).toBe(-5000);
    expect(leggiImporto("+5000")).toBe(5000);
  });
});
