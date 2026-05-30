// ---------------------------------------------------------------------------
// E2E Parser Test — 30 realistic CRM messages
// Run with: npx tsx scripts/e2e-parser-test.ts
// Tests the full extraction pipeline against real-world Italian messages.
// ---------------------------------------------------------------------------

// NOTE: These parsers are inlined to keep the script standalone.
// When you fix a parser bug, update BOTH this file AND src/lib/orchestrator/command-tools.ts

function extractAmount(text: string): number | null {
  const match = text.match(/(\d[\d.\s,]*)(?:\s*(?:k|eur[o?]|€|\$))?/i);
  if (!match) return null;
  const raw = match[1].replace(/\s/g, "").replace(/\./g, "").replace(/,/g, "");
  const hasK = /\d\s*k/i.test(text);
  const val = parseInt(raw, 10);
  if (Number.isNaN(val)) return null;
  return hasK ? val * 1000 : val;
}

function extractClientName(text: string): string | null {
  const terminators = String.raw`[\,\.\-—]|:\s|\bda\b(?:\s|$)|\bcon\b(?:\s|$)|\bentro\b(?:\s|$)|\bpriorit[aà](?:\s|$)|\bper\b(?:\s|$)|$`;
  const match = text.match(new RegExp(String.raw`per\s+([^\-—:,\.\d]+?)(?:\s*(?:${terminators}))`, "i"));
  if (match) {
    const name = match[1].trim().replace(/^["']+|["']+$/g, "");
    if (name) return name;
  }
  const fallback = text.match(/per\s+(.+)/i);
  if (fallback) {
    let name = fallback[1].trim().replace(/^["']+|["']+$/g, "");
    const truncateMatch = name.match(new RegExp(String.raw`^([^,\.—\-]+?)(?:\s*(?:${terminators}))`, "i"));
    if (truncateMatch) name = truncateMatch[1].trim();
    if (name.length > 40) name = name.slice(0, 40).trim();
    return name;
  }
  return null;
}

function parseItalianDate(value: string | undefined): Date | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("domani")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  if (lower.includes("oggi")) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const ddMmMatch = value.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (ddMmMatch) {
    const day = parseInt(ddMmMatch[1], 10);
    const month = parseInt(ddMmMatch[2], 10) - 1;
    const year = ddMmMatch[3] ? parseInt(ddMmMatch[3], 10) : new Date().getFullYear();
    const d = new Date(year, month, day, 12, 0, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const monthNames: Record<string, number> = {
    gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
    luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
    gen: 0, feb: 1, mar: 2, apr: 3, mag: 4, giu: 5, lug: 6, ago: 7, set: 8, ott: 9, nov: 10, dic: 11,
  };
  const textMatch = value.match(/(\d{1,2})\s+([a-zèé]+)(?:\s+(\d{4}))?/i);
  if (textMatch) {
    const day = parseInt(textMatch[1], 10);
    const monthName = textMatch[2].toLowerCase();
    const year = textMatch[3] ? parseInt(textMatch[3], 10) : new Date().getFullYear();
    const month = monthNames[monthName];
    if (month !== undefined) {
      const d = new Date(year, month, day, 12, 0, 0, 0);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function extractDueDate(text: string): Date | null {
  const lower = text.toLowerCase();
  if (lower.includes("domani")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  if (lower.includes("oggi")) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const ddMmMatch = text.match(/entro\s+(?:il\s+)?(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/i);
  if (ddMmMatch) return parseItalianDate(ddMmMatch[1]);
  const textMatch = text.match(/entro\s+(?:il\s+|venerd[iì]\s+|luned[iì]\s+|marted[iì]\s+|mercoled[iì]\s+|gioved[iì]\s+|sabato\s+|domenica\s+)?(\d{1,2}\s+[a-zèé]+(?:\s+\d{4})?)/i);
  if (textMatch) return parseItalianDate(textMatch[1]);
  return null;
}

function extractProbability(text: string): number | null {
  const match = text.match(/(?<![\d.])(\d{1,3})\s*%/);
  if (match) {
    const val = parseInt(match[1], 10);
    if (val >= 0 && val <= 100) return val;
  }
  return null;
}

function extractExpectedClose(text: string): Date | null {
  const ddMmMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (ddMmMatch) {
    const day = parseInt(ddMmMatch[1], 10);
    const month = parseInt(ddMmMatch[2], 10) - 1;
    const year = ddMmMatch[3] ? parseInt(ddMmMatch[3], 10) : new Date().getFullYear();
    const date = new Date(year, month, day, 12, 0, 0, 0);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

interface E2ETest {
  name: string;
  message: string;
  expected: {
    clientName: string | null;
    amount?: number | null;
    dueDate?: "not-null" | "null" | string; // ISO prefix or not-null/null
    probability?: number | null;
    expectedClose?: "not-null" | "null" | string;
  };
}

function runE2ETests(label: string, tests: E2ETest[]) {
  console.log(`\n=== ${label} ===`);
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const clientName = extractClientName(t.message);
    const amount = t.expected.amount !== undefined ? extractAmount(t.message) : undefined;
    const dueDate = t.expected.dueDate !== undefined ? extractDueDate(t.message) : undefined;
    const probability = t.expected.probability !== undefined ? extractProbability(t.message) : undefined;
    const expectedClose = t.expected.expectedClose !== undefined ? extractExpectedClose(t.message) : undefined;

    const errors: string[] = [];

    if (clientName !== t.expected.clientName) {
      errors.push(`clientName: expected "${t.expected.clientName}", got "${clientName}"`);
    }
    if (amount !== undefined && amount !== t.expected.amount) {
      errors.push(`amount: expected ${t.expected.amount}, got ${amount}`);
    }
    if (dueDate !== undefined) {
      const expected = t.expected.dueDate;
      let ok = false;
      if (expected === "null") ok = dueDate === null;
      else if (expected === "not-null") ok = dueDate !== null;
      else ok = dueDate?.toISOString().startsWith(expected) ?? false;
      if (!ok) errors.push(`dueDate: expected ${expected}, got ${dueDate?.toISOString() ?? "null"}`);
    }
    if (probability !== undefined && probability !== t.expected.probability) {
      errors.push(`probability: expected ${t.expected.probability}, got ${probability}`);
    }
    if (expectedClose !== undefined) {
      const expected = t.expected.expectedClose;
      let ok = false;
      if (expected === "null") ok = expectedClose === null;
      else if (expected === "not-null") ok = expectedClose !== null;
      else ok = expectedClose?.toISOString().startsWith(expected) ?? false;
      if (!ok) errors.push(`expectedClose: expected ${expected}, got ${expectedClose?.toISOString() ?? "null"}`);
    }

    if (errors.length === 0) {
      console.log(`  ✅ ${t.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${t.name}`);
      console.log(`     Message: "${t.message}"`);
      errors.forEach((e) => console.log(`     ${e}`));
      failed++;
    }
  }

  console.log(`  Result: ${passed}/${tests.length} passed`);
  return { passed, failed };
}

const tests: E2ETest[] = [
  // =================== DEAL CREATION ===================
  {
    name: "Deal semplice",
    message: "Crea deal per Rossi da 5000 euro",
    expected: { clientName: "Rossi", amount: 5000 },
  },
  {
    name: "Deal con punto nei migliaia",
    message: "Nuovo deal per Bianchi da 12.500 euro",
    expected: { clientName: "Bianchi", amount: 12500 },
  },
  {
    name: "Deal con K",
    message: "Deal per Verdi da 8k",
    expected: { clientName: "Verdi", amount: 8000 },
  },
  {
    name: "Deal con probabilità e data",
    message: "Crea deal per Mario Rossi da 3000 euro, probabilità 75%, chiusura 15/08/2026",
    expected: { clientName: "Mario Rossi", amount: 3000, probability: 75, expectedClose: "2026-08-15" },
  },
  {
    name: "Deal con percentuale con spazio",
    message: "Deal per Cliente ABC da 10.000 €, probabilità 80 %",
    expected: { clientName: "Cliente ABC", amount: 10000, probability: 80 },
  },
  {
    name: "Deal senza importo",
    message: "Crea deal per Neri",
    expected: { clientName: "Neri", amount: null },
  },
  {
    name: "Deal con nome in quotes",
    message: 'Crea deal per "Link Infissi" da 4500 euro',
    expected: { clientName: "Link Infissi", amount: 4500 },
  },
  {
    name: "Deal con virgola dopo nome",
    message: "Nuovo deal per Luana Ferro, priorità alta",
    expected: { clientName: "Luana Ferro", amount: null },
  },
  {
    name: "Deal con priorità e entro",
    message: "Deal per Bianchi da 2000 euro, priorità alta entro domani",
    expected: { clientName: "Bianchi", amount: 2000 },
  },
  {
    name: "Deal con dollari",
    message: "Crea deal per Cliente USA da 5000 $",
    expected: { clientName: "Cliente USA", amount: 5000 },
  },

  // =================== PROJECT CREATION ===================
  {
    name: "Progetto semplice",
    message: "Crea progetto per Rossi",
    expected: { clientName: "Rossi", dueDate: "null" },
  },
  {
    name: "Progetto con scadenza dd/mm",
    message: "Nuovo progetto per Bianchi entro il 20/06",
    expected: { clientName: "Bianchi", dueDate: "2026-06-20" },
  },
  {
    name: "Progetto con scadenza mese italiano",
    message: "Progetto per Verdi entro venerdì 29 maggio",
    expected: { clientName: "Verdi", dueDate: "2026-05-29" },
  },
  {
    name: "Progetto con scadenza domani",
    message: "Crea progetto per Neri entro domani",
    expected: { clientName: "Neri", dueDate: "not-null" },
  },
  {
    name: "Progetto con descrizione dopo due punti",
    message: "Progetto per Rossi: sito web e-commerce",
    expected: { clientName: "Rossi", dueDate: "null" },
  },
  {
    name: "Progetto con virgola e priorità",
    message: "per Luana Ferro, priorità alta entro venerdì 29 maggio",
    expected: { clientName: "Luana Ferro", dueDate: "2026-05-29" },
  },
  {
    name: "Progetto con trattino",
    message: "Progetto per Mario Bianchi - sito web",
    expected: { clientName: "Mario Bianchi", dueDate: "null" },
  },
  {
    name: "Progetto con 'da' dopo nome",
    message: "App per Giulia da 10k entro oggi",
    expected: { clientName: "Giulia", dueDate: "not-null" },
  },
  {
    name: "Progetto con 'con' dopo nome",
    message: "Sito web per Marco con shop entro 10 giu",
    expected: { clientName: "Marco", dueDate: "2026-06-10" },
  },
  {
    name: "Progetto con nome accentato",
    message: "per André Ferro, priorità alta",
    expected: { clientName: "André Ferro", dueDate: "null" },
  },
  {
    name: "Progetto con 'priorità' dopo nome",
    message: "per Rossi priorità alta",
    expected: { clientName: "Rossi", dueDate: "null" },
  },
  {
    name: "Progetto con nome alla fine",
    message: "Aggiungi progetto per Paolo",
    expected: { clientName: "Paolo", dueDate: "null" },
  },
  {
    name: "Progetto con doppio 'per'",
    message: "per Rossi da 5000 euro per sito web",
    expected: { clientName: "Rossi", dueDate: "null" },
  },

  // =================== TASK CREATION ===================
  {
    name: "Task semplice",
    message: "Crea task: chiamare Rossi",
    expected: { clientName: null },
  },
  {
    name: "Task con scadenza domani",
    message: "Nuovo task domani: inviare preventivo",
    expected: { clientName: null },
  },

  // =================== EDGE CASES & BUG REGRESSIONS ===================
  {
    name: "Nome con 'da' dentro parola (Azienda)",
    message: "Deal per Azienda Srl. preventivo 3000",
    expected: { clientName: "Azienda Srl", amount: 3000 },
  },
  {
    name: "Nome con trattino nel cognome",
    message: "Progetto per Studio Rossi-Bianchi",
    expected: { clientName: "Studio Rossi" },
  },
  {
    name: "Percentuale con decimale (non deve matchare)",
    message: "Deal con probabilità 85.5%",
    expected: { clientName: null, probability: null },
  },
  {
    name: "Solo percentuale nel testo",
    message: "Porta il deal al 90%",
    expected: { clientName: null, probability: 90 },
  },
  {
    name: "Data chiusura stimata dd/mm/yyyy",
    message: "Deal per Rossi da 1000 euro chiusura 20/12/2026",
    expected: { clientName: "Rossi", amount: 1000, expectedClose: "2026-12-20" },
  },
  {
    name: "Nessun nome cliente",
    message: "Crea progetto",
    expected: { clientName: null },
  },
  {
    name: "Nome con Srl e punto",
    message: "Deal per Tech Solutions Srl. da 5000",
    expected: { clientName: "Tech Solutions Srl", amount: 5000 },
  },
  {
    name: "Mese italiano con anno",
    message: "Progetto per Rossi entro 5 dicembre 2027",
    expected: { clientName: "Rossi", dueDate: "2027-12-05" },
  },
  {
    name: "Euro simbolo",
    message: "Deal per Bianchi da 2500€",
    expected: { clientName: "Bianchi", amount: 2500 },
  },
  {
    name: "Virgola come separatore decimale (non supportato, deve prendere numero pieno)",
    message: "Deal per Verdi da 5,000 euro",
    expected: { clientName: "Verdi", amount: 5000 },
  },
];

function main() {
  const { passed, failed } = runE2ETests("E2E Real-World CRM Messages", tests);

  console.log(`\n\n========================================`);
  console.log(`TOTAL: ${passed}/${passed + failed} passed`);
  if (failed > 0) {
    console.log(`FAILURES: ${failed}`);
    process.exit(1);
  }
  console.log("All E2E tests passed!");
}

main();
