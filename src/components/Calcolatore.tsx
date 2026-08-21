"use client";

import { useCallback, useMemo, useRef, useState } from "react";

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
const RAL_ESEMPIO = 35000;

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
  /**
   * Due stati distinti, ed è il punto centrale di questo componente.
   *
   * `testoRal` è quello che si sta scrivendo; `ralCalcolata` è quello su cui i
   * risultati sono costruiti. Digitare non ricalcola: serve il pulsante o
   * Invio. Lo slider invece scrive su entrambi, perché trascinare senza vedere
   * la curva muoversi non avrebbe senso.
   */
  const [testoRal, setTestoRal] = useState(() => intero(RAL_ESEMPIO));
  const [ralCalcolata, setRalCalcolata] = useState(RAL_ESEMPIO);
  const [mensilita, setMensilita] = useState(p.mensilita.predefinita);

  const esito = useRef<HTMLDivElement>(null);

  const ralDigitata = useMemo(() => leggiRal(testoRal), [testoRal]);
  const valida = Number.isFinite(ralDigitata) && ralDigitata >= 0;
  const inSospeso = valida && ralDigitata !== ralCalcolata;

  const r = useMemo(
    () =>
      calcola(
        { ral: ralCalcolata, mensilita, giorniLavorati: p.profiloStandard.giorniLavorati },
        p,
      ),
    [ralCalcolata, mensilita],
  );

  /**
   * Porta l'attenzione sul risultato senza strapparlo via: se il blocco è già
   * sotto gli occhi non si muove niente, e chi ha ridotto le animazioni non
   * subisce lo scorrimento.
   */
  const calcolaOra = useCallback(() => {
    if (!valida) return;
    setRalCalcolata(ralDigitata);

    const nodo = esito.current;
    if (!nodo) return;
    const box = nodo.getBoundingClientRect();
    const fuoriVista = box.top < 0 || box.bottom > window.innerHeight;
    if (fuoriVista) {
      const riduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      nodo.scrollIntoView({ behavior: riduce ? "auto" : "smooth", block: "center" });
    }
  }, [valida, ralDigitata]);

  const daSlider = useCallback((v: number) => {
    setTestoRal(intero(v));
    setRalCalcolata(v);
  }, []);

  /**
   * Ripartizione della RAL. I benefici fiscali NON entrano qui: non sono parte
   * del lordo, si sommano al netto, e alle RAL basse porterebbero la somma
   * delle fette oltre il 100%. Stanno nella loro riga, sotto.
   */
  const barra = useMemo(() => {
    const totale = Math.max(1, ralCalcolata);
    const conBenefici = r.prelievo.beneficiFiscali > 0.005;
    return [
      {
        etichetta: conBenefici ? "Netto prima dei benefici fiscali" : "Netto",
        v: r.prelievo.mostrati.nettoPrimaDeiBenefici,
        colore: "#C8A15A",
      },
      { etichetta: "Contributi INPS", v: r.prelievo.mostrati.contributi, colore: "#5C7C93" },
      { etichetta: "IRPEF netta", v: r.prelievo.mostrati.irpefNetta, colore: "#1F4B6E" },
      { etichetta: "Addizionali", v: r.prelievo.mostrati.addizionali, colore: "#A03A22" },
    ]
      .filter((b) => b.v > 0.5)
      .map((b) => ({
        etichetta: b.etichetta,
        colore: b.colore,
        w: `${((b.v / totale) * 100).toFixed(2)}%`,
        valore: `${euro(b.v)} €`,
      }));
  }, [r, ralCalcolata]);

  const sopraMassimale = ralCalcolata > p.contributiLavoratore.massimaleAnnuo;
  const benefici = r.prelievo.beneficiFiscali > 0.005;

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
            <label
              htmlFor="ral"
              style={{ ...etichettaStile("#A39B8E"), display: "block", marginBottom: 22 }}
            >
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    calcolaOra();
                  }
                }}
                aria-describedby="nota-ral"
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
              value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, ralCalcolata))}
              onChange={(e) => daSlider(Number(e.target.value))}
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

            <button
              type="button"
              onClick={calcolaOra}
              disabled={!valida}
              style={{
                marginTop: 26,
                width: "100%",
                border: inSospeso ? "1px solid #C8A15A" : "1px solid rgba(200,161,90,.45)",
                borderRadius: 2,
                padding: "15px 22px",
                fontFamily: MONO,
                fontSize: 13,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                cursor: valida ? "pointer" : "not-allowed",
                background: inSospeso ? "#C8A15A" : "transparent",
                color: !valida ? "#6E675D" : inSospeso ? "#14120F" : "#C8A15A",
                opacity: valida ? 1 : 0.55,
                transition: "background .15s, color .15s, border-color .15s",
              }}
            >
              Calcola il mio netto
            </button>

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
                id="nota-ral"
                style={{
                  margin: 0,
                  fontSize: "12.5px",
                  lineHeight: 1.55,
                  color: valida ? "#A39B8E" : "#C8A15A",
                  maxWidth: 270,
                }}
              >
                {!valida ? (
                  <>Inserisci la RAL come numero, ad esempio 35.000.</>
                ) : inSospeso ? (
                  <>Premi Calcola o Invio per aggiornare il risultato.</>
                ) : (
                  <>
                    Impiegato, tempo indeterminato,
                    <br />
                    anno intero, {p.profiloStandard.comune}.
                  </>
                )}
              </p>
            </div>
          </div>

          <div
            ref={esito}
            className="colonna-affiancata"
            aria-live="polite"
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
                  Netto mensile medio
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
                  Incidenza complessiva
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
                  {percentuale(r.prelievo.incidenzaComplessiva, 1)}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "#6E675D" }}>
                  della RAL tra contributi e imposte
                </p>
              </div>
            </div>

            {/*
              Il brief chiede tre output, e il terzo è "quanto sono le tasse".
              Imposte e contributi restano separati perché sono cose diverse: i
              contributi finanziano una prestazione futura intestata al
              lavoratore, le imposte no.
            */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 26,
                marginTop: 26,
                paddingTop: 26,
                borderTop: "1px solid rgba(246,243,238,.12)",
              }}
            >
              <div>
                <p style={{ ...etichettaStile("#A39B8E"), letterSpacing: ".18em", marginBottom: 8 }}>
                  Imposte
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: MONO,
                    fontSize: 20,
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {euro(r.prelievo.mostrati.imposte)} €
                </p>
                <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "#6E675D" }}>
                  IRPEF netta e addizionali
                </p>
              </div>
              <div>
                <p style={{ ...etichettaStile("#A39B8E"), letterSpacing: ".18em", marginBottom: 8 }}>
                  Contributi
                </p>
                <p
                  style={{
                    margin: 0,
                    fontFamily: MONO,
                    fontSize: 20,
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {euro(r.prelievo.mostrati.contributi)} €
                </p>
                <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "#6E675D" }}>
                  previdenziali IVS, a tuo carico
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

          {benefici && (
            <div
              style={{
                marginTop: 20,
                paddingTop: 18,
                borderTop: "1px solid rgba(246,243,238,.12)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                gap: "10px 28px",
              }}
            >
              <span style={{ ...etichettaStile("#2C6E3F"), letterSpacing: ".18em" }}>
                Benefici fiscali
              </span>
              <span style={{ fontSize: "12.5px", lineHeight: 1.6, color: "#A39B8E" }}>
                {r.agevolazioni.sommaEsente.importo > 0.005 && (
                  <>
                    somma esente del cuneo{" "}
                    <span style={{ fontFamily: MONO, color: "#F6F3EE" }}>
                      {euro(r.agevolazioni.sommaEsente.importo)} €
                    </span>
                  </>
                )}
                {r.agevolazioni.sommaEsente.importo > 0.005 &&
                  r.agevolazioni.trattamentoIntegrativo.importo > 0.005 && <> · </>}
                {r.agevolazioni.trattamentoIntegrativo.importo > 0.005 && (
                  <>
                    trattamento integrativo{" "}
                    <span style={{ fontFamily: MONO, color: "#F6F3EE" }}>
                      {euro(r.agevolazioni.trattamentoIntegrativo.importo)} €
                    </span>
                  </>
                )}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: "11.5px",
                  color: "#6E675D",
                  flexBasis: "100%",
                }}
              >
                {euro(r.prelievo.mostrati.nettoPrimaDeiBenefici)} +{" "}
                {euro(r.prelievo.mostrati.beneficiFiscali)} ={" "}
                <span style={{ color: "#F6F3EE" }}>{euro(r.nettoAnnuo)} €</span> di netto annuo
              </span>
            </div>
          )}
        </div>
      </section>

      {(sopraMassimale || r.discontinuitaVicine.length > 0) && (
        <div style={{ ...CONTENITORE, padding: "34px var(--gutter) 0", display: "grid", gap: 14 }}>
          {sopraMassimale && (
            <div
              style={{
                background: "#FFFDFA",
                border: "1px solid #E4DFD6",
                borderLeft: "3px solid #5C7C93",
                borderRadius: 3,
                padding: "20px 24px",
              }}
            >
              <p style={{ margin: 0, fontSize: "14.5px", fontWeight: 500 }}>
                Sopra il massimale contributivo
              </p>
              <p
                style={{
                  margin: "7px 0 0",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "#4A443C",
                  maxWidth: "80ch",
                }}
              >
                Sopra il massimale contributivo di{" "}
                {intero(p.contributiLavoratore.massimaleAnnuo)} € i contributi IVS si fermano. Il
                massimale si applica ai soli lavoratori iscritti alla previdenza obbligatoria dal 1°
                gennaio 1996 e privi di anzianità contributiva precedente (art. 2 c. 18 L.
                335/1995): per gli altri non opera.
              </p>
            </div>
          )}

          {/*
            Avviso di prossimità alle soglie. Il tono resta descrittivo: dice
            dove sta il gradino e cosa succede attraversandolo, mai cosa
            converrebbe chiedere. La RAL mostrata è arrotondata per eccesso, così
            chi ha già superato la soglia non si legge ancora al di sotto.
          */}
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
                    Soglia a {intero(ralSogliaVisualizzata(s, p))} € di RAL. {s.descrizione} Il
                    netto {scende ? "scende" : "sale"} di {euro(Math.abs(s.saltoNormativo))} €.
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
      <CurvaMarginale ral={ralCalcolata} />
      <CostoAzienda ral={ralCalcolata} nettoAnnuo={r.nettoAnnuo} />
    </>
  );
}
