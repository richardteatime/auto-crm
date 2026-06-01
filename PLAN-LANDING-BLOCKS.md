# PLAN-LANDING-BLOCKS.md — Blocchi avanzati per il Landing Page Builder (FASE 2.1)

## Missione

Estendere il **builder a blocchi tipizzati** della FASE 2 con **5 nuovi blocchi**
che replicano l'estetica delle *sales page DTC* ad alta conversione, restando
nel modello **lead-capture** (form → CRM).

**Nessun e-commerce. Nessun cambio di architettura. Solo blocchi additivi.**

---

## Contesto

L'esigenza nasce da una sales page di riferimento (prodotto fisico: cerotti
antifungini) con: box acquisto, tabella comparativa, FAQ, recensioni con stelle,
loghi "come visto su", offer box, CTA ripetute.

**Distinzione chiave già chiarita:**

- Quella pagina è **e-commerce** (carrello, checkout, pagamenti) → fuori scope,
  come stabilito in `PLAN-FASE2.md` ("Payments/Stripe integration — NON
  implementare").
- Quello che vogliamo qui è la **sua estetica persuasiva** per **generare LEAD**
  (form → contatto → pipeline), NON per vendere col carrello.

Il builder ha già 9 blocchi (hero, features, testimonials, cta, form, image,
text, divider, footer). Mancano gli elementi di conversione tipici delle sales
page. Li aggiungiamo come blocchi nuovi.

---

## Principi (non negoziabili)

1. **Zero architettura nuova.** Si segue il pattern "aggiungi un blocco"
   esistente, a 5 file.
2. **Zero e-commerce.** L'Offer Box è un **CTA verso il form**, non un
   add-to-cart. `priceLabel` è testo libero, non un prezzo con logica.
3. **SSR-first.** Ogni blocco renderizza server-side in
   `LandingBlockRenderer`. La FAQ usa `<details>/<summary>` nativo →
   espandibile **senza JavaScript**, niente `"use client"` sul percorso
   pubblico.
4. **Zero nuove dipendenze npm.** Solo `lucide-react` (già presente) per le
   icone (`Star`, `Check`, `X`).
5. **Zero modifiche allo schema Appwrite.** I blocchi vivono già dentro
   `landing_pages.config` (campo JSON `text`, 65535). Aggiungere tipi di blocco
   **non tocca il database**. Nessuna migrazione, nessun `npm run setup`.

---

## Il pattern "aggiungi un blocco" — sempre questi 5 file

| # | File | Cosa cambiare |
|---|------|---------------|
| 1 | `src/lib/capture/types.ts` | Aggiungi il literal a `BlockType` (riga ~16) e a `BLOCK_TYPES` (riga ~27); definisci `interface XxxBlock`; aggiungi al union `LandingBlock` (riga ~121); aggiungi label in `BLOCK_LABELS` (riga ~464) |
| 2 | `src/lib/capture/defaults.ts` | Aggiungi il `case "xxx":` in `createBlock()` (riga ~23) con valori di partenza sensati |
| 3 | `src/components/capture/LandingBlockRenderer.tsx` | Aggiungi il `case` in `BlockSwitch` (riga ~112) + la funzione componente SSR |
| 4 | `src/components/capture/LandingBlockPreview.tsx` | Aggiungi il `case` con preview semplificata per il canvas editor |
| 5 | `src/components/capture/LandingBlockForm.tsx` | Aggiungi il `case` di configurazione. Riusa gli helper `Field`, `ColorField`, `Toggle` e il **pattern lista** di `features`/`testimonials` (map + setItem + add/remove) |

> **Nota qualità — esaustività dei switch.** Oggi i tre switch chiudono con
> `default: return null`, quindi TypeScript **non** avvisa se dimentichi un
> case. Sostituire i `default: return null` con un helper `assertNever(block)`
> rende ogni blocco mancante un **errore di compilazione**, non un bug
> silenzioso. Da fare allo Step 0.

---

## Scope — i 5 blocchi nuovi

| Blocco | Scopo (conversione) | Complessità | Client JS? |
|--------|---------------------|-------------|------------|
| `logos` | Trust — "Come visto su" | Bassa | No (SSR) |
| `faq` | Gestione obiezioni | Bassa | No (`<details>` nativo) |
| `reviews` | Riprova sociale con stelle | Media | No (SSR) |
| `offer` | Offerta + CTA al form | Media | No (SSR) |
| `comparison` | Confronto vs alternative | Alta | No (SSR) |

---

## Specifica per blocco

### 1. Logos — "Come visto su"

```ts
interface LogoItem { name: string; imageUrl: string }
interface LogosBlock {
  id: string;
  type: "logos";
  heading: string;            // es. "Come visto su"
  items: LogoItem[];
}
```

- **Render (SSR):** striscia orizzontale responsive, loghi in grayscale con
  opacità ridotta. Se `imageUrl` è vuoto → fallback al `name` come testo
  (utile per "ELLE", "Forbes" in font serif).
- **Form:** pattern lista (name + imageUrl).

### 2. FAQ — accordion

```ts
interface FaqItem { question: string; answer: string }
interface FaqBlock {
  id: string;
  type: "faq";
  heading: string;
  items: FaqItem[];
}
```

- **Render (SSR):** `<details><summary>{question}</summary>{answer}</details>`
  nativo. Espandibile **senza JS**, accessibile da tastiera, perfetto in SSR.
- **Form:** pattern lista (question input + answer textarea).

### 3. Reviews — recensioni con stelle

```ts
interface ReviewItem {
  quote: string;
  author: string;
  rating: number;        // 1..5
  avatarUrl?: string;
}
interface ReviewsBlock {
  id: string;
  type: "reviews";
  heading: string;
  averageRating: number;       // es. 4.8
  ratingCountLabel: string;    // es. "312 recensioni"
  items: ReviewItem[];
}
```

- **Render (SSR):** rating medio in testa con stelle `lucide-react/Star`
  (piene/vuote in base a `rating`); card recensione con avatar opzionale.
- **Form:** pattern lista (quote, author, rating 1-5, avatarUrl).
- **Differenza da `testimonials`:** ha stelle + rating aggregato + avatar.
  `testimonials` resta per le citazioni semplici.

### 4. Offer Box — offerta (NON carrello)

```ts
interface OfferBlock {
  id: string;
  type: "offer";
  badgeText: string;            // es. "Più richiesto" (opz., "" = nascosto)
  heading: string;
  priceLabel: string;           // testo libero, es. "€19,90" — NESSUNA logica
  comparePriceLabel: string;    // prezzo barrato, "" = nascosto
  includes: string[];           // elenco con checkmark
  buttonText: string;
  buttonUrl: string;            // default "#form" → scroll al blocco form
  backgroundColor: string;
  textColor: string;
}
```

- **Render (SSR):** card prezzo con badge, lista `includes` con `Check`, e
  **CTA `<a href={buttonUrl}>` con `data-sx-cta`** (così il tracking
  `cta_click` esistente lo conta). Identico nello spirito a Hero/CTA.
- **NON è add-to-cart.** Il bottone porta al form/lead. `priceLabel` è solo
  testo: nessun prezzo calcolato, nessun carrello.
- **Form:** Field semplici + pattern lista per `includes`.

### 5. Comparison Table — confronto

```ts
interface ComparisonRow {
  label: string;                 // es. "Contatto prolungato"
  values: (boolean | string)[];  // allineati a columns; bool → check/x, string → testo
}
interface ComparisonBlock {
  id: string;
  type: "comparison";
  heading: string;
  columns: string[];             // alternative, es. ["I nostri patch","Creme","Laser"]
  highlightColumn: number;       // indice della colonna da evidenziare (la nostra)
  rows: ComparisonRow[];
}
```

- **Render (SSR):** `<table>`; valori `boolean` → `Check`/`X` (`lucide-react`),
  `string` → testo; la colonna `highlightColumn` evidenziata con
  `theme.primaryColor`. Su mobile: `overflow-x-auto`.
- **Form:** il più complesso (matrice). Editor di `columns[]` + `rows[]` con
  `values` allineati. **Vincolo: max 5 colonne** per leggibilità e responsive.

---

## Fuori scope (esplicito)

- Carrello, checkout, varianti prodotto, pagamenti (Stripe), ordini, spedizioni.
  Se servono → **piattaforma e-commerce dedicata** (Shopify + page builder,
  o funnel builder), **non** questo builder.
- Sticky add-to-cart.
- A/B testing dei blocchi.

---

## Piano di implementazione (ordinato per ROI e complessità crescente)

- **Step 0 — Esaustività.** Introdurre `assertNever()` e sostituire i
  `default: return null` nei 3 switch (renderer, preview, form).
- **Step 1 — Logos.** Warm-up: percorre tutti e 5 i file end-to-end col pattern
  lista. Una volta fatto questo, gli altri sono variazioni.
- **Step 2 — FAQ.** `<details>` nativo.
- **Step 3 — Reviews.** Stelle + rating.
- **Step 4 — Offer Box.** CTA + `data-sx-cta`.
- **Step 5 — Comparison Table.** Editor a matrice.
- **Step 6 — Polish.** (Opzionale) un template "sales page" in
  `landing_templates` che monta i nuovi blocchi come punto di partenza; gate +
  test manuale.

Ordine interno di ogni step: **types → defaults → renderer → preview → form**.
Poi salva, pubblica, verifica su `/l/[slug]`.

---

## Definition of Done

- [x] 5 nuovi `BlockType` nel union + in `BLOCK_TYPES` + in `BLOCK_LABELS`.
- [x] `createBlock()` ha il case di default per ognuno.
- [x] Rendering SSR per ognuno in `LandingBlockRenderer`.
- [x] Preview canvas per ognuno in `LandingBlockPreview`.
- [x] Form di configurazione per ognuno in `LandingBlockForm`.
- [x] FAQ usa `<details>` nativo (nessun `"use client"` aggiunto al percorso pubblico).
- [x] Offer CTA usa `data-sx-cta` e punta al form (nessun carrello).
- [x] `assertNever()` attivo nei 3 switch (esaustività garantita dal compilatore).
- [x] `npx tsc --noEmit` pulito.
- [x] `npm run lint` pulito.
- [x] Nessuna nuova dipendenza npm. Nessuna modifica allo schema Appwrite.
- [x] `npm run e2e:capture` resta verde (7/7).
- [x] Test manuale del golden path completato.

---

## Rischi & Mitigazioni

| Rischio | Prob. | Impatto | Mitigazione |
|---------|-------|---------|-------------|
| `config` JSON supera 65535 char con liste lunghe | Bassa | Medio | 65 KB è ampio per una landing; se serve, alzare il limite del campo via `setup-appwrite` (idempotente) |
| Editor Comparison troppo complesso da usare | Media | Medio | Max 5 colonne; UX riga/colonna minimale; default già popolato |
| Preview canvas diverge dal render pubblico | Bassa | Basso | Preview resta semplice; il **canonico** è il renderer SSR (convenzione già nel codice) |
| Dimenticare un `case` aggiungendo un blocco | Media | Medio | `assertNever()` → errore di compilazione |

---

## Test manuale (golden path)

1. `npm run dev` → login → `/landing-pages` → nuova pagina.
2. Dal menu **"Blocco"** aggiungi i 5 nuovi blocchi.
3. Configura ognuno; riordina con il drag (`@dnd-kit`); duplica/elimina.
4. **Salva** → **Pubblica** → apri `/l/[slug]`.
5. Verifica: FAQ si apre/chiude (senza errori console), stelle corrette, tabella
   leggibile/scrollabile su mobile, **Offer CTA porta al form**, logos in
   grayscale.
6. `npx tsc --noEmit` e `npm run lint` verdi.

---

## Note operative (outage classifier Auto Mode)

Finché il classifier è in outage, i **gate** (`tsc`, `lint`, `e2e:capture`) e i
comandi Bash vanno lanciati **a mano nel terminale**. Le modifiche ai file e la
verifica via dev server (avviato manualmente) non sono impattate.

---

## Verifica completamento — 1 giugno 2026

- Implementati i 5 blocchi additivi senza nuove dipendenze npm e senza modifiche
  allo schema Appwrite.
- Attivata l'esaustività TypeScript con `assertNever()` nei tre switch richiesti.
- Esteso `npm run e2e:capture`: la landing SSR include e verifica tutti i blocchi
  avanzati, il tracking `data-sx-cta` e il target `id="form"`.
- Corretto un bug emerso dal golden path: i CTA puntavano a `#form`, ma il target
  non esisteva. Ora il primo blocco form espone un solo anchor `id="form"`.
- Corretto un bug preesistente nell'editor: il trigger Base UI del menu blocchi
  generava un `<button>` annidato. Ora usa `render={<Button />}` e il DOM contiene
  un solo controllo valido.
- Gate eseguiti senza build: `npx tsc --noEmit`, `npm run lint`,
  `git -c core.whitespace=cr-at-eol diff --check`, `npm run e2e:capture` (7/7).
- Verifica browser autenticata completata: creazione landing dall'editor,
  aggiunta dei 5 blocchi e del form, duplica/elimina, drag di riordino, salva,
  pubblica e apertura pubblica. FAQ nativa apribile, Offer CTA naviga a `#form`,
  tabella comparativa scrollabile e zero errori console.
