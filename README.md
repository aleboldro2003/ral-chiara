# RAL Chiara

Calcolatore da retribuzione annua lorda a netto per l'anno d'imposta **2026**, con la scomposizione completa di ogni trattenuta, il riferimento normativo di ogni voce, la curva dell'aliquota marginale effettiva e la vista del costo per l'azienda.

**Demo:** https://claude.ai/code/artifact/5606b4cd-4b60-46d7-9f33-3d964056b9ff
**Codice:** https://github.com/aleboldro2003/ral-chiara

Caso modellato: impiegato del settore privato, tempo indeterminato, anno intero, domicilio fiscale a Milano (Lombardia), nessun familiare a carico, nessuna agevolazione. Il calcolo è interamente client-side e deterministico: nessun dato lascia il browser, nessuna chiamata di rete, nessun database.

Prototipo a scopo dimostrativo. Non sostituisce una busta paga né il parere di un consulente del lavoro.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 197 test
npm run typecheck
npm run standalone # standalone/ral-chiara.html — pagina autoportante in un file solo
```

---

## 1. La catena di calcolo

L'errore più comune è pensare che «netto = lordo − tasse». In realtà ci sono **due basi imponibili diverse**, e le detrazioni agiscono sull'imposta, non sul reddito.

```
RAL (retribuzione annua lorda)
 │
 ├─(1)─ − Contributi previdenziali a carico lavoratore (IVS)
 │
 ▼
IMPONIBILE FISCALE (= reddito complessivo = reddito di lavoro dipendente)
 │
 ├─(2)─ × Aliquote IRPEF per scaglioni ──────────► IRPEF LORDA
 │                                                   │
 │      (3) − Detrazione lavoro dipendente (art. 13) │
 │      (4) − Ulteriore detrazione "cuneo" (c. 6)    │
 │                                                   ▼
 │                                              IRPEF NETTA  (min. 0)
 │
 ├─(5)─ × Addizionale regionale Lombardia ─────────► ADD. REGIONALE
 ├─(5)─ × Addizionale comunale Milano ─────────────► ADD. COMUNALE
 │
 └─(6)─ + Somma esente "cuneo" (c. 4) e trattamento integrativo, se spettanti
          [NON sono imposte: si sommano al netto]

NETTO ANNUO   = RAL − contributi − IRPEF netta − addizionali + somme esenti
NETTO MENSILE = NETTO ANNUO / mensilità (12, 13 o 14)
```

Tre distinzioni che il codice tiene separate perché la norma le tiene separate:

- **I contributi sono oneri deducibili**, riducono la base su cui si calcola l'imposta. **Le detrazioni sono sconti d'imposta**, riducono l'imposta già calcolata. A parità di importo una detrazione vale molto più di una deduzione.
- **Le addizionali non hanno detrazioni proprie**: si applicano all'imponibile secco. Sono però dovute solo se per lo stesso anno risulta dovuta l'IRPEF.
- **Le detrazioni non generano credito rimborsabile**: se eccedono l'imposta lorda, questa si azzera e il resto è perso. Il risultato espone `detrazioniNonGodute`, così l'interfaccia può dire quanto è andato perduto per incapienza invece di nasconderlo.

---

## 2. Architettura

```
src/
  engine/                    motore puro: nessun DOM, nessun React, gira in Node
    parametri-2026.json      TUTTI i valori normativi, ciascuno con fonte e url
    parametri.ts             registro anno → parametri
    tipi.ts                  tipi del dominio
    numerico.ts              troncamento, arrotondamento, scale progressive
    contributi.ts            step 1 (+ inversione imponibile → RAL)
    irpef.ts                 step 2-4
    cuneo.ts                 L. 207/2024 commi 4-6 e trattamento integrativo
    addizionali.ts           step 5
    soglie.ts                le soglie a gradino: dove stanno, quanto valgono
    calcola.ts               orchestratore
    costoAzienda.ts          vista datore di lavoro
    marginale.ts             curva dell'aliquota marginale
    formato.ts               formattazione italiana (unico modulo che sa di locale)
    __tests__/               197 test
  components/                interfaccia React
  app/                       Next.js App Router
