# Dossier normativo — Da RAL a netto (anno d'imposta 2026)

**Task Jet HR — Product Builder**
Caso standard: impiegato, tempo indeterminato, residente a Milano (Lombardia), nessuna agevolazione, nessun familiare a carico.

Questo documento è la base di conoscenza da cui derivare il motore di calcolo e il file di parametri. Ogni valore ha la sua fonte. Le semplificazioni sono dichiarate esplicitamente in fondo.

---

## 1. La catena di calcolo

L'errore più comune è pensare che "netto = lordo − tasse". In realtà ci sono **due basi imponibili diverse** e le detrazioni agiscono sull'imposta, non sul reddito. La sequenza corretta è:

```
RAL (retribuzione annua lorda)
 │
 ├─(1)─ − Contributi previdenziali a carico lavoratore (IVS)
 │
 ▼
IMPONIBILE FISCALE (= "reddito complessivo" nel caso standard)
 │
 ├─(2)─ × Aliquote IRPEF per scaglioni ──────────► IRPEF LORDA
 │                                                   │
 │      (3) − Detrazione lavoro dipendente (art.13)  │
 │      (4) − Ulteriore detrazione "cuneo" (c.6)     │
 │                                                   ▼
 │                                              IRPEF NETTA  (min. 0)
 │
 ├─(5)─ × Aliquote addizionale regionale Lombardia ─► ADD. REGIONALE
 ├─(5)─ × Aliquota addizionale comunale Milano ─────► ADD. COMUNALE
 │
 └─(6)─ + Somma esente "cuneo" (c.4), se spettante  [NON è imposta: si somma al netto]

NETTO ANNUO = RAL − contributi − IRPEF netta − addizionali + somma esente
NETTO MENSILE = NETTO ANNUO / mensilità (12, 13 o 14)
```

