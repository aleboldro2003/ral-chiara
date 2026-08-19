"use client";

import { useMemo, useState } from "react";

import { calcolaCostoAzienda, calcolaDeltaMarginale } from "@/engine/costoAzienda";
import { euro, percentuale } from "@/engine/formato";
import { aliquotaMarginale } from "@/engine/marginale";
import { parametriPerAnno } from "@/engine/parametri";

import { CONTENITORE, etichettaStile } from "./Cornice";

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/**
 * La vista datore di lavoro. È la metà della conversazione che manca a
 * qualunque altro calcolatore: il netto in busta risponde al dipendente, il
 * costo totale risponde a chi deve decidere l'aumento.
 *
 * Tutto qui dentro è una stima ed è esposto come tale, con il suo intervallo.
 */
export function CostoAzienda({ ral, nettoAnnuo }: { ral: number; nettoAnnuo: number }) {
  const p = parametriPerAnno();
  const [inail, setInail] = useState(false);
  const [aliquotaDatore, setAliquotaDatore] = useState(p.costoDatore.contributiDatore.predefinito);

  const opzioni = useMemo(
    () => ({ aliquotaContributiDatore: aliquotaDatore, includiInail: inail }),
    [aliquotaDatore, inail],
  );
  const costo = useMemo(() => calcolaCostoAzienda(ral, opzioni, p), [ral, opzioni, p]);
  const delta = useMemo(() => calcolaDeltaMarginale(ral, 1000, opzioni, p), [ral, opzioni, p]);

  const quotaNetta =
    delta.incrementoCostoAzienda > 0
      ? delta.incrementoNettoDipendente / delta.incrementoCostoAzienda
      : 0;

  /**
   * L'aliquota su un aumento di 1.000 € non coincide necessariamente con quella
   * marginale locale: una finestra così ampia può attraversare un cambio di
   * regime. Le due cifre sono entrambe corrette e rispondono a domande diverse,
   * quindi quando divergono la pagina lo dice invece di lasciarle in apparente
   * contraddizione.
   */
  const marginaleLocale = useMemo(() => aliquotaMarginale(ral, 100, p), [ral, p]);
  const cambioRegime = Math.abs(delta.aliquotaMarginaleEffettiva - marginaleLocale) > 0.02;

  const celle = [
    { etichetta: "RAL", valore: `${euro(costo.ral)} €` },
    {
      etichetta: `Contributi datore (${percentuale(aliquotaDatore, 1)})`,
      valore: `${euro(costo.contributiDatore)} €`,
    },
    { etichetta: "TFR maturato", valore: `${euro(costo.tfrQuotaMaturata)} €` },
    { etichetta: "INAIL", valore: costo.inail === null ? "escluso" : `${euro(costo.inail)} €` },
    { etichetta: "Costo totale", valore: `${euro(costo.costoTotale)} €`, totale: true },
  ];

  return (
    <section style={{ ...CONTENITORE, padding: "56px var(--gutter) 0" }} aria-labelledby="titolo-costo">
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
          id="titolo-costo"
          style={{ margin: 0, fontFamily: SERIF, fontSize: 31, fontWeight: 400, letterSpacing: "-.01em" }}
        >
          Costo per l&apos;azienda
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "#8B8378" }}>
          Moltiplicatore{" "}
          <span style={{ fontFamily: MONO, color: "#14120F" }}>
            {costo.moltiplicatore.toFixed(3).replace(".", ",")}×
          </span>
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(170px,100%),1fr))",
          gap: 1,
          background: "#E4DFD6",
          border: "1px solid #E4DFD6",
          borderTop: 0,
        }}
      >
        {celle.map((c) => (
          <div key={c.etichetta} style={{ background: c.totale ? "#14120F" : "#FFFDFA", padding: "20px 22px" }}>
            <p
              style={{
                margin: 0,
                fontSize: "10.5px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: c.totale ? "#C8A15A" : "#8B8378",
              }}
            >
              {c.etichetta}
            </p>
            <p
              style={{
                margin: "10px 0 0",
                fontFamily: MONO,
                fontSize: 19,
                fontWeight: c.totale ? 500 : 400,
                fontVariantNumeric: "tabular-nums",
                color: c.totale ? "#F6F3EE" : "#14120F",
              }}
            >
              {c.valore}
            </p>
          </div>
        ))}
      </div>

      <div
        className="no-print"
        style={{ display: "flex", flexWrap: "wrap", gap: 34, alignItems: "center", marginTop: 20 }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#4A443C" }}>
          <span>Contributi datore</span>
          <input
            type="range"
            min={p.costoDatore.contributiDatore.minimo * 100}
            max={p.costoDatore.contributiDatore.massimo * 100}
            step={0.5}
            value={aliquotaDatore * 100}
            onChange={(e) => setAliquotaDatore(Number(e.target.value) / 100)}
            aria-label="Aliquota contributiva a carico del datore"
            style={{ width: 150, cursor: "pointer" }}
          />
          <span style={{ fontFamily: MONO, fontSize: 13, color: "#14120F", minWidth: 46 }}>
            {percentuale(aliquotaDatore, 1)}
          </span>
        </label>
        <label
          style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: "#4A443C", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={inail}
            onChange={(e) => setInail(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: "#9C7A45", cursor: "pointer" }}
          />
          Includi INAIL ({percentuale(p.costoDatore.inail.predefinito, 1)}, impiegato d&apos;ufficio)
        </label>
        <p style={{ margin: 0, fontSize: "11.5px", color: "#8B8378" }}>
          Stima nell&apos;intervallo {euro(costo.costoMinimo)} – {euro(costo.costoMassimo)} € secondo
          CCNL, settore e dimensione aziendale
        </p>
      </div>

      <div
        style={{
          marginTop: 26,
          background: "#14120F",
          color: "#F6F3EE",
          borderRadius: 3,
          padding: "32px 36px",
        }}
      >
        <p style={{ ...etichettaStile("#C8A15A"), marginBottom: 24 }}>Mille euro in più di RAL</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(240px,100%),1fr))",
            gap: "clamp(28px,3vw,44px)",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: 46,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              + {euro(delta.incrementoNettoDipendente)} €
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#A39B8E" }}>li vede il dipendente</p>
          </div>
          <div className="colonna-affiancata" style={{ borderLeft: "1px solid rgba(246,243,238,.12)", paddingLeft: 44 }}>
            <p
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontSize: 46,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              + {euro(delta.incrementoCostoAzienda)} €
            </p>
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "#A39B8E" }}>costano all&apos;azienda</p>
          </div>
        </div>

        <div style={{ marginTop: 30, paddingTop: 24, borderTop: "1px solid rgba(246,243,238,.12)" }}>
          <div
            style={{
              display: "flex",
              height: 6,
              borderRadius: 3,
              overflow: "hidden",
              background: "rgba(246,243,238,.12)",
            }}
          >
            <div
              style={{
                width: `${(Math.max(0, Math.min(1, quotaNetta)) * 100).toFixed(1)}%`,
                background: "#C8A15A",
              }}
            />
          </div>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: "13.5px",
              lineHeight: 1.7,
              color: "#D5CFC5",
              maxWidth: "80ch",
            }}
          >
            Arriva in tasca il{" "}
            <span style={{ fontFamily: MONO, color: "#F6F3EE" }}>{percentuale(quotaNetta, 1)}</span> di
            quello che l&apos;aumento costa. Su questo aumento la trattenuta è il{" "}
            <span style={{ fontFamily: MONO, color: "#F6F3EE" }}>
              {percentuale(delta.aliquotaMarginaleEffettiva, 1)}
            </span>
            .
          </p>
          {cambioRegime && (
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 12,
                lineHeight: 1.7,
                color: "#8B8378",
                maxWidth: "80ch",
              }}
            >
              Non coincide con l&apos;aliquota marginale del grafico ({percentuale(marginaleLocale, 1)}{" "}
              a questa RAL) perché un aumento di 1.000 € attraversa un cambio di regime: parte del
              percorso è tassata a un&apos;aliquota, parte a un&apos;altra. Entrambe le cifre sono
              corrette e rispondono a domande diverse.
            </p>
          )}
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
        Netto annuo del dipendente {euro(nettoAnnuo)} € su un costo aziendale di{" "}
        {euro(costo.costoTotale)} €: il{" "}
        {costo.costoTotale > 0 ? percentuale(nettoAnnuo / costo.costoTotale, 1) : "—"}. TFR maturato al{" "}
        {percentuale(1 / p.costoDatore.tfr.divisore, 2)} della RAL, di cui{" "}
        {percentuale(p.costoDatore.tfr.contributoFondoGaranzia, 2)} al Fondo di Garanzia INPS; il costo
        per l&apos;azienda è comunque l&apos;intero.
      </p>
    </section>
  );
}
