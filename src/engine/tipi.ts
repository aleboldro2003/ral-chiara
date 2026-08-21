/**
 * Tipi del dominio "da RAL a netto".
 *
 * Il file è diviso in tre parti:
 *   1. i tipi che descrivono il FILE DI PARAMETRI (parametri-<anno>.json)
 *   2. i tipi di INPUT del motore
 *   3. i tipi di RISULTATO, che espongono ogni step intermedio
 *
 * Nessuna logica e nessun valore numerico vivono qui: i numeri stanno nel file
 * di parametri, le formule nei moduli del motore. Aggiungere parametri-2027.json
 * non deve richiedere modifiche né a questo file né al motore, purché la
 * struttura resti quella descritta da `ParametriAnno`.
 */

/** Importo in euro, piena precisione. L'arrotondamento avviene solo in presentazione. */
export type Euro = number;

/** Frazione, non percentuale: 0,0919 e non 9,19. */
export type Aliquota = number;

/** Ogni blocco di parametri porta con sé la propria fonte normativa. */
export interface Fonte {
  readonly fonte: string;
  /** Fonte primaria: il testo normativo, quando esiste. */
  readonly url?: string;
  /**
   * Fonte secondaria di prassi — circolare, FAQ, scheda operativa. Sta in un
   * campo suo perché l'etichetta di un link deve dire dove porta: una FAQ del
   * MEF non è la norma, e presentarla come tale è ciò che rende un riferimento
   * inverificabile.
   */
  readonly urlPrassi?: string;
  /** Disciplina generale del tributo, distinta dal dato del singolo ente. */
  readonly urlDisciplina?: string;
  readonly nota?: string;
}

// ---------------------------------------------------------------------------
// 1. Parametri
// ---------------------------------------------------------------------------

/**
 * Scaglione di una scala progressiva. `fino: null` indica l'ultimo scaglione,
 * senza limite superiore.
 */
export interface Scaglione {
  readonly fino: Euro | null;
  readonly aliquota: Aliquota;
}

/**
 * Coefficiente di phase-out nella forma `(riferimento - reddito) / denominatore`.
 *
 * `tronca` decide se il risultato va assunto nelle prime 4 cifre decimali.
 * È un flag per-coefficiente e non una regola globale perché le fonti lo
 * prescrivono per i rapporti dell'art. 13 TUIR (istruzioni 730, Tabella 6 nota 2)
 * ma non per il phase-out dell'ulteriore detrazione L. 207/2024 art. 1 c. 6.
 */
export interface Coefficiente {
  readonly riferimento: Euro;
  readonly denominatore: Euro;
  readonly tronca: boolean;
}

/** Minimo di detrazione, agganciato a una singola fascia e applicato dopo il ragguaglio ai giorni. */
export interface MinimoDetrazione {
  readonly tempoIndeterminato: Euro;
  readonly tempoDeterminato: Euro;
  readonly applicaDopoRagguaglio: boolean;
}

/**
 * Fascia di una detrazione, in forma algebrica unica:
 *
 *     detrazione = base + fattore x coefficiente
 *
 * dove `coefficiente` vale 1 quando il campo omonimo è null. Questa forma copre
 * sia le quattro fasce dell'art. 13 TUIR sia le quattro dell'ulteriore detrazione
 * cuneo, così che il motore abbia una sola funzione di valutazione.
 */
export interface FasciaDetrazione {
  readonly fino: Euro | null;
  readonly base: Euro;
  readonly fattore: Euro;
  readonly coefficiente: Coefficiente | null;
  readonly minimo?: MinimoDetrazione | null;
}

/** Fascia a percentuale unica, usata dalla somma esente del cuneo. */
export interface FasciaPercentuale {
  readonly fino: Euro | null;
  readonly percentuale: Aliquota;
}

export interface ParametriContributiLavoratore extends Fonte {
  readonly aliquotaBase: Aliquota;
  readonly aliquotaAggiuntiva: Aliquota;
  readonly sogliaAliquotaAggiuntiva: Euro;
  readonly massimaleAnnuo: Euro;
  readonly formula: string;
}