scripts/build-standalone.mjs build della pagina a file singolo
```

Il motore non importa nulla dalla UI. La UI non ricalcola nulla: `calcola()` restituisce ogni step intermedio, comprese le formule con i numeri già sostituiti e le fonti prese dai parametri.

---

## 3. Fonti

Gerarchia di affidabilità usata, dalla più alta:

1. **Testi normativi** — TUIR (D.P.R. 917/1986), L. 199/2025, L. 207/2024, D.L. 3/2020, D.Lgs. 360/1998, D.Lgs. 446/1997, L. 335/1995, L.R. Lombardia 10/2003
2. **Banche dati e documenti di prassi degli enti** — MEF/Dipartimento delle Finanze, circolari INPS, istruzioni e circolari dell'Agenzia delle Entrate, delibere comunali depositate
3. **Prassi operativa istituzionale** — FAQ NoiPA, FAQ INPS, Certificazione Unica
4. **Fonti professionali** — Consulenti del Lavoro, riviste specializzate: usate solo per orientarsi, mai come fonte di un numero
5. **Blog e calcolatori online** — usati **solo** come controprova, mai come fonte

Il livello 5 ha prodotto errori concreti e verificabili: il calcolo *a scaglioni* della somma esente del cuneo, che è invece un'aliquota unica sulla fascia di appartenenza (per 18.000 € la differenza è 864 € contro 1.092 €), e l'inversione dei minimi 690/1.380 € dell'art. 13. Il testo della nota (3) alla Tabella 6 delle istruzioni 730/2026 è esplicito: 690 € per i rapporti a **tempo indeterminato**, 1.380 € per quelli a **tempo determinato**.

| Voce | Fonte |
|---|---|
| Aliquote IRPEF 2026 | [L. 199/2025 art. 1 co. 3](https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef), che modifica l'art. 11 co. 1 lett. b) TUIR sostituendo il 35% con il 33% |
| Contributi INPS, prima fascia, massimale | [Circolare INPS n. 6 del 30/01/2026](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html); aliquota aggiuntiva art. 3-*ter* D.L. 384/1992; massimale art. 2 c. 18 L. 335/1995 |
| Detrazione lavoro dipendente | art. 13 co. 1 e 1.1 TUIR; [istruzioni 730/2026](https://www.agenziaentrate.gov.it/portale/documents/20143/9764684/730_2026_istruzioni_+agg+28+05+2026.pdf), Tabella 6 note (2) (3) (4) |
| Cuneo fiscale | [L. 207/2024 art. 1 commi 4-9](https://noipa.mef.gov.it/cl/en/taglio-del-cuneo-fiscale); Circolare AdE n. 4/E del 16/05/2025; Risposta AdE n. 7/2026 del 16/01/2026 |
| Trattamento integrativo | D.L. 3/2020 art. 1 co. 1, come modificato da L. 207/2024 art. 1 co. 3; Circolare AdE n. 2/E del 06/02/2024 |
| Addizionale regionale | [MEF/DF, Lombardia cod. 10](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=10); art. 72 co. 1 L.R. Lombardia 10/2003; debenza art. 50 D.Lgs. 446/1997 |
| Addizionale comunale | [MEF/DF, Milano F205](https://www.finanze.gov.it/it/fiscalita/fiscalita-regionale-e-locale/Addizionale-comunale-allIRPEF/disciplina-del-tributo/); delibera n. 46 del 28/09/2020; disciplina art. 1 D.Lgs. 360/1998 |
| TFR | art. 2120 c.c.; art. 2 L. 297/1982 |

**Attenzione alla trappola temporale.** Il 730/2026 riguarda i redditi 2025 e applica ancora il 35%: la sua tabella degli scaglioni riporta «6.440,00 + 35% parte eccedente 28.000,00». Il 33% si vede in busta paga da gennaio 2026 e in dichiarazione solo nel 730/2027. Un calcolatore «anno d'imposta 2026» deve usare il 33%, ed è quello che fa questo.

**Milano non ha depositato una delibera per il 2026.** Interrogando la banca dati MEF alla voce 2026 il portale restituisce «Non ci sono dati per il comune selezionato». In assenza di nuova delibera restano in vigore le aliquote precedenti: 0,8% con esenzione fino a 23.000 €. Da riverificare prima di ogni nuovo anno d'imposta.

---

## 4. Assunzioni e semplificazioni

Tutte dichiarate, nessuna nascosta.

**Sul reddito**

1. Reddito complessivo = solo reddito di lavoro dipendente. Nessun altro reddito, nessun immobile, nessuna cedolare secca
2. Nessun onere deducibile oltre i contributi obbligatori
3. Nessun onere detraibile: spese sanitarie, mutuo, ristrutturazioni
4. Nessun familiare a carico: l'art. 12 TUIR non è applicato
5. Nessuna agevolazione: impatriati, rientro cervelli, bonus mamme, premi di produttività, welfare, fringe benefit

**Sui contributi**

6. Aliquota lavoratore fissa al 9,19%: non sono modellati apprendistato, part-time, settori con aliquote diverse, fondi di categoria (Metasalute, EST, Previndai)
7. L'1% aggiuntivo è applicato su base annua, mentre la norma prevede la mensilizzazione sulla soglia mensile. Con retribuzione costante il risultato coincide; con premi concentrati in un mese no
8. Imponibile previdenziale = imponibile fiscale = RAL. Nella realtà differiscono per alcune voci

**Sul calcolo temporale**

9. Rapporto di lavoro per l'intero anno, 365 giorni. Il motore accetta un numero di giorni diverso e ragguaglia, ma l'interfaccia non lo espone
10. Calcolo su base annua, non mese per mese: non sono modellati il conguaglio di fine anno né il fatto che il sostituto d'imposta lavori su reddito presunto
11. Le addizionali sono calcolate sull'anno corrente. Nella realtà c'è uno sfasamento di un anno: nel 2026 si trattiene il saldo dell'addizionale regionale 2025 in undici rate più l'acconto comunale 2026 al 30%. Semplificazione consapevole: l'utente vuole conoscere il carico fiscale dell'anno, non il flusso di cassa mensile

**Sulle mensilità**

12. Il numero di mensilità dipende dal CCNL. È un input con predefinito 13, perché è la scelta più diffusa e perché il netto mensile cambia sensibilmente
13. La tredicesima ha una tassazione propria, senza detrazioni applicate su di essa in busta paga: sulla somma annua non cambia nulla, sul singolo cedolino sì

**Sul lato azienda**

14. Contributi datore stimati come intervallo percentuale (28-32%, predefinito 30%), non calcolati per CCNL specifico
15. TFR calcolato come RAL/13,5, senza rivalutazione ISTAT né quota destinata al Fondo di Tesoreria
16. INAIL escluso dal calcolo predefinito e attivabile a parte: è la voce con la dispersione più alta (0,4-12% secondo la classe di rischio)

**Sul presupposto soggettivo e sulle convenzioni numeriche**

17. Si assume un lavoratore **privo di anzianità contributiva al 31 dicembre 1995**, unica ipotesi in cui opera il massimale di 122.295 € (art. 2 c. 18 L. 335/1995). Per chi ha contributi ante-1996 il massimale non si applica
18. Il motore lavora in centesimi, mentre le istruzioni dichiarative ragionano su redditi arrotondati all'unità di euro (da cui fasce scritte come «compreso tra euro 15.001 e 28.000»). Sulle soglie a gradino le due convenzioni possono divergere di pochi centesimi
19. Il trattamento integrativo è implementato nella sola diramazione principale (RC ≤ 15.000). La diramazione residuale per RC 15.001-28.000 riguarda impatriati, docenti e ricercatori, cedolare secca e mance, ed è verificata come **irraggiungibile** nel caso standard: a RC 15.001 la detrazione art. 13 vale 3.099,88 € contro un'imposta lorda di 3.450,23 €, quindi la differenza è già negativa e resta tale

---

## 5. Decisioni tecniche

**I parametri sono dato, non codice.** Nessuna costante numerica compare nei moduli di calcolo: tutto vive in `parametri-2026.json`, e ogni blocco porta con sé i campi `fonte` e `url`. Aggiungere `parametri-2027.json` a gennaio richiede una riga nel registro e nessuna modifica al motore. Per una payroll company il problema non è calcolare il 2026, è sopravvivere al cambio di normativa ogni anno.

**Le distinzioni concettuali sono campi, non commenti.** `modalita: "aliquotaUnicaSuInteroReddito"` sulla somma esente, `tipo: "esenzione" | "franchigia"` sull'addizionale comunale, `dovutaSoloSeIrpefDovuta` su entrambe le addizionali, `modalita: "progressivaPerScaglioni"` sulla regionale. Sono le quattro decisioni in cui i calcolatori online sbagliano, e nel motore diventano rami espliciti invece che assunzioni sepolte.

**Una sola forma algebrica per due detrazioni con fonti diverse.** Le quattro fasce dell'art. 13 e le quattro dell'ulteriore detrazione del cuneo sono scritte entrambe come `base + fattore × coefficiente`, e una sola funzione le valuta. Il troncamento a quattro decimali è però un **flag del singolo coefficiente**, non una regola globale: le istruzioni 730/2026 lo prescrivono per i rapporti dell'art. 13 (Tabella 6, nota 2) e non per il phase-out del comma 6, che in quelle istruzioni non compare nemmeno come formula. Estenderlo per analogia sarebbe stata un'assunzione nostra travestita da norma. È un buon esempio di come i dati abbiano ospitato una divergenza che il codice avrebbe dovuto ramificare. Impatto se un giorno si trovasse una fonte contraria: 0,10 €, e la modifica è un solo booleano.

**Un solo numero autorevole per concetto.** La prima fascia pensionabile è memorizzata solo su base annua e il valore mensile è derivato. Le soglie a gradino sono memorizzate in **imponibile** — la grandezza che la norma definisce — e la RAL corrispondente la calcola `ralPerImponibile()`. Un valore arrotondato che vive accanto a valori autorevoli e non va usato per calcolare non è documentazione, è una mina: `23.000 / 0,9081` vale 25.327,6071 e l'arrotondamento a 25.327,61 cade **oltre** la soglia, facendo misurare un salto di segno opposto. È successo davvero, ed è il motivo per cui il campo è stato rimosso.

**L'inversione imponibile → RAL è definita a tratti.** Non è una divisione per 0,9081: sopra i 56.224 € l'aliquota contributiva marginale cambia, sopra il massimale si azzera. La prima stesura aveva un errore di segno nel ramo intermedio, esatta sotto la prima fascia e sbagliata di oltre 1.100 € sopra. L'ha trovata un caso limite sui casi limite, non una rilettura.

**Piena precisione internamente, arrotondamento solo in presentazione.** Il motore lavora in `number` senza arrotondamenti intermedi; `arrotonda()` è half-up e non banker's rounding, perché chi legge una busta paga si aspetta che 0,005 diventi 0,01. Un motore mensile richiederebbe l'arrotondamento a ogni step, perché il sostituto d'imposta lavora in centesimi; con il calcolo annuale la scelta opposta è preferibile, e va dichiarata. I test di regressione hanno una tolleranza di un centesimo, che è esattamente la differenza fra le due convenzioni.

**Il troncamento a quattro decimali ha una trappola di floating point** e vive in una funzione sola, `troncaA()`. `(28.000 − 22.702,50) / 13.000` vale matematicamente 0,4075, ma il double più vicino a 0,4075 sta leggermente sotto: moltiplicato per 10.000 dà 4074,9999999999995, e un troncamento diretto restituisce 0,4074, sbagliando la detrazione di 12 centesimi. Non basta normalizzare il rapporto prima di troncarlo — la moltiplicazione per la scala reintroduce l'errore — la normalizzazione va fatta **dopo** lo scaling. Ha un test dedicato che documenta anche le due implementazioni sbagliate.

**Calcolo separato dalla presentazione.** `calcolaNumerico()` produce i numeri, `calcola()` ci aggiunge sopra la cascata con formule e fonti. La property di monotonia fa 125.000 valutazioni e la costruzione delle stringhe la rendeva venti volte più lenta.

**Niente framework di stato.** Lo stato dell'interfaccia è una RAL, un numero di mensilità e un risultato: tre `useState` in un componente. Redux o Zustand qui sarebbero cerimonia.

**Nessuna dipendenza di rete.** Il calcolo è client-side e deterministico. `npm run standalone` produce una pagina autoportante in un file solo — stessi componenti React, altro bootstrap — che funziona senza server e senza connessione.

---

## 6. Tre cose non ovvie emerse dalla modellazione

### 6.1 L'aliquota marginale effettiva non è monotona

Su un euro aggiuntivo di RAL, quanto **non** arriva in tasca:

| Fascia di imponibile | RAL corrispondente | Componenti | Marginale sulla RAL |
|---|---|---|---|
| 20.000 – 28.000 | 22.024 – 30.834 | 23% IRPEF + 9,15% phase-out art. 13 + 1,58% + 0,8% | **39,8 – 40,6%** |
| 28.000 – 32.000 | 30.834 – 35.238 | 33% + 8,68% + 1,72% + 0,8% | **49,3%** |
| **32.000 – 40.000** | **35.238 – 44.048** | 33% + 8,68% + **12,5% phase-out cuneo** + 1,72% + 0,8% | **60,7%** |
| 40.000 – 50.000 | 44.048 – 55.060 | 33% + 8,68% + 1,72% + 0,8% | **49,3%** |
| 50.000 – 51.057 | 55.060 – 56.224 | 43% + 1,73% + 0,8% | **50,5%** |
| oltre 51.057 | oltre 56.224 | 43% + 1,73% + 0,8%, contributi al 10,19% | **51,1%** |

Esiste una fascia — tra circa 35.240 e 44.050 € di RAL — in cui un aumento viene tassato al ~61%, **più che nella fascia immediatamente superiore**. Il phase-out simultaneo di due agevolazioni, la detrazione dell'art. 13 e l'ulteriore detrazione del cuneo, crea una gobba.

Per un'azienda che deve decidere gli aumenti la conseguenza è concreta: in quella fascia 1.000 € di RAL in più costano 1.374 € e ne fanno arrivare in tasca 393. Sopra la gobba, gli stessi 1.374 € ne fanno arrivare 507.

La curva mostrata dall'interfaccia è calcolata numericamente dal motore per differenze finite su incrementi di 100 €. Non c'è un solo valore precalcolato.

### 6.2 Il sistema è costruito a gradini, e non solo in un punto

Il caso più noto è l'esenzione dall'addizionale comunale di Milano, che **non è una franchigia**: superata la soglia il tributo si applica sull'intero reddito e non sulla sola eccedenza, con un salto secco di 184 €. Mappando il netto a passo di un centesimo su tutto il dominio si scopre che non è una particolarità milanese: è la forma normale con cui sono scritte queste soglie, e nel modello se ne contano **sette**.

| Imponibile | RAL | Salto | Meccanismo |
|---|---|---|---|
| 8.173,91 *(derivata)* | 9.001,12 | **+1.200,00** | L'imposta lorda supera la detrazione art. 13 meno la franchigia di 75 €: scatta il trattamento integrativo |
| 8.500,00 | 9.360,20 | **−257,55** | La somma esente scende dal 7,1% al 5,3% sull'intero reddito (−153,00) **e** l'IRPEF netta diventa positiva, rendendo dovuta l'addizionale regionale su tutto l'imponibile (−104,55) |
| 15.000,00 | 16.518,00 | **−130,00** | Cessa il trattamento integrativo (−1.200,00), la detrazione art. 13 passa da 1.955 a 3.100 € (+1.145,00), la somma esente scende al 4,8% (−75,00) |
| 20.000,00 | 22.024,01 | **+40,00** | La somma esente del comma 4 cede all'ulteriore detrazione del comma 6 |
| 23.000,00 | 25.327,61 | **−184,00** | Cessa l'esenzione dall'addizionale comunale di Milano |
| 25.000,00 | 27.530,01 | **+65,00** | Scatta la maggiorazione di 65 € della detrazione art. 13 |
| 35.000,00 | 38.542,01 | **−65,00** | Cessa la stessa maggiorazione |

Quattro osservazioni:

- **Ci sono due famiglie di soglia.** Quelle *reddituali*, in cui superato un livello di reddito il beneficio compare o cessa; e quelle *di capienza*, in cui è il rapporto fra imposta lorda e detrazioni a far scattare l'effetto. Le due addizionali diventano dovute sull'intero imponibile nel momento in cui l'IRPEF netta passa da zero a positiva, per due norme gemelle (art. 50 D.Lgs. 446/1997 e art. 1 D.Lgs. 360/1998).
- **La stessa norma è un regalo e una penalità.** L'art. 13 co. 1.1 produce +65 € a RAL 27.530 e −65 € a 38.542: due gradini opposti generati dallo stesso comma, a undicimila euro di distanza.
- **La soglia a 8.500 € è doppia.** Due meccanismi diversi scattano nello stesso punto per coincidenza aritmetica. Un modello che ne implementasse solo uno produrrebbe metà del gradino e sembrerebbe comunque plausibile.
- **Una sola soglia non è scritta nella norma come cifra.** L'attivazione del trattamento integrativo cade dove si incrociano tre parametri: `(1.955 − 75) / 0,23 = 8.173,91`. Il file dei parametri dichiara la regola di derivazione invece del numero, così un cambio di aliquota non la lascia silenziosamente sbagliata.

### 6.3 La correttezza viene dal ciclo, non dalla prima stesura

Il dossier normativo è stato scritto per primo, come ricerca autonoma sulle fonti, e l'implementazione lo ha **falsificato in cinque punti**:

1. un coefficiente non troncato, dove le istruzioni prescrivono le prime quattro cifre decimali
2. una franchigia mancante di 75 € nella condizione di capienza del trattamento integrativo
3. un minimo di detrazione applicato a una fascia sbagliata
4. una fascia percentuale con un tetto che nel testo di legge non esiste
5. una condizione di debenza attribuita a una sola delle due addizionali

Ogni correzione è stata riverificata sulla fonte primaria prima di entrare nel modello. **Tre di quei cinque errori sono stati scoperti dai test di regressione prima che il codice del motore fosse scritto**, semplicemente ricalcolando a mano i casi di riferimento sotto convenzioni diverse.

Il dossier porta in fondo una sezione **Revisioni** che elenca le tredici modifiche con la ragione di ciascuna. Presentare un modello come se fosse nato perfetto sarebbe stato più semplice e meno vero.

---

## 7. Test

197 test in cinque file. Il motore è puro, quindi girano in Node senza ambiente browser.

```bash
npm test
```

- **`casi-riferimento.test.ts`** — i tre casi del dossier (RAL 25.000 / 35.000 / 60.000) verificati **voce per voce**, non solo sul netto finale, con tolleranza di un centesimo dichiarata e motivata
- **`casi-limite.test.ts`** — tutti i casi limite: 23.000,00 contro 23.000,01, i confini di scaglione, l'azzeramento della detrazione sopra 50.000, il passaggio somma esente → ulteriore detrazione, il phase-out del cuneo, la maggiorazione di 65 €, l'attivazione dell'1% INPS, il massimale, le RAL basse con IRPEF netta a zero, e gli input non validi (negativo, zero, stringa vuota, NaN, infinito, valori assurdi)
- **`numerico.test.ts`** — la trappola di floating point del troncamento, l'arrotondamento half-up, le scale progressive, il round-trip dell'inversione contributiva su tutti e tre i rami
- **`monotonia.test.ts`** — la property, in due metà
- **`marginale-costo.test.ts`** — la gobba, la vista costo azienda, gli avvisi di prossimità alle soglie

**La property di monotonia è falsa come enunciato assoluto, ed è corretto che lo sia.** Il test non la allenta con una tolleranza generosa — nasconderebbe l'informazione più interessante del modello — ma la sdoppia:

1. **monotonia a tratti** — il netto cresce ovunque, tranne nelle quattro soglie che lo fanno scendere
2. **ampiezza dei gradini** — in tutte e sette le soglie il salto ha il segno dichiarato e l'ampiezza prevista, entro tolleranza, e i suoi componenti sommano al totale

La seconda copre anche le quattro della prima, e chiude un buco reale: i tre gradini favorevoli non violano la monotonia, quindi senza di essa nessuna asserzione li sorveglierebbe. Verificato con una mutazione controllata: portando la maggiorazione dell'art. 13 da 65 a 60 € cadono entrambe le soglie che ne dipendono; prima dello sdoppiamento sarebbe caduta solo quella negativa.

**La tolleranza vale 0,20 € e ha una derivazione.** Il troncamento del coefficiente introduce una scalinata: il coefficiente scende a scatti di 0,0001, quindi la detrazione scende a scatti di 0,119 € nella fascia 15.000-28.000 e di 0,191 € in quella 28.000-50.000. Il netto non è strettamente crescente nemmeno lontano dalle soglie. Non è un bug, è l'aritmetica della norma, ed è fissata in un test dedicato invece che nascosta sotto una tolleranza scelta a occhio.

Se una di queste asserzioni cade, non è il test da aggiustare: o è cambiata la norma, o è rotto il motore.

---

## 8. Limiti noti e roadmap

1. **Motore mensile** invece che annuale, con conguaglio di dicembre e gestione del reddito presunto
2. **Multi-anno**: la struttura dei parametri è già versionata per anno d'imposta; manca il confronto 2025 contro 2026, che mostrerebbe l'effetto del taglio al 33%
3. **Tutti i comuni e le regioni**: import automatico della banca dati MEF, con gestione dei comuni che deliberano a scaglioni e delle soglie di esenzione condizionali (ISEE, nucleo familiare). Il campo `esenzione.tipo` distingue già esenzione da franchigia, quindi il motore è pronto
4. **Familiari a carico** (art. 12 TUIR, con la disciplina rivista dal D.Lgs. 192/2024) e Assegno Unico
5. **Calcolo inverso**: dal netto desiderato alla RAL da offrire, che è il caso d'uso reale di un recruiter. `ralPerImponibile()` è già scritta corretta su tutti e tre i rami proprio in vista di questo
6. **Welfare e fringe benefit**: mostrare che 1 € di welfare vale circa 1,5 € di aumento lordo a parità di costo azienda
7. **Rapporti infrannuali**: il motore accetta già `giorniLavorati` e implementa il meccanismo a due tempi del comma 5 della L. 207/2024, ma l'interfaccia non lo espone e il ragguaglio dell'ulteriore detrazione del cuneo non è verificato su fonte primaria
8. **Validazione contro cedolini reali** invece che contro altri calcolatori online, che come si è visto sbagliano

---

## 9. Interfaccia

L'impianto visivo viene da un design costruito su Claude Design e portato nei componenti React uno a uno: fondo carta `#EFEBE3`, sezioni di apertura e chiusura su `#14120F`, un solo accento oro `#C8A15A`, Instrument Serif per i numeri che contano e IBM Plex Mono per quelli che devono incolonnarsi.

