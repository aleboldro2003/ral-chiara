"use client";

import { useMemo } from "react";

import { intero, percentuale } from "@/engine/formato";
import { aliquotaMarginale, curvaMarginale } from "@/engine/marginale";
import { parametriPerAnno } from "@/engine/parametri";
import { ralPerImponibile, ralSogliaDi } from "@/engine/soglie";

import { CONTENITORE } from "./Cornice";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/** Estremi del dominio e geometria del viewBox, come nel file di design. */
const DA = 8000;
const A = 80000;
const PASSO = 100;
const TETTO = 0.7;
const L = 56;
const R = 986;
const T = 12;
const B = 300;

const x = (v: number) => L + ((v - DA) / (A - DA)) * (R - L);
const y = (v: number) => T + (1 - v / TETTO) * (B - T);

const TACCHE_Y = [
  { testo: "0%", top: "90.9%" },
  { testo: "10%", top: "78.5%" },
  { testo: "20%", top: "66%" },
  { testo: "30%", top: "53.5%" },
  { testo: "40%", top: "41%" },
  { testo: "50%", top: "28.6%" },
  { testo: "60%", top: "16.1%" },
  { testo: "70%", top: "3.6%" },
];

const TACCHE_X = [
  { testo: "10k", left: "8.18%" },
  { testo: "20k", left: "21.1%" },
  { testo: "30k", left: "34.02%" },
  { testo: "40k", left: "46.93%" },
  { testo: "50k", left: "59.85%" },
  { testo: "60k", left: "72.77%" },
  { testo: "70k", left: "85.68%" },
  { testo: "80k", left: "98.6%" },
];

/**
 * La curva dell'aliquota marginale effettiva, campionata dal motore per
 * differenze finite su incrementi di 100 €. Nessun valore precalcolato: la
 * gobba e i sette gradini emergono dai dati.
 *
 * L'SVG è disegnato a mano invece che con una libreria di grafici perché il
 * disegno ha tre esigenze che un componente generico non copre bene: la linea
 * deve interrompersi sulle soglie invece di collegarle, la banda della gobba è
 * un riferimento e non una serie, e le tacche degli assi vivono in HTML fuori
 * dall'SVG per restare leggibili a qualunque larghezza.
 */