export interface ParametriIrpef extends Fonte {
  readonly modalita: "progressivaPerScaglioni";
  readonly scaglioni: readonly Scaglione[];
}

export interface ParametriDetrazioneLavoroDipendente extends Fonte {
  readonly baseDiRiferimento: BaseReddituale;
  readonly ragguagliabileAiGiorni: boolean;
  readonly fasce: readonly FasciaDetrazione[];
  readonly maggiorazione: {
    readonly importo: Euro;
    readonly oltre: Euro;
    readonly fino: Euro;
    readonly fonte: string;
  };
  readonly formulaFascia: string;
}

export interface ParametriSommaEsente extends Fonte {
  readonly spettanzaRedditoComplessivoMax: Euro;
  readonly baseDiCalcolo: BaseReddituale;
  /**
   * `aliquotaUnicaSuInteroReddito` è l'unica modalità corretta per questa misura.
   * Il campo esiste per rendere esplicito che NON è progressiva per scaglioni:
   * l'errore più diffuso nelle fonti secondarie.
   */
  readonly modalita: "aliquotaUnicaSuInteroReddito";
  readonly fasce: readonly FasciaPercentuale[];
  readonly concorreAlRedditoImponibile: boolean;
  /**
   * Meccanismo a due tempi imposto dal comma 5 della L. 207/2024: il reddito si
   * annualizza per stabilire QUALE percentuale si applica, ma la percentuale si
   * applica poi al reddito EFFETTIVAMENTE percepito. A 365 giorni le due
   * grandezze coincidono; con i rapporti infrannuali no.
   */
  readonly annualizzazionePerFascia: boolean;
  readonly baseIndividuazioneFascia: "redditoLavoroDipendenteAnnualizzato";
  readonly baseApplicazionePercentuale: "redditoLavoroDipendenteEffettivo";
  readonly formulaAnnualizzazione: string;
  readonly notaGiorni: string;
}

export interface ParametriUlterioreDetrazione extends Fonte {
  readonly spettanzaRedditoComplessivoMin: Euro;
  readonly spettanzaRedditoComplessivoMax: Euro;
  readonly baseDiRiferimento: BaseReddituale;
  readonly fasce: readonly FasciaDetrazione[];
  readonly ragguagliabileAiGiorni: boolean;
}

export interface ParametriCuneo extends Fonte {
  readonly sommaEsente: ParametriSommaEsente;
  readonly ulterioreDetrazione: ParametriUlterioreDetrazione;
}

export interface ParametriTrattamentoIntegrativo extends Fonte {
  readonly importo: Euro;
  readonly redditoComplessivoMax: Euro;
  /** Franchigia sottratta alla detrazione nella verifica di capienza (75 euro). */
  readonly franchigiaCapienza: Euro;
  readonly franchigiaRagguagliabileAiGiorni: boolean;
  readonly baseCondizione: "impostaLordaSuRedditiLavoroDipendente";
  readonly formulaCondizione: string;
  readonly concorreAlRedditoImponibile: boolean;
  readonly cumulabileConSommaEsente: boolean;
}

export interface ParametriAddizionaleRegionale extends Fonte {
  readonly regione: string;
  readonly codiceRegione: string;
  readonly modalita: "progressivaPerScaglioni" | "aliquotaUnica";
  readonly dovutaSoloSeIrpefDovuta: boolean;
  readonly baseImponibile: BaseReddituale;
  readonly scaglioni: readonly Scaglione[];
}

/**
 * `tipo: "esenzione"` significa che, superata la soglia, il tributo si applica
 * sull'intero reddito. `tipo: "franchigia"` significa che si applica alla sola
 * eccedenza. Milano usa la prima: da qui la discontinuità di 184 euro.
 */
export interface EsenzioneComunale {
  readonly soglia: Euro;
  readonly tipo: "esenzione" | "franchigia";
  readonly nota?: string;
}