Il grafico e' disegnato in SVG a mano invece che con una libreria: la linea deve **interrompersi** sulle soglie invece di collegarle, la banda della gobba e' un riferimento e non una serie, e le tacche degli assi vivono in HTML fuori dall'SVG per restare leggibili a qualunque larghezza. Il risultato pesa meno della meta' della versione con una libreria di grafici.

Il design nasce su tela desktop, con margine laterale fisso e minimi di griglia a 340px. Sotto i 720px quei due valori diventano fluidi e i filetti verticali fra colonne affiancate si ricompongono in orizzontali; sopra i 720px non cambia un pixel.

Il grafico dell'aliquota marginale interrompe la linea sulle sette soglie: una finestra di campionamento da 100 € che contiene il gradino da 184 € dell'addizionale comunale produce una marginale del 224%, e un asse che arrivasse fin lì schiaccerebbe tutto il resto in una banda di due millimetri. Le discontinuità sono marcate a parte, in rosso quando il netto scende e in verde quando sale.

Quando la RAL inserita cade entro 500 € da una soglia, l'interfaccia lo segnala. Il tono resta **descrittivo**: si dice dove sta la soglia e cosa succede attraversandola, non cosa converrebbe chiedere. Un calcolatore che dà consigli deve essere molto sicuro di quello che dice, e questo non lo è abbastanza.

La RAL di soglia mostrata all'utente è arrotondata **per eccesso**, in entrambe le direzioni del salto. È la scelta conservativa in tutti e due i casi: su una soglia negativa evita di far scattare l'avviso a chi non l'ha ancora raggiunta, su una positiva evita di promettere un beneficio non ancora maturato. Resta una finestra cieca larga meno di un euro, ma il calcolo del netto non passa mai di lì: quel valore è solo l'etichetta.

Il delta marginale su 1.000 € non coincide sempre con l'aliquota marginale del grafico, perché una finestra così ampia può attraversare un cambio di regime. Quando succede, l'interfaccia lo dice invece di lasciare due numeri in apparente contraddizione.