**Punto chiave da capire bene:** i contributi sono *oneri deducibili* (riducono la base su cui si calcola l'imposta), le detrazioni sono *sconti d'imposta* (riducono l'imposta già calcolata). A parità di importo una detrazione vale molto più di una deduzione. Le addizionali si calcolano sull'imponibile fiscale e **non hanno detrazioni proprie**.

---

## 2. Parametri 2026 con fonti

### 2.1 Contributi previdenziali (INPS)

| Parametro | Valore 2026 | Fonte |
|---|---|---|
| Aliquota IVS a carico lavoratore (FPLD, settore privato) | **9,19%** | Ripartizione ordinaria del 33% IVS: 23,81% datore + 9,19% lavoratore |
| Aliquota aggiuntiva sulla quota eccedente la prima fascia | **+1%** | Art. 3-*ter*, D.L. 384/1992 conv. L. 438/1992 |
| Prima fascia di retribuzione pensionabile | **€ 56.224,00** (mensile € 4.685) | Circolare INPS n. 6 del 30/01/2026 |
| Massimale annuo base contributiva e pensionabile | **€ 122.295,00** | Circolare INPS n. 6 del 30/01/2026 (art. 2 c. 18 L. 335/1995) |
| Minimale retribuzione giornaliera | € 58,13 | Circolare INPS n. 6/2026 |
| Trattamento minimo mensile pensione FPLD | € 611,85 | Circolare INPS n. 6/2026 |

> Rivalutazione 2026 basata su variazione ISTAT +1,4% registrata nel 2025.

**Formula:**
```
contributi = 0,0919 × min(RAL, massimale)
           + 0,0100 × max(0, min(RAL, massimale) − 56.224)
```
Sopra i 56.224 € l'aliquota marginale sui contributi diventa quindi **10,19%**.

*Fonti:*
- INPS, Circolare n. 6 del 30 gennaio 2026 — https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html
- INPS, notizia di sintesi — https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.lavoratori-dipendenti-limite-minimo-di-retribuzione-giornaliera-2026.html

---

### 2.2 Scaglioni e aliquote IRPEF 2026

| Scaglione | Aliquota |
|---|---|
| fino a € 28.000 | **23%** |
| oltre € 28.000 e fino a € 50.000 | **33%** ← *novità 2026* |
| oltre € 50.000 | **43%** |

**Novità normativa:** la Legge di Bilancio 2026 (**L. 30 dicembre 2025, n. 199, art. 1 comma 3**, in G.U. n. 301 del 30/12/2025) ha modificato l'art. 11 co. 1 lett. b) TUIR sostituendo l'aliquota del 35% con il **33%**, con effetto dal 1° gennaio 2026. Risparmio massimo: **440 €/anno** (2% × ampiezza dello scaglione di 22.000 €).

⚠️ **Attenzione alla trappola temporale:** il 730/2026 riguarda i redditi 2025 e applica ancora il 35%. Il 33% si vede in busta paga dal gennaio 2026 e in dichiarazione solo nel 730/2027. Un calcolatore "anno d'imposta 2026" deve usare il 33%.

*Fonti:*
- Agenzia delle Entrate, scheda "Aliquote e calcolo dell'Irpef" — https://www.agenziaentrate.gov.it/portale/imposta-sul-reddito-delle-persone-fisiche-irpef-/aliquote-e-calcolo-dell-irpef
- L. 199/2025 art. 1 co. 3 (Normattiva)

---

### 2.3 Detrazione per redditi di lavoro dipendente (art. 13 co. 1 TUIR)

Sia `RC` = reddito complessivo (= imponibile fiscale nel caso standard).

| Fascia | Formula |
|---|---|
| RC ≤ 15.000 | **1.955 €** |
| 15.000 < RC ≤ 28.000 | **1.910 + 1.190 × (28.000 − RC) / 13.000** |
| 28.000 < RC ≤ 50.000 | **1.910 × (50.000 − RC) / 22.000** |
| RC > 50.000 | **0** |

**Maggiorazione (art. 13 co. 1.1 TUIR):** + **65 €** se 25.000 < RC ≤ 35.000.

**Troncamento del coefficiente (rev. 2):** il risultato dei rapporti `(28.000 − RC)/13.000` e `(50.000 − RC)/22.000` **si assume nelle prime 4 cifre decimali**. Verificato sulla fonte primaria: istruzioni modello 730/2026, Tabella 6, nota (2) — *"Se il risultato dei rapporti è maggiore di 0, lo stesso si assume nelle prime 4 cifre decimali"*. La stessa nota compare identica nelle Tabelle 7 (pensioni) e 8 (redditi assimilati). Il testo dell'Agenzia non usa la parola "troncamento": *assumere nelle prime 4 cifre decimali* significa prendere le prime quattro e scartare il resto, cioè troncare, ma la parola non compare — è un'interpretazione pacifica, non una citazione.

**Minimi (art. 13 co. 1 lett. a):** la detrazione effettivamente spettante non può essere inferiore a **690 €** per i rapporti a **tempo indeterminato** e a **1.380 €** per quelli a **tempo determinato** (formulazione della nota (3) alla Tabella 6 del 730/2026). Il minimo è agganciato alla **sola fascia RC ≤ 15.000** e opera **dopo** il ragguaglio ai giorni: non è un pavimento globale sulla detrazione e in particolare **non si applica sopra i 50.000 € di RC**, dove la detrazione è semplicemente zero.

> ⚠️ Diverse guide online invertono i due minimi (attribuendo 1.380 € al tempo indeterminato). Il testo dell'art. 13 co. 1 lett. a) TUIR è chiaro: 690 € è il minimo generale, 1.380 € è il minimo *maggiorato* per il tempo determinato. Nel nostro caso standard (tempo indeterminato, anno intero) i minimi non mordono comunque mai.

**Ragguaglio ai giorni:** la detrazione va rapportata al periodo di lavoro nell'anno (`× giorni/365`), includendo festività e riposi settimanali. Nel caso standard assumiamo 365 giorni, quindi il ragguaglio vale 1,0000 e non morde mai. Il troncamento alle prime quattro cifre decimali è la stessa regola del coefficiente (vedi sotto): il ragguaglio ne è un'applicazione, non l'unica.

**Nota controintuitiva da segnalare nella UI:** nella fascia 15.001–28.000 la formula produce valori *superiori* a 1.955 €. Con RC = 15.001 la detrazione teorica è circa 3.100 €, ma l'IRPEF lorda a quel livello è solo 3.450 €, quindi la detrazione non può comunque superarla (l'imposta si azzera, non si genera credito rimborsabile).

*Fonti:* art. 13 TUIR (D.P.R. 917/1986); D.Lgs. 216/2023; L. 207/2024.

---

### 2.4 Taglio del cuneo fiscale (L. 207/2024 art. 1 commi 4–9)

Dal 2025 il cuneo **non è più un esonero contributivo**: i contributi INPS si versano per intero (la posizione previdenziale resta piena) e il beneficio arriva per via fiscale. Reso strutturale e confermato per il 2026.

Sono **due misure alternative**, mai cumulabili tra loro:

**(a) Somma esente — art. 1 comma 4** (per RC ≤ 20.000)

Non concorre alla formazione del reddito imponibile. Si calcola applicando **una sola percentuale all'intero reddito di lavoro dipendente**:

| Reddito di lavoro dipendente | Percentuale |
|---|---|
| ≤ 8.500 € | 7,1% |
| > 8.500 e ≤ 15.000 € | 5,3% |
| > 15.000 € *(senza limite superiore — vedi nota)* | 4,8% |

> 🔴 **ERRORE DIFFUSO NELLE FONTI SECONDARIE.** Numerose guide online (anche molto lette) calcolano questa somma *a scaglioni*, come se fosse l'IRPEF: es. "18.000 € → 8.500×7,1% + 6.500×5,3% + 3.000×4,8% = 1.092 €". **È sbagliato.** La norma dice "nella misura pari a: 7,1% *se* il reddito non è superiore a 8.500; 5,3% *se* superiore a 8.500 ma non a 15.000; 4,8% *se* superiore a 15.000". È un'aliquota unica sulla fascia di appartenenza: **18.000 × 4,8% = 864 €**. Differenza: 228 €.
> Questo è il tipo di dettaglio da verificare sempre sulla fonte primaria (testo di legge + Certificazione Unica + circolare AdE), mai sui blog.

> **Rev. 2 — la terza fascia non ha tetto.** Le istruzioni 730/2026 (rigo C14) recitano: *"c) 4,8 per cento, se il reddito di lavoro dipendente è superiore a 15.000 euro"*, punto. Il limite di 20.000 € è una condizione di **spettanza sul reddito complessivo**, non un estremo della fascia percentuale sul **reddito di lavoro dipendente**. Nella prima stesura le due grandezze erano collassate nella stessa tabella — esattamente l'asimmetria che questa sezione segnala poche righe più sotto. Nel caso standard coincidono e il risultato non cambia; con un secondo reddito divergono.
>
> **Rev. 2 — il comma 5 impone un meccanismo a due tempi.** Testo di legge: *"Ai soli fini dell'individuazione della percentuale applicabile ai sensi del comma 4 il reddito di lavoro dipendente è rapportato all'intero anno"* (L. 207/2024 art. 1 c. 5). Quindi:
>
> 1. si **annualizza** il reddito di lavoro dipendente per stabilire in quale fascia si cade (7,1 / 5,3 / 4,8%)
> 2. si applica quella percentuale al reddito **effettivamente percepito**, non a quello annualizzato
>
> L'esempio della Circolare AdE n. 4/E del 16 maggio 2025 lo rende inequivocabile: 3.000 € percepiti in 92 giorni danno un reddito annuale teorico di 11.902,17 €, quindi fascia b) al 5,3%, ma la somma spettante è **159 € = 5,3% × 3.000**, non 5,3% × 11.902,17 (che darebbe 630,82 €, quattro volte tanto).
>
> Nel caso standard a 365 giorni le due grandezze coincidono e il risultato non cambia, ma sono modellate come campi separati (`redditoAnnualizzatoPerFascia` e `redditoEffettivo`) perché con i rapporti infrannuali divergono, ed è molto più economico distinguerle adesso che riscrivere il modulo dopo.
>
> **Che cosa siano i "giorni di lavoro dipendente" al denominatore** è chiarito dalla **Risposta AdE n. 7/2026 del 16 gennaio 2026**, recuperata e letta integralmente: vi rientrano festività, riposi settimanali e altri giorni non lavorativi, ma *"vanno sottratti i giorni per i quali non spetta alcun reddito, neppure sotto forma di retribuzione differita"* (per esempio le aspettative senza assegni). In presenza di più rapporti, i giorni compresi in periodi contemporanei si contano una volta sola. Se in tutto l'anno non ci sono giorni retribuiti, la somma non spetta. La risposta **non aggiunge vincoli sul caso standard** a 365 giorni.

Precisazione della **Circolare AdE n. 4 del 16 maggio 2025**: la percentuale si applica solo al reddito *imponibile*, esclusa l'eventuale quota esente (rileva per impatriati/cervelli in rientro — fuori dal nostro caso standard).

**(b) Ulteriore detrazione — art. 1 comma 6** (per 20.000 < RC ≤ 40.000)

| Fascia | Importo |
|---|---|
| 20.000 < RC ≤ 32.000 | **1.000 €** |
| 32.000 < RC ≤ 40.000 | **1.000 × (40.000 − RC) / 8.000** |
| RC > 40.000 | 0 |

Entrambe sono riservate ai titolari di reddito di lavoro dipendente ex art. 49 TUIR, **con esclusione dei pensionati**.

⚠️ **Asimmetria importante da modellare:** la soglia di spettanza si verifica sul **reddito complessivo**, ma la percentuale della somma esente si applica al **reddito di lavoro dipendente**. Sono due grandezze che nel caso standard coincidono, ma concettualmente vanno tenute distinte nel codice.

**Voci sul cedolino:** "Somma non imponibile art. 1 c. 4 L. 207/24" / "Ulteriore Detrazione Art. 1 c. 6 L. 207/24".

*Fonti:*
- L. 30 dicembre 2024, n. 207, art. 1 commi 4–9
- INPS, "CU 2026: benefici fiscali" + FAQ — https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.04.CU-2026--benefici-fiscali.html
- NoiPA (MEF), FAQ Taglio del cuneo fiscale — https://noipa.mef.gov.it/cl/en/taglio-del-cuneo-fiscale
- Istruzioni modello 730/2026, rigo C14 (provv. AdE 27 febbraio 2026)

---

### 2.5 Trattamento integrativo (D.L. 3/2020 art. 1 — ex "Bonus Renzi")

**1.200 €/anno** per RC ≤ 15.000, a condizione di capienza. Confermato per il 2026.

**Rev. 2 — la condizione di capienza ha una franchigia di 75 €, e la misura è implementata nel motore** (non più fuori scope). Formulazione delle istruzioni 730/2026, Sezione V, rigo C14:

> *"è riconosciuto nella misura di 1.200 euro ai lavoratori la cui **imposta lorda, determinata tenendo conto solo dei redditi da lavoro dipendente e di alcuni assimilati, sia di importo superiore alle detrazioni per lavoro dipendente, diminuite dell'importo di 75 euro rapportato al periodo di lavoro nell'anno** e il cui reddito complessivo non sia superiore a 15.000 euro."*

La condizione è dunque `imposta lorda > (detrazione art. 13 − 75 €)`, non `> detrazione art. 13`. La franchigia sposta la soglia di attivazione da RC 8.500 a **RC 8.173,91** (RAL ≈ 9.001) e cambia la mappa delle discontinuità: vedi §8.

Due grandezze da tenere distinte nei tipi, anche se nel caso standard coincidono:

- l'**imposta lorda sui soli redditi di lavoro dipendente e assimilati** — quella della condizione — diversa dall'imposta lorda complessiva
- il **reddito complessivo** (≤ 15.000), diverso dal reddito di lavoro dipendente

**Cumulabilità:** trattamento integrativo e somma esente del cuneo (art. 1 c. 4 L. 207/2024) **sono cumulabili**: sotto i 15.000 € spettano entrambi. Alternative tra loro sono soltanto somma esente e ulteriore detrazione (c. 4 contro c. 6).

**Seconda diramazione, dichiarata fuori scope:** per RC ricalcolato tra 15.001 e 28.000 le istruzioni prevedono un TI residuale pari a `min(1.200, somma di alcune detrazioni − imposta lorda)`. Riguarda impatriati, docenti e ricercatori, cedolare secca e mance, casi che non modelliamo. Verificato che **nel caso standard non può mai attivarsi**: a RC = 15.001 la detrazione art. 13 vale 3.099,88 € contro un'imposta lorda di 3.450,23 €, quindi la differenza è già negativa e resta tale al crescere del reddito.

---

### 2.6 Addizionale regionale IRPEF — Lombardia 2026

Fonte primaria: **MEF — Dipartimento delle Finanze, banca dati addizionale regionale, Regione Lombardia (cod. 10), data di pubblicazione 28-GEN-2026.**

| Fascia | Aliquota |
|---|---|
| fino a € 15.000 | **1,23%** |
| oltre 15.000 e fino a 28.000 | **1,58%** |
| oltre 28.000 e fino a 50.000 | **1,72%** |
| oltre 50.000 | **1,73%** |

Norma di riferimento: **art. 72, comma 1, L.R. Lombardia 14 luglio 2003, n. 10**.

**Applicazione progressiva per scaglioni** (come l'IRPEF), non aliquota unica sulla fascia. È una distinzione reale: alcune regioni usano l'aliquota unica per fascia, altre la progressione. Errore da evitare.

**Perché gli scaglioni regionali non coincidono con i nuovi scaglioni IRPEF:** la Legge di Bilancio 2026 ha prorogato **fino al 2028** la facoltà per le Regioni di mantenere le addizionali basate sui *vecchi* scaglioni IRPEF vigenti prima della L. 207/2024. La Lombardia ha scelto di non adeguarsi. Da qui la doppia struttura di scaglioni nel calcolatore.

*Fonti:*
- MEF/DF — https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=10
- Regione Lombardia — https://www.regione.lombardia.it/bollo-auto-e-tributi-regionali/red-addizionale-regionale-irpef

---

### 2.7 Addizionale comunale IRPEF — Milano 2026

Fonte primaria: **MEF/DF, banca dati addizionale comunale, comune di MILANO (cod. catastale F205).**

| Aliquota | Fascia di applicazione |
|---|---|
| **0%** | Esenzione per redditi imponibili fino a **€ 23.000,00** |
| **0,8%** | Aliquota unica |

🔍 **Verifica non banale:** interrogando la banca dati alla voce **anno 2026** il portale restituisce *"Non ci sono dati per il comune selezionato"*. Milano **non ha pubblicato una nuova delibera per il 2026**. L'ultimo dato disponibile è la delibera n. 46 del 28/09/2020, confermata con pubblicazione del **20/12/2025** per l'anno 2025. In assenza di nuova delibera restano in vigore le aliquote dell'anno precedente: **0,8% con esenzione fino a 23.000 €**.

⚠️ **È esenzione, non franchigia.** Per l'art. 1 D.Lgs. 360/1998: se il reddito imponibile **supera** la soglia, l'addizionale si applica **sull'intero reddito complessivo**, non solo sull'eccedenza. Questo crea una **discontinuità netta di 184 €** al superamento della soglia. Confermato anche dal Comune di Milano: *"L'esenzione non equivale a franchigia."*

**Ulteriore condizione:** l'addizionale comunale è dovuta **solo se per lo stesso anno risulta dovuta l'IRPEF** al netto delle detrazioni. Se l'IRPEF netta è zero, l'addizionale comunale non si applica.

**Domicilio fiscale:** rileva la situazione al **1° gennaio** dell'anno d'imposta.

*Fonti:*
- MEF/DF — https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/risultato.htm?anno=9999&lista=1&pagina=lombardia.htm&cm=&pr=MI&cc=F205&r=1
- MEF/DF, "Disciplina del tributo" — https://www.finanze.gov.it/it/fiscalita/fiscalita-regionale-e-locale/Addizionale-comunale-allIRPEF/disciplina-del-tributo/
- Comune di Milano, FAQ esenzioni — https://servizicrm.comune.milano.it/centro-supporto/KA-01737/Esenzioni-addizionale-comunale-IRPEF

---

### 2.8 Lato datore di lavoro (per la vista "costo azienda")

| Voce | Valore |
|---|---|
| IVS a carico datore | 23,81% (parte della quota complessiva del 33%) |
| Contributi datore complessivi (IVS + NASpI, CIG, ANF, maternità, malattia) | ~28–32% secondo CCNL, settore, dimensione aziendale |
| TFR — quota lorda annua maturata (art. 2120 c.c.) | RAL / 13,5 = **7,4074%** |
| TFR — contributo aggiuntivo detratto dalla quota (art. 3 u.c. L. 297/1982) | **0,50%** — è IVS, già dentro i contributi datore |
| TFR — **quota netta stimata**, quella che entra nel costo azienda | 7,4074% − 0,50% = **6,9074%** |
| Fondo di Garanzia TFR (art. 2 c. 8 L. 297/1982) | **0,20%** (0,40% dirigenti industriali) — voce distinta, già nei contributi datore |
| INAIL | 0,4%–12% secondo classe di rischio (ufficio ≈ 0,4%) |

> 🔴 **Rev. 3 — lo 0,50% NON è il Fondo di Garanzia, e la Rev. 2 sbagliava.** La Rev. 2 identificava lo 0,50% detratto dalla quota TFR con il contributo al Fondo di Garanzia INPS. Sono **due voci distinte**, con fonte, aliquota e natura diverse:
>
> | Voce | Aliquota | Natura | Fonte |
> |---|---|---|---|
> | Contributo aggiuntivo detratto dal TFR | **0,50%** | Maggiorazione dell'aliquota **IVS a carico datore** (0,30% dal 1° luglio 1982 + 0,20% dal 1° gennaio 1983), che il datore detrae dalla quota TFR | art. 3, ultimo comma, L. 297/1982 |
> | Contributo al Fondo di Garanzia TFR | **0,20%** | Contributo **autonomo** alla Gestione Prestazioni Temporanee (0,40% per i dirigenti industriali) | art. 2 c. 8 L. 297/1982; portale INPS |
>
> **Conseguenza sul calcolo: c'era un doppio conteggio.** Essendo IVS, lo 0,50% è già compreso nel ~30% dei contributi a carico del datore. Sommare al costo aziendale anche la quota TFR **lorda** del 7,4074% lo contava una seconda volta. Il costo azienda usa quindi la quota **netta**:
>
> ```
> quota TFR netta = 1/13,5 − 0,50% = 7,4074% − 0,50% = 6,9074%
> costo azienda   = RAL × (1 + 30% + 6,9074%) = RAL × 1,3691
> ```
>
> Anche il Fondo di Garanzia allo 0,20% è già dentro i contributi datore e non va sommato a parte.
> *Fonti:* art. 2120 c.c.; art. 3 ultimo comma L. 297/1982; art. 2 c. 8 L. 297/1982.

Regola pratica: **costo azienda ≈ RAL × 1,35–1,40** per un impiegato d'ufficio. Con i default del calcolatore (contributi datore 30%, quota TFR netta 6,9074%, INAIL escluso) il moltiplicatore è **1,3691**, cioè il **36,91%** in più della RAL.

Resta una **stima**: contributi datore, INAIL e trattamento del TFR dipendono da CCNL, settore e dimensione aziendale.

Da modellare come *range configurabile*, non come numero secco: è una stima, e dichiararlo come tale è più credibile che fingere precisione.

---

## 3. Casi di riferimento (da usare come test)

Assunzioni: Milano/Lombardia, tempo indeterminato, 365 giorni, nessun carico di famiglia, 13 mensilità.

> **Rev. 2** — valori ricalcolati con troncamento del coefficiente art. 13 alle prime quattro cifre decimali e piena precisione altrove (arrotondamento a 2 decimali solo in output). I casi 25.000 e 60.000 sono **invariati** rispetto alla prima stesura; il caso 35.000 cambia di 3 centesimi. Dettaglio in §8.

### RAL 25.000 €
| Voce | Importo |
|---|---|
| Contributi INPS (9,19%) | 2.297,50 |
| Imponibile fiscale | 22.702,50 |
| IRPEF lorda | 5.221,58 |
| Detrazione art. 13 | −2.394,93 |
| Ulteriore detrazione cuneo | −1.000,00 |
| **IRPEF netta** | **1.826,65** |
| Add. regionale Lombardia | 306,20 |
| Add. comunale Milano | **0,00** *(imponibile ≤ 23.000 → esente)* |
| **NETTO ANNUO** | **≈ 20.569,65** |
| Netto mensile (÷13) | ≈ 1.582 |

### RAL 35.000 €
| Voce | Importo |
|---|---|
| Contributi INPS (9,19%) | 3.216,50 |
| Imponibile fiscale | 31.783,50 |
| IRPEF lorda | 7.688,56 |
| Detrazione art. 13 (1.581,48 + 65) | −1.646,48 |
| Ulteriore detrazione cuneo | −1.000,00 |
| **IRPEF netta** | **5.042,08** |
| Add. regionale Lombardia | 454,98 |
| Add. comunale Milano (0,8%) | 254,27 |
| **NETTO ANNUO** | **≈ 26.032,18** |
| Netto mensile (÷13) | ≈ 2.002 |

### RAL 60.000 € (sopra la prima fascia pensionabile)
| Voce | Importo |
|---|---|
| Contributi INPS (9,19% + 1% sull'eccedenza di 56.224) | 5.551,76 |
| Imponibile fiscale | 54.448,24 |
| IRPEF lorda | 15.612,74 |
| Detrazione art. 13 | 0 *(RC > 50.000)* |
| Cuneo | 0 *(RC > 40.000)* |
| **IRPEF netta** | **15.612,74** |
| Add. regionale Lombardia | 845,25 |
| Add. comunale Milano (0,8%) | 435,59 |
| **NETTO ANNUO** | **≈ 37.554,66** |
| Netto mensile (÷13) | ≈ 2.889 |

### Casi limite obbligatori nei test
| Caso | Cosa verifica |
|---|---|
| Imponibile = 23.000,00 vs 23.000,01 | Salto di 184 € sull'add. comunale (esenzione ≠ franchigia) |
| Imponibile = 28.000,00 | Confine primo/secondo scaglione IRPEF + cambio formula detrazione |
| Imponibile = 50.000,00 vs 50.000,01 | Azzeramento detrazione art. 13 + terzo scaglione |
| Imponibile = 20.000,00 vs 20.000,01 | Passaggio somma esente → ulteriore detrazione |
| Imponibile = 32.000 e = 40.000 | Inizio e fine del phase-out del cuneo |
| RC = 25.000,01 e = 35.000,00 | Maggiorazione di 65 € |
| RAL = 56.224 vs 56.225 | Attivazione dell'1% aggiuntivo INPS |
| RAL = 130.000 | Massimale contributivo (122.295) |
| RAL molto bassa | IRPEF netta non può andare sotto zero |

---

## 4. L'insight di prodotto: l'aliquota marginale non è monotona

Modellando correttamente le formule emerge un comportamento che nessun calcolatore "da blog" mostra.

**Aliquota marginale effettiva su un euro aggiuntivo di RAL:**

| Fascia di imponibile | RAL corrispondente | Componenti (sull'imponibile) | Marginale effettiva **sulla RAL** |
|---|---|---|---|
| 20.000 – 28.000 | 22.024 – 30.834 | 23% IRPEF + 9,15% (phase-out detr. art. 13) + 1,58% + 0,8% | **39,8 – 40,6%** |
| 28.000 – 32.000 | 30.834 – 35.238 | 33% + 8,68% + 1,72% + 0,8% | **49,3%** |
| **32.000 – 40.000** | **35.238 – 44.048** | 33% + 8,68% + **12,5% (phase-out cuneo)** + 1,72% + 0,8% | **60,7%** |
| 40.000 – 50.000 | 44.048 – 55.060 | 33% + 8,68% + 1,72% + 0,8% | **49,3%** |
| 50.000 – 51.057 | 55.060 – 56.224 | 43% + 1,73% + 0,8% | **50,5%** |
| oltre 51.057 | oltre 56.224 | 43% + 1,73% + 0,8%, contributi al 10,19% | **51,1%** |

> **Rev. 2 — due correzioni.** (a) Nella prima stesura le righe "28.000–32.000" e "40.000–50.000" elencavano gli stessi componenti ma riportavano totali diversi (48% e 49%): era un refuso, il valore corretto è **49,3% per entrambe**. (b) Le percentuali dell'ultima colonna sono per euro di **RAL** (l'imponibile è il 90,81% della RAL, e i contributi si aggiungono al conto), mentre le fasce della prima colonna sono espresse in **imponibile**: la colonna "RAL corrispondente" rende la tabella leggibile senza tenere a mente la conversione. Tutti i valori provengono ora da differenze finite calcolate sul motore, non da somme fatte a mano.

**Il messaggio:** esiste una fascia — tra circa 35.000 e 44.000 € di RAL — in cui un aumento di stipendio viene tassato al ~61%, **più che nella fascia immediatamente superiore**. Il phase-out simultaneo di due agevolazioni (detrazione art. 13 e ulteriore detrazione cuneo) crea una gobba nella curva.

Questa è l'informazione che trasforma un calcolatore in uno strumento decisionale per un'azienda che deve decidere gli aumenti. Concretamente, nella UI:

- **Delta marginale:** "+1.000 € di RAL → il dipendente ne vede 390, a te ne costano 1.350"
- **Grafico dell'aliquota effettiva** da 20k a 80k, con la gobba ben visibile
- **Vista costo azienda** affiancata alla vista dipendente

---

## 5. Semplificazioni dichiarate

Da scrivere nel README, una per una. Dichiararle è più forte che nasconderle.

**Sul reddito**
1. Reddito complessivo = solo reddito di lavoro dipendente (nessun altro reddito, nessun immobile, nessuna cedolare secca)
2. Nessun onere deducibile oltre i contributi obbligatori
3. Nessun onere detraibile (spese sanitarie, mutuo, ecc.)
4. Nessun familiare a carico (art. 12 TUIR non applicato)
5. Nessuna agevolazione (impatriati, rientro cervelli, bonus mamme, premi di produttività, welfare, fringe benefit)

**Sui contributi**
6. Aliquota lavoratore fissa 9,19%: non modelliamo apprendistato, part-time, settori con aliquote diverse, fondi di categoria (Metasalute, EST, Previndai)
7. L'1% aggiuntivo è applicato **su base annua**, mentre la norma prevede il criterio della **mensilizzazione** (soglia mensile di 4.685 €). Con retribuzione costante il risultato coincide; con premi o variabili concentrati in un mese no
8. Imponibile previdenziale = imponibile fiscale = RAL (in realtà differiscono per alcune voci)

**Sul calcolo temporale**
9. Rapporto di lavoro per l'intero anno (365 giorni) — nessun ragguaglio
10. Calcolo su base annua, non mese per mese: non modelliamo conguaglio di fine anno né il fatto che il sostituto d'imposta lavori su *reddito presunto*
11. Le addizionali sono calcolate sull'anno corrente. Nella realtà c'è uno **sfasamento di un anno**: nel 2026 si trattiene il saldo dell'addizionale regionale 2025 in 11 rate (gennaio–novembre) più l'acconto comunale 2026 (30%). Semplificazione consapevole: l'utente vuole sapere il carico fiscale *dell'anno*, non il flusso di cassa mensile

**Sulle mensilità**
12. Il numero di mensilità (12/13/14) dipende dal CCNL. Lo rendiamo un input con default 13, perché è la scelta più diffusa e perché il netto mensile cambia sensibilmente
13. La tredicesima ha una tassazione propria (nessuna detrazione applicata su di essa in busta paga): sulla somma annua non cambia nulla, sul singolo cedolino sì

**Sul lato azienda**
14. Contributi datore stimati come range percentuale, non calcolati per CCNL specifico
15. TFR calcolato come RAL/13,5, senza rivalutazione ISTAT né quota destinata al Fondo di Tesoreria

**Sul presupposto soggettivo e sulle convenzioni numeriche** *(aggiunta rev. 2)*
16. Si assume un lavoratore **privo di anzianità contributiva al 31 dicembre 1995**, unica ipotesi in cui opera il massimale di 122.295 € (art. 2 c. 18 L. 335/1995). Per chi ha contributi ante-1996 il massimale non si applica e i contributi continuano a maturare oltre quella soglia
17. Il motore lavora **in centesimi**, mentre le istruzioni dichiarative ragionano su redditi arrotondati all'unità di euro (da cui fasce scritte come "compreso tra euro 15.001 e 28.000"). Sulle soglie a gradino le due convenzioni possono divergere di pochi centesimi
18. Il **trattamento integrativo** è implementato nella sola diramazione principale (RC ≤ 15.000); la diramazione residuale per RC 15.001–28.000 è esclusa perché irraggiungibile nel caso standard (vedi §2.5)

---

## 6. Cosa faresti con più tempo

Da mettere in fondo al README — è la sezione che apre le domande giuste in colloquio.

1. **Motore mensile** invece che annuale, con conguaglio di dicembre e gestione del reddito presunto
2. **Multi-anno**: parametri versionati per anno d'imposta, con la possibilità di confrontare 2025 vs 2026 (mostrando l'effetto del taglio al 33%)
3. **Tutti i comuni e le regioni**: import automatico della banca dati MEF, con gestione dei comuni che deliberano a scaglioni e delle soglie di esenzione condizionali (ISEE, nucleo familiare)
4. **Familiari a carico** (art. 12 TUIR, con la disciplina rivista dal D.Lgs. 192/2024) e Assegno Unico
5. **Reverse calculation**: dal netto desiderato alla RAL da offrire — è il caso d'uso reale di un recruiter
6. **Welfare e fringe benefit**: mostrare che 1 € di welfare vale ~1,5 € di aumento lordo, a parità di costo azienda
7. **Validazione contro cedolini reali** invece che contro altri calcolatori online (che, come visto, sbagliano)

---

## 7. Nota di metodo sulle fonti

Gerarchia usata, dalla più affidabile:

1. **Testi normativi** — TUIR (D.P.R. 917/1986), L. 199/2025, L. 207/2024, D.Lgs. 360/1998, L.R. Lombardia 10/2003
2. **Banche dati e circolari degli enti** — MEF/Dipartimento delle Finanze, circolari INPS, circolari e istruzioni Agenzia delle Entrate, delibere comunali depositate
3. **Prassi operativa istituzionale** — FAQ NoiPA, FAQ INPS, Certificazione Unica
4. **Fonti professionali** — Consulenti del Lavoro, riviste specializzate (usate solo per orientarsi, mai come fonte di un numero)
5. **Blog e calcolatori online** — usati **solo** come controprova, mai come fonte. Ho trovato errori concreti in fonti di questo livello (calcolo a scaglioni della somma esente; inversione dei minimi 690/1.380).

Ogni parametro nel file di configurazione porta con sé il campo `fonte` e il campo `url`.

---

## 8. Revisioni

Questa sezione elenca cosa è cambiato rispetto alla prima stesura e perché. La regola seguita è sempre la stessa: **vince la fonte primaria**, e ogni correzione è tracciata invece che assorbita in silenzio.

### Rev. 4 — 21 agosto 2026

Origine: revisione finale pre-consegna. Due difetti di presentazione e uno di lettura dell'input, nessuno dei quali toccava il motore di calcolo.

| # | Sezione | Cosa è cambiato | Perché |
|---|---|---|---|
| 20 | motore, UI | **La scomposizione mostrata non chiudeva.** A RAL 35.000 la testata dava `26.032,18 + 5.751,33 + 3.216,50 = 35.000,01`. Il totale imposte sommava voci già arrotondate, contro la convenzione dichiarata in §8. Ora somma in piena precisione e arrotonda una volta sola: 5.751,32 | La convenzione del progetto è precisione piena internamente e arrotondamento solo in uscita. Sommare valori già arrotondati la violava proprio nell'identità su cui poggia la pagina |
| 21 | motore | Aggiunta `quadraturaCentesimi()` col **metodo del resto maggiore**. La sola piena precisione non bastava: arrotondare separatamente tre addendi che sommano alla RAL rompe l'identità sul 22% del dominio | È aritmetica, non un bug. Stessa tecnica con cui si quadrano i cedolini e si ripartiscono i seggi. Presidiata da una property su ~1.300 RAL |
| 22 | UI | Stessa classe di difetto corretta su altri tre aggregati non segnalati: le quattro fette della barra, `netto prima + benefici = netto annuo`, e le celle del costo azienda | Trovati verificando gli altri aggregati invece di fermarsi a quello segnalato |
| 23 | motore | **Il parser dell'input cancellava i caratteri estranei invece di rifiutarli**, e trattava ogni punto come separatore di migliaia: `"abc35000"` era accettato come 35.000 e `"10000.50"` diventava 1.000.050 | Accettare in silenzio un input diverso da quello digitato è peggio che rifiutarlo. Il nuovo `leggiImporto()` scioglie l'ambiguità del punto sulla lunghezza del gruppo e valida i raggruppamenti |
| 24 | §3 | La **Risposta AdE n. 7/2026 è stata riletta sul PDF ufficiale** e le quattro affermazioni della Rev. 2 sono confermate alla lettera; aggiunti link diretto e citazioni testuali. Citata alla lettera anche la nota (3) alla Tabella 6 del 730/2026 | Una fonte citata e non verificabile dal lettore vale quanto una fonte non consultata |

### Rev. 3 — 20 agosto 2026

Origine: revisione pre-consegna. La correzione nasce dalla lettura diretta della L. 297/1982, che distingue due contributi che la Rev. 2 aveva collassato in uno.

| # | Sezione | Cosa è cambiato | Perché |
|---|---|---|---|
| 14 | §2.8 | Lo **0,50% detratto dalla quota TFR non è il Fondo di Garanzia**: è una maggiorazione dell'aliquota **IVS a carico datore** (art. 3 u.c. L. 297/1982). Il Fondo di Garanzia è voce autonoma e vale lo **0,20%** (art. 2 c. 8 L. 297/1982), 0,40% per i dirigenti industriali | La Rev. 2 attribuiva allo 0,50% la fonte e la natura sbagliate. Due contributi diversi, con due articoli diversi della stessa legge |
| 15 | §2.8, motore | **Corretto un doppio conteggio nel costo aziendale.** Essendo IVS, lo 0,50% è già dentro il ~30% dei contributi datore: sommare anche la quota TFR lorda lo contava due volte. Il costo usa ora la **quota netta** `1/13,5 − 0,50% = 6,9074%`, e il moltiplicatore passa da **1,3741 a 1,3691** | Conseguenza aritmetica diretta del punto 14. Presidiato da tre test dedicati in `marginale-costo.test.ts` |
| 16 | UI | Voce rinominata da "TFR maturato" a **"Quota TFR netta stimata"**; sezione da "Costo per l'azienda" a **"Stima del costo aziendale"** | L'etichetta precedente prometteva un dato esatto e nominava la grandezza sbagliata |
| 17 | UI, motore | **Imposte e contributi separati** nell'esito: 5.751,32 € e 3.216,50 € a RAL 35.000, invece di un unico "8.967,82 € trattenuti" (il valore mostrato in Rev. 3 era 5.751,33, corretto in Rev. 4) | I contributi previdenziali finanziano una prestazione futura intestata al lavoratore, le imposte no. Il brief chiede "quanto sono le tasse", e la somma dei due risponde a una domanda diversa |
| 18 | UI | Aggiunto il **pulsante "Calcola il mio netto"** con conferma anche da Invio, disabilitato su input non valido. Lo slider resta in tempo reale | Requisito letterale del brief, che chiede un'interazione esplicita di calcolo |
| 19 | §2.6, fonti | Le **etichette dei link ora corrispondono ai target**: il cuneo punta a Normattiva e non alla FAQ NoiPA, l'addizionale comunale alla query MEF su Milano/F205 e non alla pagina generica. Prassi e norma compaiono come voci distinte | Un riferimento che non porta dove dice di portare è inverificabile, ed è esattamente il difetto che questo dossier contesta alle fonti secondarie |

### Rev. 2 — 19 agosto 2026

Origine: verifica del dossier contro le formule implementate, seguita da riscontro sulle fonti primarie (istruzioni modello 730/2026 dell'Agenzia delle Entrate; art. 50 D.Lgs. 446/1997 tramite MEF/DF).

| # | Sezione | Cosa è cambiato | Perché |
|---|---|---|---|
| 1 | §2.3, §3 | Il **troncamento alle prime quattro cifre decimali si applica anche ai coefficienti** `(28.000−RC)/13.000` e `(50.000−RC)/22.000`, non solo al ragguaglio `giorni/365` | Istruzioni 730/2026, Tabella 6 nota (2). Prima stesura: troncamento riferito al solo ragguaglio |
| 2 | §3 | Caso RAL 35.000: detrazione art. 13 da 1.581,52 a **1.581,48**, IRPEF netta da 5.042,04 a **5.042,08**, netto annuo da 26.032,21 a **26.032,18**. Casi 25.000 e 60.000 invariati | Conseguenza diretta del punto 1. I casi di riferimento erano calcolati a mano senza troncamento |
| 3 | §2.3 | I minimi 690/1.380 € valgono **solo sulla fascia RC ≤ 15.000** e **dopo** il ragguaglio ai giorni; non sono un pavimento globale | Nota (3) della Tabella 6 è ancorata alla sola riga "non superiore a euro 15.000". Applicarli globalmente porterebbe la detrazione a 690 € sopra i 50.000 €, dove invece è zero |
| 4 | §2.5 | Il **trattamento integrativo passa da "fuori scope" a implementato**, e la condizione di capienza è `imposta lorda > (detrazione art. 13 − 75 €)`, non `> detrazione art. 13` | Senza la misura il modello ha un artefatto visibile sotto i 15.000 € che non esiste in busta paga. La franchigia di 75 € è nel testo delle istruzioni al rigo C14 e sposta l'attivazione da RC 8.500 a RC 8.173,91 |
| 5 | §2.4 | La fascia al **4,8% della somma esente non ha limite superiore**: il tetto di 20.000 € è condizione di spettanza sul reddito complessivo, non estremo della fascia sul reddito di lavoro dipendente | Istruzioni 730/2026, rigo C14, lettera c). La prima stesura collassava due grandezze che la sezione stessa dichiarava distinte |
| 6 | §4 | Marginale della fascia 28.000–32.000 corretta da **48% a 49,3%**; aggiunta colonna con la RAL corrispondente; aggiunta la fascia 50.000–51.057 al 50,5%; tutti i valori ora calcolati dal motore | Le righe "28.000–32.000" e "40.000–50.000" avevano componenti identici e totali diversi: impossibile |
| 7 | §2.8 | TFR: **7,4074% ai fini del costo azienda**, 6,9074% come accantonamento netto per il lavoratore, differenza pari allo 0,50% versato al Fondo di Garanzia INPS | Il dossier riportava 6,91% con la formula RAL/13,5, che dà però 7,4074%. Sono due grandezze diverse, entrambe corrette |
| 8 | §5 | Aggiunte le semplificazioni 16 (assenza di anzianità contributiva ante-1996, presupposto del massimale), 17 (calcolo in centesimi contro fasce dichiarative in euro interi) e 18 (diramazione residuale del TI esclusa) | Presupposti che erano impliciti |
| 9 | §2.6, §2.7 | Confermata la **condizione di debenza anche per l'addizionale regionale** | Art. 50 D.Lgs. 446/1997: *"L'addizionale regionale è dovuta se per lo stesso anno l'IRPEF risulta dovuta, al netto delle detrazioni per essa riconosciute e del credito di imposta"*. Il dossier la enunciava per la sola comunale |
| 10 | §2.4 | Modellato il **meccanismo a due tempi del comma 5**: la fascia percentuale si sceglie sul reddito annualizzato, la percentuale si applica al reddito effettivo | L. 207/2024 art. 1 c. 5 ed esempio della Circolare 4/E. Inerte a 365 giorni, ma tenerlo separato ora costa quindici minuti e dopo costerebbe una riscrittura |
| 11 | §2.4 | Recuperata e letta la **Risposta AdE n. 7/2026**: definisce i "giorni di lavoro dipendente" del denominatore. **Nessun vincolo aggiuntivo sul caso standard** | Era una verifica rimasta aperta al momento della decisione |
| 13 | §8 | Le discontinuità passano da quattro a **sette**: aggiunti i tre salti favorevoli, in un solo array con il salto dotato di segno. Rimosso il campo `ralSoglia`, ora derivato | I tre gradini verso l'alto non violano la monotonia, quindi non erano sorvegliati da nulla. La property è stata sdoppiata in monotonia a tratti + ampiezza dei gradini |
| 12 | motore | `tronca: false` sul coefficiente dell'ulteriore detrazione cuneo, con impatto quantificato in 0,10 € | La regola del troncamento discende dalle note alle tabelle dei modelli dichiarativi, che coprono l'art. 13 e non la formula del comma 6, che nelle istruzioni non compare nemmeno. Estenderla per analogia sarebbe stata un'assunzione nostra travestita da norma |

### Cosa la revisione ha fatto emergere: il sistema è costruito a gradini

La §2.7 raccontava la discontinuità dell'addizionale comunale come una particolarità del Comune di Milano. Mappando il netto a passo di un centesimo su tutto il dominio si vede che non lo è affatto: è la forma normale con cui il legislatore italiano scrive le soglie di questi benefici, e nel modello si ripete **sette volte**. Superata la soglia il beneficio non si modula, **compare o sparisce di colpo**.

Quattro cadono a sfavore del contribuente e tre a favore. Nel file dei parametri stanno in **un solo array**, con il salto dotato di segno: separarle codificherebbe nei dati una distinzione che nella norma non esiste, ed è una preoccupazione della sola interfaccia.

Si dividono invece — questa sì, per meccanismo giuridico — in due famiglie:

**Soglie reddituali.** Superato un livello di reddito, l'agevolazione compare o cessa per previsione diretta della norma che la istituisce.

**Soglie di capienza.** È il rapporto fra imposta lorda e detrazioni a far scattare l'effetto, non un livello di reddito. Quando l'IRPEF netta passa da zero a positiva, **entrambe** le addizionali diventano dovute sull'intero imponibile in un colpo solo (art. 50 D.Lgs. 446/1997 e art. 1 D.Lgs. 360/1998); e quando l'imposta lorda supera la detrazione art. 13 al netto della franchigia di 75 €, scatta il trattamento integrativo.

| Imponibile | RAL | Tipo | Salto | Meccanismo |
|---|---|---|---|---|
| **8.173,91** *(derivata)* | 9.001,12 | capienza | **+1.200,00 €** | L'imposta lorda supera la detrazione art. 13 diminuita della franchigia di 75 €: scatta il trattamento integrativo |
| **8.500,00** | 9.360,20 | reddituale + capienza | **−257,55 €** | La somma esente scende dal 7,1% al 5,3% sull'intero reddito (−153,00) **e** l'IRPEF netta diventa positiva, rendendo dovuta l'addizionale regionale su tutto l'imponibile (−104,55) |
| **15.000,00** | 16.518,00 | reddituale | **−130,00 €** | Cessa il trattamento integrativo (−1.200,00), la detrazione art. 13 salta da 1.955 a 3.100 € (+1.145,00), la somma esente scende dal 5,3% al 4,8% (−75,00) |
| **20.000,00** | 22.024,01 | reddituale | **+40,00 €** | Cessa la somma esente del comma 4 (−960,00) e subentra l'ulteriore detrazione del comma 6, capiente per intero (+1.000,00) |
| **23.000,00** | 25.327,61 | reddituale | **−184,00 €** | Cessa l'esenzione dall'addizionale comunale di Milano, che si applica sull'intero reddito e non sull'eccedenza |
| **25.000,00** | 27.530,01 | reddituale | **+65,00 €** | Scatta la maggiorazione di 65 € della detrazione art. 13 |
| **35.000,00** | 38.542,01 | reddituale | **−65,00 €** | Cessa la stessa maggiorazione di 65 € |

Il motore riproduce tutti e sette i salti entro 11 centesimi dal valore normativo; lo scarto residuo è la scalinata da troncamento descritta qui sotto, non un errore di modello.

Quattro conseguenze.

**L'"esenzione che non è franchigia" non è una stranezza milanese.** È lo schema con cui sono scritte tutte e sette.

**La stessa norma è un regalo e una penalità.** La maggiorazione dell'art. 13 co. 1.1 compare come +65 € a 27.530 € di RAL e sparisce come −65 € a 38.542 €: due gradini opposti generati dallo stesso comma, a undicimila euro di distanza.

**La soglia a 8.500 € è doppia.** Due meccanismi diversi scattano nello stesso punto per coincidenza aritmetica: l'imponibile a cui la somma esente cambia fascia è lo stesso a cui l'IRPEF netta diventa positiva. Un modello che ne implementasse solo uno produrrebbe metà del gradino e sembrerebbe comunque plausibile.

**Una sola soglia non è scritta nella norma come cifra.** L'attivazione del trattamento integrativo cade dove si incrociano tre parametri — detrazione della prima fascia, franchigia di capienza e prima aliquota IRPEF — e vale `(1.955 − 75) / 0,23 = 8.173,91`. Memorizzare quel numero accanto a quelli autorevoli lo renderebbe silenziosamente sbagliato al primo cambio di aliquota, quindi il file dei parametri dichiara la regola di derivazione e il motore lo calcola.

### Perché la property di monotonia non basta

La monotonia del netto vale solo a tratti, e va testata come tale. Ma la sola monotonia lascia scoperti i tre gradini favorevoli: **il netto continua a salire, quindi nessuna asserzione protesta**. Se domani qualcuno toccasse la formula dell'art. 13 e il gradino a imponibile 15.000 passasse da +1.145 a +1.100, nessun test se ne accorgerebbe, e i tre casi di riferimento stanno tutti sopra quella soglia.

La property è quindi sdoppiata:

1. **monotonia a tratti** — il netto cresce ovunque tranne nelle quattro soglie negative
2. **ampiezza dei gradini** — in tutte e sette il salto è quello dichiarato, entro `tolleranzaScalinata`, e ha il segno giusto

La seconda copre anche le quattro della prima, quindi non è lavoro doppio: è la stessa asserzione applicata a un array più lungo. Il risultato è che **ogni discontinuità del modello diventa un invariante sorvegliato**, favorevole o meno. Verificato con una mutazione controllata: portando la maggiorazione da 65 a 60 € cadono entrambe le soglie dell'art. 13 co. 1.1, mentre prima dello sdoppiamento sarebbe caduta solo quella negativa.

### La RAL di soglia non si memorizza

Il file dei parametri contiene l'**imponibile**, che è la grandezza che la norma definisce. La RAL corrispondente la calcola il motore con `ralPerImponibile()`.

La ragione è la stessa già applicata alla prima fascia pensionabile mensile: un solo numero autorevole per concetto, tutto il resto derivato. Un valore arrotondato che vive accanto a valori autorevoli e che non va usato per calcolare non è documentazione, è una mina — e questa era già esplosa: `23.000 / 0,9081 = 25.327,6071` arrotondato a 25.327,61 cade **oltre** la soglia, e misurando lì il salto risultava di segno opposto.

`ralPerImponibile()` non è una divisione per 0,9081: sopra i 56.224 € l'aliquota contributiva marginale cambia e sopra il massimale si azzera, quindi l'inversione è definita a tre tratti. Nessuna delle sette soglie ci arriva, ma la funzione è scritta corretta fin da subito perché il calcolo inverso dal netto alla RAL — che è in roadmap — userà davvero quei rami. Un test verifica il round-trip `imponibile → RAL → imponibile` su tutti e tre.

**In visualizzazione la RAL di soglia è arrotondata per eccesso**, in entrambe le direzioni del salto. È la scelta conservativa in tutti e due i casi: su una soglia negativa evita di far scattare l'avviso "il netto scende" a chi la soglia non l'ha ancora raggiunta; su una positiva evita di promettere un beneficio a chi non ne ha ancora diritto. Resta una finestra cieca larga meno di un euro, ma il calcolo del netto non passa mai di lì: quel valore è solo l'etichetta.

### Un effetto collaterale del troncamento

Il troncamento del coefficiente introduce una **scalinata**: il coefficiente scende a scatti di 0,0001, quindi la detrazione scende a scatti di 0,119 € nella fascia 15.000–28.000 (1.190 × 0,0001) e di 0,191 € nella fascia 28.000–50.000 (1.910 × 0,0001).

Il netto quindi **non è strettamente crescente nemmeno lontano dalle quattro soglie**: ogni ~1,43 € di RAL c'è un gradino verso il basso. Il gradino massimo è di **0,191 €**, e cade nella fascia 28.000–50.000 di imponibile.

L'ulteriore detrazione cuneo **non contribuisce** alla scalinata, perché il suo coefficiente non è troncato. Se un giorno si trovasse una fonte che prescrive il troncamento anche per il comma 6, il gradino massimo salirebbe a 0,291 € nel tratto in cui i due phase-out coesistono: è la ragione per cui il parametro `gradinoTeoricoMassimo` e il flag `tronca` vanno aggiornati insieme.

Non è un bug: è l'aritmetica della norma come l'Agenzia la scrive. È documentato e fissato in un test dedicato invece che nascosto sotto una tolleranza.

### Nota implementativa: il troncamento e il floating point

Il troncamento a quattro decimali è la riga di codice più insidiosa del motore. `(28.000 − 22.702,50) / 13.000` vale matematicamente 0,4075, ma in doppia precisione vale `0.40749999999999997`: un `Math.trunc(x * 10000) / 10000` scritto in modo ingenuo restituisce **0,4074** e sbaglia la detrazione di 12 centesimi, spostando il netto del caso di riferimento RAL 25.000 da 20.569,65 a 20.569,53.

Non basta normalizzare il rapporto prima di troncarlo: anche partendo da un valore ripulito, la moltiplicazione per 10.000 reintroduce l'errore. La normalizzazione va fatta **dopo** lo scaling. La cosa è stata verificata sul campo: la prima versione dello script di controllo di questa revisione conteneva esattamente questo bug, ed è stato il caso di riferimento RAL 25.000 a scoprirlo.

---

*Documento redatto ad agosto 2026, rev. 2 del 19 agosto 2026 (vedi §8). Le aliquote comunali e regionali vanno riverificate sulla banca dati MEF prima di ogni nuovo anno d'imposta: la delibera comunale di Milano per il 2026 non risultava ancora depositata alla data di redazione.*