export function CurvaMarginale({ ral }: { ral: number }) {
  const p = parametriPerAnno();

  const { segmenti, soglieX, gobba, marker, marginaleQui, gobbaDa, gobbaA } = useMemo(() => {
    const punti = curvaMarginale({ da: DA, a: A, passo: PASSO }, p);

    // La linea si spezza dove la marginale esce dalla scala: su una soglia una
    // finestra da 100 € contiene un salto secco e il valore supera il 100%.
    const gruppi: string[][] = [];
    let corrente: string[] = [];
    for (const punto of punti) {
      const dentro = punto.aliquotaMarginale >= 0 && punto.aliquotaMarginale <= TETTO;
      if (dentro) {
        corrente.push(`${x(punto.ral).toFixed(1)},${y(punto.aliquotaMarginale).toFixed(1)}`);
      } else if (corrente.length) {
        gruppi.push(corrente);
        corrente = [];
      }
    }
    if (corrente.length) gruppi.push(corrente);

    const soglieX = p.discontinuita.soglie
      .map((s) => ({ id: s.id, ral: ralSogliaDi(s, p), salto: s.saltoNormativo }))
      .filter((s) => s.ral >= DA && s.ral <= A)
      .map((s) => ({
        id: s.id,
        x: x(s.ral).toFixed(1),
        colore: s.salto < 0 ? "#A03A22" : "#2C6E3F",
      }));

    const da = ralPerImponibile(32000, p);
    const a = ralPerImponibile(40000, p);

    const marginaleLocale = aliquotaMarginale(ral, PASSO, p);
    const dentroDominio = ral >= DA && ral <= A && marginaleLocale >= 0 && marginaleLocale <= TETTO;

    return {
      segmenti: gruppi
        .filter((g) => g.length > 1)
        .map((g, i) => ({ id: `s${i}`, d: "M " + g.join(" L ") })),
      soglieX,
      gobba: {
        x: x(Math.max(DA, da)).toFixed(1),
        w: (x(Math.min(A, a)) - x(Math.max(DA, da))).toFixed(1),
      },
      marker: dentroDominio
        ? { x: x(ral).toFixed(1), y: y(marginaleLocale).toFixed(1) }
        : null,
      marginaleQui: percentuale(marginaleLocale, 1),
      gobbaDa: intero(da),
      gobbaA: intero(a),
    };
  }, [p, ral]);

  return (
    <section style={{ ...CONTENITORE, padding: "56px var(--gutter) 0" }} aria-labelledby="titolo-curva">
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
          id="titolo-curva"
          style={{ margin: 0, fontFamily: SERIF, fontSize: 31, fontWeight: 400, letterSpacing: "-.01em" }}
        >
          Aliquota marginale effettiva
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "#8B8378" }}>
          Alla tua RAL: <span style={{ fontFamily: MONO, color: "#14120F" }}>{marginaleQui}</span>
        </p>
      </div>

      <div
        style={{
          background: "#FFFDFA",
          border: "1px solid #E4DFD6",
          borderTop: 0,
          borderRadius: "0 0 3px 3px",
          padding: "26px 26px 20px",
        }}
      >
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "13.5px",
            lineHeight: 1.7,
            color: "#4A443C",
            maxWidth: "78ch",
          }}
        >
          Di un euro in più di RAL, quanto <em>non</em> arriva in tasca: contributi, IRPEF, phase-out
          delle detrazioni e addizionali messi insieme. La curva non è monotona — tra {gobbaDa} e{" "}
          {gobbaA} € sale a circa il 61%, più che nella fascia immediatamente superiore.
        </p>

        <div
          style={{
            position: "relative",
            fontFamily: MONO,
            fontSize: 11,
            color: "#A9A196",
          }}
        >
          <svg
            viewBox="0 0 1000 330"
            preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
            role="img"
            aria-label={`Curva dell'aliquota marginale effettiva da ${DA} a ${A} euro di RAL. Sale a gradini fino a un massimo di circa il 61 per cento tra ${gobbaDa} e ${gobbaA} euro, poi scende al 49 per cento e risale al 51 per cento oltre i 56.224 euro. Sette linee verticali marcano le soglie a gradino.`}
          >
            <g stroke="#EAE4D9" strokeWidth={1}>
              {[300, 258.9, 217.7, 176.6, 135.4, 94.3, 53.1, 12].map((yy) => (
                <line key={yy} x1={56} x2={986} y1={yy} y2={yy} />
              ))}
            </g>

            <rect x={gobba.x} y={T} width={gobba.w} height={B - T} fill="#1F4B6E" fillOpacity={0.06} />

            {soglieX.map((s) => (
              <line
                key={s.id}
                x1={s.x}
                x2={s.x}
                y1={T}
                y2={B}
                stroke={s.colore}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            ))}

            {segmenti.map((s) => (
              <path key={s.id} d={s.d} fill="none" stroke="#1F4B6E" strokeWidth={2} strokeLinejoin="round" />
            ))}

            {marker && (
              <g>
                <line x1={marker.x} x2={marker.x} y1={T} y2={B} stroke="#9C7A45" strokeWidth={1} />
                <circle cx={marker.x} cy={marker.y} r={5} fill="#9C7A45" stroke="#FFFDFA" strokeWidth={2} />
              </g>
            )}
          </svg>

          {TACCHE_Y.map((t) => (
            <span
              key={t.testo}
              style={{
                position: "absolute",
                left: 0,
                width: "4.6%",
                textAlign: "right",
                top: t.top,
                transform: "translateY(-50%)",
              }}
            >
              {t.testo}
            </span>
          ))}
          {TACCHE_X.map((t) => (
            <span
              key={t.testo}
              style={{
                position: "absolute",
                left: t.left,
                top: "95%",
                transform: "translate(-50%,-50%)",
              }}
            >
              {t.testo}
            </span>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid #EFEBE3",
            fontSize: "11.5px",
            color: "#8B8378",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 18, height: 2, background: "#1F4B6E" }} />
            Aliquota marginale
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 18, height: 10, background: "rgba(31,75,110,.1)" }} />
            La gobba, {gobbaDa} – {gobbaA} €
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 0, height: 12, borderLeft: "1px dashed #A03A22" }} />
            Soglia, il netto scende
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 0, height: 12, borderLeft: "1px dashed #2C6E3F" }} />
            Soglia, il netto sale
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#9C7A45" }} />
            La tua posizione
          </span>
        </div>
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
        La linea si interrompe sulle sette soglie a gradino: una finestra di campionamento da 100 €
        che contiene il salto secco da 184 € dell&apos;addizionale comunale produce una marginale del
        224%, e un asse che arrivasse fin lì schiaccerebbe tutto il resto.
      </p>
    </section>
  );
}
