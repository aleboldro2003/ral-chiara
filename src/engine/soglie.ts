/**
 * Le soglie a gradino del modello: dove stanno, quanto valgono, quali sono
 * vicine a una certa RAL.
 *
 * Vive in un modulo proprio perché sia l'orchestratore sia la curva marginale
 * ne hanno bisogno, e farlo dipendere da uno dei due creerebbe un ciclo.
 *
 * Il file dei parametri memorizza le soglie in IMPONIBILE, che è la grandezza
 * che la norma definisce davvero. La RAL corrispondente non è memorizzata: si
 * ricava qui. Un valore arrotondato che vivesse accanto a quelli autorevoli
 * senza poter essere usato per calcolare non sarebbe documentazione, sarebbe una
 * mina — e in questo progetto ne è già esplosa una, quando 23.000/0,9081 =
 * 25.327,6071 arrotondato a 25.327,61 finiva dall'altra parte della soglia e
 * faceva misurare un salto di segno opposto.
 */

import { ralPerImponibileFiscale } from "./contributi";
import type { Discontinuita, Euro, ParametriAnno } from "./tipi";

/**
 * Imponibile a cui cade la soglia.
 *
 * Sei soglie su sette portano una cifra scritta nella norma (8.500, 15.000,
 * 20.000, 23.000, 25.000, 35.000). La settima no: l'attivazione del trattamento
 * integrativo cade dove l'imposta lorda eguaglia la detrazione art. 13 al netto
 * della franchigia, cioè all'incrocio di tre parametri diversi. Memorizzarne il
 * valore (8.173,91) accanto a quelli autorevoli lo renderebbe silenziosamente
 * sbagliato al primo cambio di aliquota o di detrazione, quindi si deriva.
 */
export function sogliaImponibileDi(d: Discontinuita, p: ParametriAnno): Euro {
  if (d.sogliaImponibile !== null) return d.sogliaImponibile;

  const derivata = d.sogliaDerivata;
  if (!derivata) {
    throw new Error(
      `La soglia "${d.id}" non dichiara né un imponibile né una regola di derivazione.`,
    );
  }

  switch (derivata.tipo) {
    case "capienzaTrattamentoIntegrativo": {
      const primaFascia = p.detrazioneLavoroDipendente.fasce[0];
      const primoScaglione = p.irpef.scaglioni[0];
      if (!primaFascia || !primoScaglione) {
        throw new Error("Parametri incompleti: manca la prima fascia o il primo scaglione.");
      }
      return (
        (primaFascia.base - p.trattamentoIntegrativo.franchigiaCapienza) / primoScaglione.aliquota
      );
    }
  }
}

/**
 * RAL esatta a cui l'imponibile raggiunge la soglia.
 *
 * Non è una divisione per 0,9081: sopra la prima fascia pensionabile l'aliquota
 * contributiva marginale cambia, e sopra il massimale si azzera, quindi
 * l'inversione è definita a tratti. Nessuna delle sette soglie attuali arriva
 * così in alto, ma il calcolo inverso dal netto alla RAL — che è in roadmap —
 * userà davvero quei rami.
 */
export function ralPerImponibile(imponibile: Euro, p: ParametriAnno): Euro {
  return ralPerImponibileFiscale(imponibile, p.contributiLavoratore);
}

/** RAL esatta della soglia, in piena precisione. È quella su cui si calcola. */
export function ralSogliaDi(d: Discontinuita, p: ParametriAnno): Euro {
  return ralPerImponibile(sogliaImponibileDi(d, p), p);
}

/**
 * RAL della soglia arrotondata **per eccesso**, da mostrare all'utente.
 *
 * L'arrotondamento è sempre verso l'alto, in entrambe le direzioni del salto,
 * ed è la scelta conservativa in tutti e due i casi:
 *
 *  - su una soglia negativa, arrotondare per difetto farebbe scattare l'avviso
 *    "il netto scende" anche a chi la soglia non l'ha ancora raggiunta. Un avviso
 *    falso costa più di un avviso mancato entro l'euro.
 *  - su una soglia positiva, arrotondare per difetto prometterebbe un beneficio
 *    a chi non ne ha ancora diritto.
 *
 * In entrambi i casi resta una finestra cieca larga meno di un euro. È un prezzo
 * accettabile: il calcolo del netto non passa mai di qui, questo valore è solo
 * l'etichetta.
 */
export function ralSogliaVisualizzata(d: Discontinuita, p: ParametriAnno): Euro {
  return Math.ceil(ralSogliaDi(d, p));
}

/**
 * Soglie entro la distanza di avviso dalla RAL richiesta.
 *
 * Serve alla UI per segnalare che si sta per attraversare un gradino: nessun
 * altro calcolatore lo fa. Il tono del messaggio resta descrittivo — dove sta la
 * soglia e cosa succede attraversandola — e non diventa un consiglio su quanto
 * converrebbe chiedere.
 */
export function discontinuitaVicine(ral: Euro, p: ParametriAnno): Discontinuita[] {
  return p.discontinuita.soglie.filter(
    (d) => Math.abs(ral - ralSogliaDi(d, p)) <= p.discontinuita.distanzaAvviso,
  );
}