export interface ParametriAddizionaleComunale extends Fonte {
  readonly comune: string;
  readonly codiceCatastale: string;
  readonly modalita: "aliquotaUnica" | "progressivaPerScaglioni";
  readonly aliquota: Aliquota;
  readonly dovutaSoloSeIrpefDovuta: boolean;
  readonly baseImponibile: BaseReddituale;
  readonly esenzione: EsenzioneComunale | null;
  readonly delibera: {
    readonly numero: string;
    readonly data: string;
    readonly confermataIl: string;
    readonly annoDiRiferimento: number;
    readonly nota: string;
  };
  readonly domicilioFiscaleRilevanteAl: string;
}

/** Valore stimato con un intervallo dichiarato, invece che con una falsa precisione. */
export interface Stima {
  readonly predefinito: Aliquota;
  readonly minimo: Aliquota;
  readonly massimo: Aliquota;
  readonly nota: string;
  readonly fonte: string;
}

export interface ParametriCostoDatore {
  readonly contributiDatore: Stima & { readonly modificabile: boolean };
  readonly tfr: {
    readonly divisore: number;
    /**
     * Contributo aggiuntivo dell'art. 3 ultimo comma L. 297/1982, che il datore
     * DETRAE dalla quota TFR. Non è il Fondo di Garanzia: è una maggiorazione
     * dell'aliquota IVS a carico del datore, quindi è già dentro i contributi
     * datore. Sottrarlo dalla quota lorda è ciò che evita il doppio conteggio.
     */
    readonly contributoAggiuntivoIvs: Aliquota;
    /** Fondo di Garanzia TFR, art. 2 c. 8 L. 297/1982. Voce autonoma e distinta. */
    readonly contributoFondoGaranzia: Aliquota;
    readonly contributoFondoGaranziaDirigentiIndustria: Aliquota;
    readonly nota: string;
    readonly fonte: string;
    readonly url: string;
  };
  readonly inail: Stima & { readonly inclusoNelPredefinito: boolean };
  readonly moltiplicatorePredefinito: number;
  readonly nota: string;
}

/** Singolo addendo che concorre al salto di una soglia a gradino. */
export interface ComponenteSalto {
  readonly voce: string;
  readonly importo: Euro;
}

/**
 * Punto in cui il netto scende al crescere della RAL. Non sono anomalie del
 * modello: sono soglie a gradino previste dalla norma, in cui il beneficio non
 * si riduce gradualmente ma sparisce. Sono dichiarate come dato perché i test
 * le verificano al centesimo e la UI le usa per avvisare l'utente che si trova
 * vicino a una di esse.
 */
/**
 * Regola con cui derivare una soglia che la norma non scrive come cifra, ma che
 * cade all'incrocio di più parametri. Il tipo è una union chiusa e non
 * un'espressione da valutare: l'insieme delle derivazioni possibili è piccolo e
 * conosciuto, e un valutatore di espressioni sarebbe più potere del necessario.
 */
export interface SogliaDerivata {
  readonly tipo: "capienzaTrattamentoIntegrativo";
  readonly descrizione: string;
  readonly formula: string;
  readonly nota: string;
}

export interface Discontinuita {
  readonly id: string;
  /** Imponibile di soglia quando la norma lo scrive come cifra; altrimenti null. */
  readonly sogliaImponibile: Euro | null;
  /** Regola di derivazione quando `sogliaImponibile` è null. */
  readonly sogliaDerivata: SogliaDerivata | null;
  /**
   * Salto previsto dalla norma, pari alla somma dei componenti. **Con segno**:
   * negativo dove il netto scende, positivo dove sale. Le due direzioni stanno
   * nello stesso array perché nella norma sono lo stesso fenomeno; distinguerle
   * è una preoccupazione della sola interfaccia.
   */
  readonly saltoNormativo: Euro;
  readonly componenti: readonly ComponenteSalto[];
  /**
   * REDDITUALE: superata una soglia di reddito il beneficio cessa.
   * CAPIENZA: l'IRPEF netta diventa positiva e le addizionali diventano dovute
   * sull'intero imponibile. Sono due meccanismi giuridici distinti, e la soglia
   * a 8.500 li combina entrambi.
   */
  readonly tipo: "reddituale" | "capienza" | "reddituale+capienza";

  readonly titolo: string;
  readonly descrizione: string;
  readonly fonte: string;
}

