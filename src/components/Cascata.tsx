"use client";

import { euro } from "@/engine/formato";
import type { RisultatoCalcolo, VoceCascata } from "@/engine/tipi";

import { CONTENITORE } from "./Cornice";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/**
 * La scomposizione a cascata. Ogni voce è un passaggio della catena e si apre
 * sulla formula applicata con i numeri sostituiti e sulla fonte normativa —
 * entrambe arrivano dal motore, che a sua volta le prende dai parametri: la UI
 * non riscrive mai una fonte a mano.
 */
function aspetto(v: VoceCascata) {
  const totale = v.segno === "totale";
  const nullo = v.importo === 0 && !totale;
  const segno = v.segno === "sottraendo" ? "− " : v.segno === "addendo" ? "+ " : "";

  return {
    totale,
    importo: (v.importo === 0 ? "" : segno) + euro(v.importo) + " €",
    padding: totale ? "20px" : "15px",
    punto: totale ? "#9C7A45" : nullo ? "#DCD5C9" : "#C4BCAE",
    peso: totale ? 500 : 400,
    dimEtichetta: totale ? "15.5px" : "14px",
    dimValore: totale ? "18px" : "14.5px",
    coloreEtichetta: totale ? "#14120F" : nullo ? "#B5AEA2" : "#4A443C",
    coloreValore: totale ? "#14120F" : nullo ? "#B5AEA2" : "#14120F",
  };
}

export function Cascata({ risultato }: { risultato: RisultatoCalcolo }) {
  return (
    <section style={{ ...CONTENITORE, padding: "48px var(--gutter) 0" }} aria-labelledby="titolo-cascata">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          paddingBottom: 16,
          borderBottom: "1px solid #DCD5C9",
        }}
      >
        <h2
          id="titolo-cascata"
          style={{ margin: 0, fontFamily: SERIF, fontSize: 31, fontWeight: 400, letterSpacing: "-.01em" }}
        >
          Come si arriva al netto
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "#8B8378" }}>
          Ogni voce si apre sulla formula applicata e sulla fonte normativa
        </p>
      </div>

      <div
        style={{
          background: "#FFFDFA",
          border: "1px solid #E4DFD6",
          borderTop: 0,
          borderRadius: "0 0 3px 3px",
        }}
      >
        {risultato.cascata.map((v) => {
          const a = aspetto(v);
          return (
            <details key={v.id} style={{ borderTop: "1px solid #EFEBE3" }}>
              <summary
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 18,
                  padding: `${a.padding} 26px`,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ width: 6, height: 6, borderRadius: "50%", flex: "none", background: a.punto }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: a.dimEtichetta,
                    fontWeight: a.peso,
                    color: a.coloreEtichetta,
                  }}
                >
                  {v.etichetta}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: a.dimValore,
                    fontWeight: a.peso,
                    fontVariantNumeric: "tabular-nums",
                    color: a.coloreValore,
                  }}
                >
                  {a.importo}
                </span>
                <span
                  className="marcatore"
                  aria-hidden="true"
                  style={{ width: 14, textAlign: "right", fontSize: 11, color: "#B5AEA2" }}
                />
              </summary>
              <div style={{ padding: "0 26px 22px 50px", display: "grid", gap: 9 }}>
                <p
                  style={{
                    margin: 0,
                    fontFamily: MONO,
                    fontSize: "12.5px",
                    lineHeight: 1.7,
                    color: "#4A443C",
                    background: "#F6F3EE",
                    borderRadius: 2,
                    padding: "11px 14px",
                  }}
                >
                  {v.formula}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "11.5px",
                    lineHeight: 1.65,
                    color: "#8B8378",
                    maxWidth: "90ch",
                  }}
                >
                  {v.url ? (
                    <a href={v.url} target="_blank" rel="noopener noreferrer">
                      {v.fonte}
                    </a>
                  ) : (
                    v.fonte
                  )}
                </p>
              </div>
            </details>
          );
        })}
      </div>

      <p
        style={{
          margin: "14px 0 0",
          fontSize: 12,
          lineHeight: 1.7,
          color: "#8B8378",
          maxWidth: "85ch",
        }}
      >
        I contributi sono oneri deducibili e riducono la base imponibile; le detrazioni sono sconti
        d&apos;imposta e riducono l&apos;imposta già calcolata. Le detrazioni non generano credito
        rimborsabile: l&apos;imposta si azzera e basta.
      </p>
    </section>
  );
}
