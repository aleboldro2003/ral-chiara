import { parametriPerAnno } from "@/engine/parametri";
import { LOCKUP, LOCKUP_RAPPORTO, MONOGRAMMA } from "@/marchio";
import { REPOSITORY } from "@/progetto";

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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/*
            Il marchio sostituisce il logotipo composto a mano. Resta un h1 con
            il nome in chiaro per lettori di schermo e motori di ricerca: il
            testo è nascosto alla vista, non all'accessibilità.
          */}
          <h1 style={{ margin: 0, display: "flex", alignItems: "center" }}>
            <img
              src={LOCKUP}
              alt="RAL Chiara"
              width={Math.round(32 * LOCKUP_RAPPORTO)}
              height={32}
              style={{ height: 32, width: "auto", display: "block" }}
            />
          </h1>
          <span aria-hidden="true" style={{ width: 22, height: 1, background: "rgba(200,161,90,.6)" }} />
          <span style={{ ...etichettaStile("#A39B8E") }}>Da lordo a netto, voce per voce</span>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: ".08em",
            color: "#C8A15A",
          }}
        >
          <span style={{
              border: "1px solid rgba(200,161,90,.4)",
              borderRadius: 2,
              padding: "4px 9px",
              whiteSpace: "nowrap",
            }}>
            ANNO D&apos;IMPOSTA {p.annoImposta}
          </span>
          <span
            style={{
              border: "1px solid rgba(246,243,238,.16)",
              borderRadius: 2,
              padding: "4px 9px",
              color: "#A39B8E",
              whiteSpace: "nowrap",
            }}
          >
            {p.profiloStandard.comune.toUpperCase()} ({p.profiloStandard.regione.toUpperCase()})
          </span>
          {REPOSITORY && (
            <a
              href={REPOSITORY}
              target="_blank"
              rel="noopener noreferrer"
              title="Codice, motore di calcolo, semplificazioni dichiarate e suite di test"
              style={{
                border: "1px solid rgba(200,161,90,.4)",
                borderRadius: 2,
                padding: "4px 9px",
                color: "#C8A15A",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              METODO, ASSUNZIONI E TEST ↗
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * L'etichetta deve dire dove porta il link, non solo di cosa parla. Dove la
 * norma e la prassi sono due documenti diversi compaiono come due voci, perché
 * una FAQ operativa non è la fonte di un'aliquota.
 */
const FONTI = [
  { testo: "IRPEF — L. 199/2025 art. 1 co. 3, testo su Normattiva", url: p.irpef.url },
  {
    testo: "IRPEF — aliquote e calcolo, Agenzia delle Entrate",
    url: p.irpef.urlPrassi,
  },
  { testo: "Contributi INPS — Circolare n. 6 del 30 gennaio 2026", url: p.contributiLavoratore.url },
  {
    testo: "Detrazione lavoro dipendente — art. 13 TUIR, istruzioni 730/2026 Tabella 6",
    url: p.detrazioneLavoroDipendente.url,
  },
  {
    testo: "Cuneo fiscale — L. 207/2024 art. 1, testo su Normattiva",
    url: p.cuneoFiscale.url,
  },
  { testo: "Cuneo fiscale — scheda operativa NoiPA (MEF)", url: p.cuneoFiscale.urlPrassi },
  {
    testo: `Addizionale regionale ${p.addizionaleRegionale.regione} — banca dati MEF`,
    url: p.addizionaleRegionale.url,
  },
  {
    testo: `Addizionale comunale ${p.addizionaleComunale.comune} (F205) — interrogazione banca dati MEF`,
    url: p.addizionaleComunale.url,
  },
  {
    testo: "Addizionale comunale — disciplina del tributo, MEF",
    url: p.addizionaleComunale.urlDisciplina,
  },
  {
    testo: "TFR — L. 297/1982, testo su Normattiva",
    url: p.costoDatore.tfr.url,
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
                rel="noopener noreferrer"
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
          <img
            src={MONOGRAMMA}
            alt=""
            aria-hidden="true"
            width={44}
            height={44}
            style={{ width: 44, height: 44, opacity: 0.9 }}
          />
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
          {REPOSITORY && (
            <p style={{ margin: 0, fontSize: "12.5px", lineHeight: 1.75 }}>
              <a
                href={REPOSITORY}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#C8A15A",
                  textDecoration: "underline",
                  textDecorationColor: "rgba(200,161,90,.4)",
                  textUnderlineOffset: 3,
                }}
              >
                Metodo, assunzioni e test ↗
              </a>{" "}
              — motore di calcolo, catena normativa passo per passo, le
              semplificazioni dichiarate una per una e la suite di test che le verifica.
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
