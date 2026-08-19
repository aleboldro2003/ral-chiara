"use client";

import { useMemo, useState } from "react";

import { calcola } from "@/engine/calcola";
import { euro, intero, percentuale } from "@/engine/formato";
import { parametriPerAnno } from "@/engine/parametri";
import { ralSogliaVisualizzata } from "@/engine/soglie";

import { Cascata } from "./Cascata";
import { CONTENITORE, etichettaStile } from "./Cornice";
import { CostoAzienda } from "./CostoAzienda";
import { CurvaMarginale } from "./CurvaMarginale";

const p = parametriPerAnno();

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

const SLIDER_MIN = 8000;
const SLIDER_MAX = 140000;

/** Accetta "35.000", "35000", "35000,50". Restituisce NaN se non è un numero. */
function leggiRal(testo: string): number {
  const pulito = String(testo)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();
  if (pulito === "") return Number.NaN;
  const n = Number(pulito);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function Calcolatore() {
  const [testoRal, setTestoRal] = useState(() => intero(35000));
  const [mensilita, setMensilita] = useState(p.mensilita.predefinita);

  const ralGrezza = useMemo(() => leggiRal(testoRal), [testoRal]);
  const valida = Number.isFinite(ralGrezza) && ralGrezza >= 0;
  const ral = valida ? ralGrezza : 0;

  const r = useMemo(
    () => calcola({ ral, mensilita, giorniLavorati: p.profiloStandard.giorniLavorati }, p),
    [ral, mensilita],
  );

  /** Ripartizione della RAL più le somme esenti, che non sono parte del lordo. */
  const barra = useMemo(() => {
    const addizionali = r.addizionaleRegionale.importo + r.addizionaleComunale.importo;
    const bonus =
      r.agevolazioni.sommaEsente.importo + r.agevolazioni.trattamentoIntegrativo.importo;
    const totale = Math.max(1, ral + bonus);
    return [
      { etichetta: "Netto", v: r.nettoAnnuo - bonus, colore: "#C8A15A" },
      { etichetta: "Contributi INPS", v: r.contributi.totale, colore: "#5C7C93" },
      { etichetta: "IRPEF netta", v: r.irpef.netta, colore: "#1F4B6E" },
      { etichetta: "Addizionali", v: addizionali, colore: "#A03A22" },
      { etichetta: "Somme esenti", v: bonus, colore: "#2C6E3F" },
    ]
      .filter((b) => b.v > 0.5)
      .map((b) => ({
        etichetta: b.etichetta,
        colore: b.colore,
        w: `${((b.v / totale) * 100).toFixed(2)}%`,
        valore: `${euro(b.v)} €`,
      }));
  }, [r, ral]);

  return (
    <>
      <section style={{ background: "#14120F", color: "#F6F3EE" }}>
        <div
          style={{
            ...CONTENITORE,
            padding: "52px var(--gutter) 56px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(340px,100%),1fr))",
            gap: "clamp(32px,4vw,64px)",
            alignItems: "start",
          }}
        >
          <div>
            <label htmlFor="ral" style={{ ...etichettaStile("#A39B8E"), display: "block", marginBottom: 22 }}>
              Retribuzione annua lorda
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 14,
                borderBottom: "1px solid rgba(200,161,90,.55)",
                paddingBottom: 10,
              }}
            >
              <input
                id="ral"
                inputMode="decimal"
                autoComplete="off"
                value={testoRal}
                onChange={(e) => setTestoRal(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  color: "#F6F3EE",
                  fontFamily: SERIF,
                  fontSize: "clamp(44px,5.4vw,64px)",
                  lineHeight: 1,
                  letterSpacing: "-.01em",
                  padding: 0,
                }}
              />
              <span style={{ fontFamily: SERIF, fontSize: 34, color: "#C8A15A" }}>€</span>
            </div>

            <input
              type="range"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={500}
              value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, ral))}
              onChange={(e) => setTestoRal(intero(Number(e.target.value)))}
              aria-label="Trascina per cambiare la RAL"
              style={{
                width: "100%",
                margin: "22px 0 0",
                accentColor: "#C8A15A",
                height: 2,
                cursor: "pointer",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: MONO,
                fontSize: "10.5px",
                color: "#6E675D",
                marginTop: 7,
              }}
            >
              <span>{intero(SLIDER_MIN)}</span>
              <span>{intero(SLIDER_MAX)}</span>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 28,
                alignItems: "flex-end",
                marginTop: 32,
              }}
            >
              <div>
                <p style={{ ...etichettaStile("#A39B8E"), marginBottom: 9 }}>Mensilità</p>
                <div
                  style={{
                    display: "flex",
                    border: "1px solid rgba(246,243,238,.2)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  {p.mensilita.opzioni.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMensilita(m)}
                      aria-pressed={m === mensilita}
                      style={{
                        border: 0,
                        padding: "9px 18px",
                        fontFamily: MONO,
                        fontSize: 13,
                        cursor: "pointer",
                        background: m === mensilita ? "#C8A15A" : "transparent",
                        color: m === mensilita ? "#14120F" : "#A39B8E",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "12.5px",
                  lineHeight: 1.55,
                  color: valida ? "#A39B8E" : "#C8A15A",
                  maxWidth: 270,
                }}
              >
                {valida ? (
                  <>
                    Impiegato, tempo indeterminato,
                    <br />
                    anno intero, {p.profiloStandard.comune}.
                  </>
                ) : (
                  <>Inserisci la RAL come numero, ad esempio 35.000.</>
                )}
              </p>
            </div>
          </div>

          <div
            className="colonna-affiancata"
            style={{
              minWidth: 0,
              borderLeft: "1px solid rgba(246,243,238,.12)",
              paddingLeft: "clamp(28px,3.4vw,56px)",
            }}
          >
            <p style={{ ...etichettaStile("#C8A15A"), marginBottom: 14 }}>Netto annuo</p>
            <p
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: "clamp(52px,7vw,84px)",
                lineHeight: 0.92,
                letterSpacing: "-.015em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {euro(r.nettoAnnuo)}
              <span style={{ fontSize: ".45em", color: "#6E675D", marginLeft: 10 }}>€</span>
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 26,
                marginTop: 38,
                paddingTop: 26,
                borderTop: "1px solid rgba(246,243,238,.12)",
              }}
            >
              <div>
                <p style={{ ...etichettaStile("#A39B8E"), letterSpacing: ".18em", marginBottom: 8 }}>
                  Netto mensile
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: MONO,
                    fontSize: 26,
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {euro(r.nettoMensile)} €
                </p>
                <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "#6E675D" }}>
                  su {mensilita} mensilità
                </p>
              </div>
              <div>
                <p style={{ ...etichettaStile("#A39B8E"), letterSpacing: ".18em", marginBottom: 8 }}>
                  Aliquota media
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: MONO,
                    fontSize: 26,
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {percentuale(r.aliquotaMediaEffettiva, 1)}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "#6E675D" }}>
                  {euro(ral - r.nettoAnnuo)} € trattenuti
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...CONTENITORE, padding: "0 var(--gutter) 46px" }}>
          <div
            style={{
              display: "flex",
              height: 8,
              borderRadius: 1,
              overflow: "hidden",
              background: "rgba(246,243,238,.08)",
            }}
          >
            {barra.map((b) => (
              <div key={b.etichetta} style={{ width: b.w, background: b.colore }} />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 28, marginTop: 14 }}>
            {barra.map((b) => (
              <span
                key={b.etichetta}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "11.5px",
                  color: "#A39B8E",
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: 1, background: b.colore }} />
                {b.etichetta}
                <span style={{ fontFamily: MONO, color: "#F6F3EE" }}>{b.valore}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {r.discontinuitaVicine.length > 0 && (
        <div style={{ ...CONTENITORE, padding: "34px var(--gutter) 0", display: "grid", gap: 14 }}>
          {r.discontinuitaVicine.map((s) => {
            const scende = s.saltoNormativo < 0;
            const colore = scende ? "#A03A22" : "#2C6E3F";
            return (
              <div
                key={s.id}
                className="riga-soglia"
                style={{
                  display: "flex",
                  gap: 18,
                  background: "#FFFDFA",
                  border: "1px solid #E4DFD6",
                  borderLeft: `3px solid ${colore}`,
                  borderRadius: 3,
                  padding: "20px 24px",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "14.5px", fontWeight: 500 }}>{s.titolo}</p>
                  <p
                    style={{
                      margin: "7px 0 0",
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "#4A443C",
                      maxWidth: "75ch",
                    }}
                  >
                    {s.descrizione}
                  </p>
                  <p style={{ margin: "9px 0 0", fontSize: 11, color: "#8B8378" }}>{s.fonte}</p>
                </div>
                <div
                  className="valore-soglia"
                  style={{
                    textAlign: "right",
                    flex: "none",
                    paddingLeft: 20,
                    borderLeft: "1px solid #EFEBE3",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      letterSpacing: ".16em",
                      textTransform: "uppercase",
                      color: "#8B8378",
                    }}
                  >
                    Soglia
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontFamily: MONO,
                      fontSize: 17,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {intero(ralSogliaVisualizzata(s, p))} €
                  </p>
                  <p style={{ margin: "6px 0 0", fontFamily: MONO, fontSize: 13, color: colore }}>
                    {(scende ? "− " : "+ ") + euro(Math.abs(s.saltoNormativo))} €
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Cascata risultato={r} />
      <CurvaMarginale ral={ral} />
      <CostoAzienda ral={ral} nettoAnnuo={r.nettoAnnuo} />
    </>
  );
}