export interface ParametriDiscontinuita {
  /** Scarto massimo ammesso nei test, pari al gradino più alto della scalinata da troncamento. */
  readonly tolleranzaScalinata: Euro;
  readonly soglie: readonly Discontinuita[];
  /** Distanza in euro entro cui la UI avvisa che si sta per attraversare una soglia. */
  readonly distanzaAvviso: Euro;
  readonly nota: string;
  readonly notaAvviso: string;
}

export interface ConvenzioniNumeriche extends Fonte {
  readonly decimaliOutput: number;
  readonly modalitaArrotondamento: "half-up";
  readonly cifreTroncamentoCoefficiente: number;
}

export interface ParametriAnno {
  readonly annoImposta: number;
  readonly revisione: string;
  readonly aggiornatoIl: string;
  readonly descrizione: string;
  readonly profiloStandard: {
    readonly tipoContratto: TipoContratto;
    readonly giorniLavorati: number;
    readonly giorniAnno: number;
    readonly regione: string;
    readonly comune: string;
    readonly nota: string;
  };
  readonly convenzioniNumeriche: ConvenzioniNumeriche;
  readonly mensilita: {
    readonly opzioni: readonly number[];
    readonly predefinita: number;
    readonly nota: string;
    readonly fonte: string;
  };
  readonly contributiLavoratore: ParametriContributiLavoratore;
  readonly irpef: ParametriIrpef;
  readonly detrazioneLavoroDipendente: ParametriDetrazioneLavoroDipendente;
  readonly cuneoFiscale: ParametriCuneo;
  readonly trattamentoIntegrativo: ParametriTrattamentoIntegrativo;
  readonly addizionaleRegionale: ParametriAddizionaleRegionale;
  readonly addizionaleComunale: ParametriAddizionaleComunale;
  readonly costoDatore: ParametriCostoDatore;
  readonly discontinuita: ParametriDiscontinuita;
  readonly scalinataTroncamento: Fonte & {
    /** fattore massimo fra le fasce che troncano, per 10^-cifreTroncamento. */
    readonly gradinoTeoricoMassimo: Euro;
    readonly derivazione: string;
  };
  readonly gerarchiaFonti: readonly string[];
}

// ---------------------------------------------------------------------------
// 2. Input
// ---------------------------------------------------------------------------

export type TipoContratto = "tempoIndeterminato" | "tempoDeterminato";

/**
 * Le tre grandezze reddituali che la norma tiene distinte.
 *
 * Nel caso standard coincidono tutte con `RAL - contributi`, ma le fonti le
 * usano in modo non intercambiabile: la spettanza del cuneo si verifica sul
 * reddito complessivo, la percentuale della somma esente si applica al reddito
 * di lavoro dipendente. Il giorno in cui si aggiunge un secondo reddito
 * divergono, e il codice deve già distinguerle.
 */
export type BaseReddituale =
  | "redditoComplessivo"
  | "redditoLavoroDipendente"
  | "imponibileFiscale";

export interface InputCalcolo {
  readonly ral: Euro;
  readonly mensilita: number;
  readonly tipoContratto?: TipoContratto;
  readonly giorniLavorati?: number;
}

export type CodiceErroreInput =
  | "RAL_NON_NUMERICA"
  | "RAL_NEGATIVA"
  | "RAL_NON_FINITA"
  | "RAL_FUORI_SCALA"
  | "MENSILITA_NON_AMMESSA"
  | "GIORNI_NON_VALIDI";

export interface ErroreInput {
  readonly codice: CodiceErroreInput;
  readonly campo: keyof InputCalcolo;
  readonly messaggio: string;
}

/** Il motore non lancia eccezioni per input non validi: le restituisce. */
export type Esito<T> =
  | { readonly ok: true; readonly valore: T }
  | { readonly ok: false; readonly errori: readonly ErroreInput[] };

// ---------------------------------------------------------------------------
// 3. Risultato
// ---------------------------------------------------------------------------

/**
 * Una voce della cascata mostrata in interfaccia. `formula` è la formula
 * applicata con i numeri già sostituiti; `fonte` viene dal file di parametri e
 * non è mai riscritta a mano nella UI.
 */
