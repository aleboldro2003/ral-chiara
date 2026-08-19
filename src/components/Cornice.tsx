import { parametriPerAnno } from "@/engine/parametri";

const p = parametriPerAnno();

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const CONTENITORE: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  padding: "0 var(--gutter)",
};

/** Etichetta in maiuscoletto spaziato, ricorre in tutta l'interfaccia. */
export function etichettaStile(colore: string): React.CSSProperties {
  return {
    margin: 0,
    fontSize: "10.5px",
    letterSpacing: ".22em",
    textTransform: "uppercase",
    color: colore,
  };
}

export function Intestazione() {
  return (
    <header
      style={{
        background: "#14120F",
        color: "#F6F3EE",
        borderBottom: "1px solid rgba(200,161,90,.35)",
      }}
    >
      <div
        style={{
          ...CONTENITORE,
          padding: "18px var(--gutter)",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 27, fontWeight: 400, letterSpacing: ".01em" }}>
            RAL Chiara
          </h1>
          <span aria-hidden="true" style={{ width: 22, height: 1, background: "rgba(200,161,90,.6)" }} />
          <span style={{ ...etichettaStile("#A39B8E") }}>Da lordo a netto, voce per voce</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: ".08em",
            color: "#C8A15A",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ border: "1px solid rgba(200,161,90,.4)", borderRadius: 2, padding: "4px 9px" }}>
            ANNO D&apos;IMPOSTA {p.annoImposta}
          </span>
          <span
            style={{
              border: "1px solid rgba(246,243,238,.16)",
              borderRadius: 2,
              padding: "4px 9px",
              color: "#A39B8E",
            }}
          >
            {p.profiloStandard.comune.toUpperCase()} ({p.profiloStandard.regione.toUpperCase()})
          </span>
        </div>
      </div>
    </header>
  );
}

const FONTI = [
  { testo: "IRPEF — L. 199/2025 art. 1 co. 3, che modifica l'art. 11 TUIR", url: p.irpef.url },
  { testo: "Contributi INPS — Circolare n. 6 del 30 gennaio 2026", url: p.contributiLavoratore.url },
  {
    testo: "Detrazione lavoro dipendente — art. 13 TUIR, istruzioni 730/2026 Tabella 6",
    url: p.detrazioneLavoroDipendente.url,
  },
  { testo: "Cuneo fiscale — L. 207/2024 art. 1 commi 4-9", url: p.cuneoFiscale.url },
  {
    testo: `Addizionale regionale ${p.addizionaleRegionale.regione} — banca dati MEF`,
    url: p.addizionaleRegionale.url,
  },
  {
    testo: `Addizionale comunale ${p.addizionaleComunale.comune} — banca dati MEF`,
    url: p.addizionaleComunale.url,
  },
];

export function PiePagina() {
  return (
    <footer style={{ marginTop: 64, background: "#14120F", color: "#A39B8E" }}>
      <div
        style={{
          ...CONTENITORE,
          padding: "48px var(--gutter) 56px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))",
          gap: "clamp(32px,4vw,64px)",
        }}
      >
        <div>
          <p style={{ ...etichettaStile("#C8A15A"), marginBottom: 18 }}>Fonti</p>
          <div style={{ display: "grid", gap: 9 }}>
            {FONTI.map((f) => (
              <a
                key={f.testo}
                href={f.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: "12.5px",
                  lineHeight: 1.6,
                  color: "#D5CFC5",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(246,243,238,.12)",
                  paddingBottom: 9,
                  display: "block",
                }}
              >
                {f.testo}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.75, maxWidth: "60ch" }}>
            Prototipo a scopo dimostrativo: non sostituisce una busta paga né il parere di un
            consulente del lavoro. Il calcolo è annuale, sul caso standard di impiegato a tempo
            indeterminato per l&apos;intero anno, senza familiari a carico né altre agevolazioni.
          </p>
          <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.75, maxWidth: "60ch" }}>
            {p.addizionaleComunale.comune} non ha depositato una nuova delibera per il{" "}
            {p.annoImposta}: restano in vigore le aliquote dell&apos;anno precedente. Da riverificare
            sulla banca dati MEF prima di ogni nuovo anno d&apos;imposta.
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: MONO,
              fontSize: "11.5px",
              lineHeight: 1.7,
              color: "#6E675D",
            }}
          >
            Parametri revisione {p.revisione} · aggiornati al {p.aggiornatoIl} · calcolo interamente
            client-side e deterministico: nessun dato lascia il browser.
          </p>
        </div>
      </div>
    </footer>
  );
}