export interface VoceCascata extends Fonte {
  readonly id: string;
  readonly etichetta: string;
  readonly importo: Euro;
  readonly segno: "addendo" | "sottraendo" | "totale";
  readonly formula: string;
}

export interface DettaglioContributi {
  readonly imponibilePrevidenziale: Euro;
  readonly quotaBase: Euro;
  readonly quotaAggiuntiva: Euro;
  readonly totale: Euro;
  readonly massimaleRaggiunto: boolean;
  readonly sogliaAggiuntivaSuperata: boolean;
}

export interface DettaglioScaglione {
  readonly da: Euro;
  readonly a: Euro | null;
  readonly aliquota: Aliquota;
  readonly imponibileNelloScaglione: Euro;
  readonly imposta: Euro;
}

export interface DettaglioDetrazione {
  readonly spettante: Euro;
  readonly goduta: Euro;
  readonly nonGoduta: Euro;
  readonly coefficienteApplicato: number | null;
  readonly formula: string;
}

export interface DettaglioIrpef {
  readonly lorda: Euro;
  readonly scaglioni: readonly DettaglioScaglione[];
  readonly detrazioneLavoroDipendente: DettaglioDetrazione;
  readonly maggiorazioneApplicata: Euro;
  readonly ulterioreDetrazioneCuneo: DettaglioDetrazione;
  readonly netta: Euro;
  /** Totale delle detrazioni perse per incapienza: l'imposta si azzera, non genera credito. */
  readonly detrazioniNonGodute: Euro;
  readonly azzerataPerIncapienza: boolean;
}

export interface DettaglioAddizionale {
  readonly importo: Euro;
  readonly dovuta: boolean;
  readonly motivoNonDovuta: string | null;
  readonly baseImponibile: Euro;
  readonly scaglioni?: readonly DettaglioScaglione[];
  readonly esenzioneApplicata?: boolean;
}

export interface DettaglioSommaEsente {
  readonly importo: Euro;
  readonly spettante: boolean;
  readonly motivoNonSpettante: string | null;
  readonly percentualeApplicata: Aliquota | null;
  /** Reddito rapportato all'intero anno: serve SOLO a scegliere la percentuale (c. 5). */
  readonly redditoAnnualizzatoPerFascia: Euro;
  /** Reddito effettivamente percepito: è a questo che la percentuale si applica (c. 4). */
  readonly redditoEffettivo: Euro;
  readonly formula: string;
}

export interface DettaglioAgevolazioni {
  readonly sommaEsente: DettaglioSommaEsente;
  readonly trattamentoIntegrativo: {
    readonly importo: Euro;
    readonly spettante: boolean;
    readonly motivoNonSpettante: string | null;
    /** Imposta lorda sui soli redditi di lavoro dipendente: è quella della condizione. */
    readonly impostaLordaLavoroDipendente: Euro;
    /** Detrazione art. 13 co. 1 (senza la maggiorazione del co. 1.1) meno la franchigia. */
    readonly sogliaCapienza: Euro;
    readonly formula: string;
  };
}

export interface Redditi {
  readonly ral: Euro;
  readonly redditoLavoroDipendente: Euro;
  readonly redditoComplessivo: Euro;
  readonly imponibileFiscale: Euro;
}

/**
 * Le tre grandezze che il brief chiede come output, tenute separate perché sono
 * giuridicamente diverse: i contributi previdenziali finanziano una prestazione
 * futura del lavoratore, le imposte no. Sommarli in un unico "trattenuto"
 * risponde alla domanda sbagliata.
 */
export interface Prelievo {
  /** IRPEF netta più addizionale regionale e comunale. */
  readonly imposte: Euro;
  /** Contributi previdenziali IVS a carico del lavoratore. */
  readonly contributi: Euro;
  /** imposte + contributi */
  readonly totale: Euro;
  /** Somma esente del cuneo più trattamento integrativo: si aggiungono al netto. */
  readonly beneficiFiscali: Euro;
  /** Netto prima dei benefici fiscali, cioè RAL − imposte − contributi. */
  readonly nettoPrimaDeiBenefici: Euro;
  /** Quota della RAL assorbita da imposte e contributi. */
  readonly incidenzaComplessiva: Aliquota;
  readonly incidenzaImposte: Aliquota;
  readonly incidenzaContributi: Aliquota;
  /**
   * I tre valori come vanno MOSTRATI: arrotondati al centesimo e quadrati, così
   * che `netto + imposte + contributi` faccia esattamente la RAL mostrata.
   * Il resto della struttura resta in piena precisione.
   */
  readonly mostrati: {
    readonly nettoPrimaDeiBenefici: Euro;
    readonly imposte: Euro;
    readonly contributi: Euro;
    readonly ral: Euro;
    /** Le due componenti delle imposte, quadrate sul totale mostrato. */
    readonly irpefNetta: Euro;
    readonly addizionali: Euro;
    /** Residuo che chiude `nettoPrimaDeiBenefici + beneficiFiscali = nettoAnnuo`. */
    readonly beneficiFiscali: Euro;
    readonly nettoAnnuo: Euro;
  };
}

export interface RisultatoCalcolo {
  readonly annoImposta: number;
  readonly revisioneParametri: string;
  readonly input: InputCalcolo;
  readonly redditi: Redditi;
  readonly contributi: DettaglioContributi;
  readonly irpef: DettaglioIrpef;
  readonly addizionaleRegionale: DettaglioAddizionale;
  readonly addizionaleComunale: DettaglioAddizionale;
  readonly agevolazioni: DettaglioAgevolazioni;
  readonly nettoAnnuo: Euro;
  readonly nettoMensile: Euro;
  readonly aliquotaMediaEffettiva: Aliquota;
  /** Imposte e contributi separati, più i benefici fiscali che si sommano al netto. */
  readonly prelievo: Prelievo;
  /** La cascata pronta da rendere, nell'ordine in cui va letta. */
  readonly cascata: readonly VoceCascata[];
  /** Discontinuità entro la distanza di allerta dalla RAL richiesta. */
  readonly discontinuitaVicine: readonly Discontinuita[];
}

export interface CostoAzienda {
  readonly ral: Euro;
  readonly contributiDatore: Euro;
  /** Quota lorda ex art. 2120 c.c.: RAL / 13,5 = 7,4074%. Non è un costo aggiuntivo pieno. */
  readonly tfrQuotaLorda: Euro;
  /**
   * Quota TFR netta stimata: lorda meno il contributo aggiuntivo IVS dello 0,50%.
   * È QUESTA che entra nel costo totale, perché lo 0,50% è già dentro i
   * contributi a carico del datore.
   */
  readonly tfrQuotaNetta: Euro;
  /** Lo 0,50% dell'art. 3 ultimo comma L. 297/1982, detratto dalla quota lorda. */
  readonly tfrContributoAggiuntivoIvs: Euro;
  /** Fondo di Garanzia TFR allo 0,20%, voce distinta già compresa nei contributi datore. */
  readonly tfrFondoGaranzia: Euro;
  readonly inail: Euro | null;
  readonly costoTotale: Euro;
  readonly costoMinimo: Euro;
  readonly costoMassimo: Euro;
  readonly moltiplicatore: number;
  /** Le celle come vanno mostrate: sommano esattamente al costo totale mostrato. */
  readonly mostrati: {
    readonly ral: Euro;
    readonly contributiDatore: Euro;
    readonly tfrQuotaNetta: Euro;
    readonly inail: Euro | null;
    readonly costoTotale: Euro;
  };
}

/** Un punto della curva dell'aliquota marginale effettiva. */
export interface PuntoCurvaMarginale {
  readonly ral: Euro;
  readonly imponibile: Euro;
  readonly nettoAnnuo: Euro;
  readonly aliquotaMarginale: Aliquota;
}

export interface DeltaMarginale {
  readonly incrementoRal: Euro;
  readonly incrementoNettoDipendente: Euro;
  readonly incrementoCostoAzienda: Euro;
  readonly aliquotaMarginaleEffettiva: Aliquota;
}
