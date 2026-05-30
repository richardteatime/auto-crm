// ---------------------------------------------------------------------------
// Parser regression tests — run with: npx tsx scripts/test-parsers.ts
// No API key or DB needed. Tests the regex extraction logic inline.
// ---------------------------------------------------------------------------

function extractAfterKeyword(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw);
    if (idx !== -1) {
      const after = text.slice(idx + kw.length).trim();
      return after.replace(/^[:\-\s]+/, "").trim() || null;
    }
  }
  return null;
}

function extractAmount(text: string): number | null {
  const match = text.match(/(\d[\d.\s,]*)(?:\s*(?:k|eur[o?]|€|\$))?/i);
  if (!match) return null;

  let raw = match[1]
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "");

  const hasK = /\d\s*k/i.test(text);
  const val = parseInt(raw, 10);
  if (Number.isNaN(val)) return null;

  return hasK ? val * 1000 : val;
}

function extractClientName(text: string): string | null {
  // Word-boundary aware terminators to avoid matching inside names (e.g. "da" in "Azienda")
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
  if (ddMmMatch) {
    return parseItalianDate(ddMmMatch[1]);
  }

  const textMatch = text.match(/entro\s+(?:il\s+|venerd[iì]\s+|luned[iì]\s+|marted[iì]\s+|mercoled[iì]\s+|gioved[iì]\s+|sabato\s+|domenica\s+)?(\d{1,2}\s+[a-zèé]+(?:\s+\d{4})?)/i);
  if (textMatch) {
    return parseItalianDate(textMatch[1]);
  }

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

function extractNameFromText(text: string): string | null {
  const nameFirstMatch = text.match(/(?:^|\s)(\p{Lu}[^\s,]*(?:\s+\p{Lu}[^\s,]*)*)\s+(?:[Nn]on\s+)?[èÈeE]/u);
  if (nameFirstMatch) {
    const candidate = nameFirstMatch[1].trim();
    if (candidate.toLowerCase() !== "non") return candidate;
  }

  const match = text.match(/contatto\s+([^,]+?)(?:\s+(?:temperatura|temp|caldo|freddo|tibio|hot|cold|warm)|$)/i);
  if (match) return match[1].trim();

  const match2 = text.match(/aggiungi\s+([^,]+?)(?:\s+(?:temperatura|temp|caldo|freddo|tibio|hot|cold|warm)|$)/i);
  if (match2) return match2[1].trim();

  return null;
}

function extractTemperatureFromText(text: string): string | null {
  const t = text.toLowerCase();

  const negMatch = t.match(/(?:non|neanche|neppure)\s+(?:è\s+|e\s+|sono\s+|siamo\s+)?(?:un\s+|una\s+)?(?:contatto\s+)?(fredd[oa]|tiepid[oa]|tibio|caldo|cold|warm|hot)/);
  if (negMatch) {
    const matched = negMatch[1];
    if (/fredd|cold/.test(matched)) return "warm";
    if (/tib|warm|tiepid/.test(matched)) return "hot";
    if (/cald|hot/.test(matched)) return "cold";
  }

  if (/caldo|hot/i.test(t)) return "hot";
  if (/tibio|warm|tiepid/i.test(t)) return "warm";
  if (/freddo|cold/i.test(t)) return "cold";
  return null;
}

function parseTemperature(t: string | null): string | undefined {
  if (!t) return undefined;
  const lower = t.toLowerCase();
  if (lower === "hot" || lower === "caldo") return "hot";
  if (lower === "warm" || lower === "tibio") return "warm";
  if (lower === "cold" || lower === "freddo") return "cold";
  return undefined;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

interface ParserTest {
  name: string;
  input: string;
  fn: (text: string) => string | number | Date | null;
  expected: string | number | null;
}

function runTests(label: string, tests: ParserTest[]) {
  console.log(`\n=== ${label} ===`);
  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const result = t.fn(t.input);
    let resultStr: string;
    if (result === null) resultStr = "null";
    else if (result instanceof Date) resultStr = result.toISOString().slice(0, 10);
    else resultStr = String(result);

    let expectedStr: string;
    if (t.expected === null) expectedStr = "null";
    else if (typeof t.expected === "number") expectedStr = String(t.expected);
    else expectedStr = t.expected;

    const ok = resultStr === expectedStr;
    if (ok) {
      console.log(`  ✅ ${t.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${t.name}`);
      console.log(`     Input:    "${t.input}"`);
      console.log(`     Expected: ${expectedStr}`);
      console.log(`     Got:      ${resultStr}`);
      failed++;
    }
  }

  console.log(`  Result: ${passed}/${tests.length} passed`);
  return { passed, failed };
}

function normalizeExpectedDate(expected: string, result: Date | null): boolean {
  if (expected === "null") return result === null;
  if (expected === "not-null") return result !== null;
  if (result === null) return false;
  return result.toISOString().startsWith(expected);
}

function runDateTests(label: string, tests: { name: string; input: string; fn: (text: string) => Date | null; expected: string }[]) {
  console.log(`\n=== ${label} ===`);
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    const result = t.fn(t.input);
    const ok = normalizeExpectedDate(t.expected, result);
    if (ok) {
      console.log(`  ✅ ${t.name}`);
      passed++;
    } else {
      console.log(`  ❌ ${t.name}`);
      console.log(`     Input:    "${t.input}"`);
      console.log(`     Expected: ${t.expected}`);
      console.log(`     Got:      ${result?.toISOString() ?? "null"}`);
      failed++;
    }
  }
  console.log(`  Result: ${passed}/${tests.length} passed`);
  return { passed, failed };
}

const clientNameTests: ParserTest[] = [
  { name: "Simple name", input: "Crea progetto per Rossi", fn: extractClientName, expected: "Rossi" },
  { name: "Name with comma", input: "Nuovo progetto per Luana ferro, priorità alta", fn: extractClientName, expected: "Luana ferro" },
  { name: "Name with quotes", input: 'Crea deal per "link infissi" da 2000 euro', fn: extractClientName, expected: "link infissi" },
  { name: "Name before dash", input: "Progetto per Mario Bianchi - sito web", fn: extractClientName, expected: "Mario Bianchi" },
  { name: "Name with amount after", input: "Crea deal per Rossi da 5000 euro", fn: extractClientName, expected: "Rossi" },
  { name: "Long text after per", input: "per Luana ferro, priorità alta entro venerdì 29 maggio", fn: extractClientName, expected: "Luana ferro" },
  { name: "Name with period", input: "Deal per Azienda Srl. preventivo 3000", fn: extractClientName, expected: "Azienda Srl" },
  { name: "Name with dash", input: "Progetto per Studio Rossi-Bianchi", fn: extractClientName, expected: "Studio Rossi" },
  { name: "Name with 'con' after", input: "Sito web per Marco con shop", fn: extractClientName, expected: "Marco" },
  { name: "Name with 'da' after", input: "App per Giulia da 10k", fn: extractClientName, expected: "Giulia" },
  { name: "Name with number after (comma)", input: "per Cliente ABC, 5000 euro", fn: extractClientName, expected: "Cliente ABC" },
  { name: "Empty fallback", input: "Crea progetto", fn: extractClientName, expected: "null" },
  { name: "Name with accent", input: "per André Ferro, priorità alta", fn: extractClientName, expected: "André Ferro" },
  { name: "Name at end of sentence", input: "Aggiungi progetto per Paolo", fn: extractClientName, expected: "Paolo" },
  { name: "Double per keyword", input: "per Rossi da 5000 euro per sito web", fn: extractClientName, expected: "Rossi" },
  { name: "Name with 'entro' after", input: "per Bianchi entro domani", fn: extractClientName, expected: "Bianchi" },
  { name: "Name with colon after", input: "per Rossi: sito web", fn: extractClientName, expected: "Rossi" },
  { name: "Name 'priorità' after", input: "per Rossi priorità alta", fn: extractClientName, expected: "Rossi" },
  { name: "Name with 'per' again", input: "per Rossi per sito web", fn: extractClientName, expected: "Rossi" },
  { name: "Name only", input: "per Marco", fn: extractClientName, expected: "Marco" },
];

const amountTests: ParserTest[] = [
  { name: "Simple number", input: "5000 euro", fn: extractAmount, expected: 5000 },
  { name: "Number with dot", input: "5.000 euro", fn: extractAmount, expected: 5000 },
  { name: "Number with comma", input: "5,000 euro", fn: extractAmount, expected: 5000 },
  { name: "K shorthand", input: "5k", fn: extractAmount, expected: 5000 },
  { name: "K with space", input: "10 k", fn: extractAmount, expected: 10000 },
  { name: "Euro symbol", input: "2000 €", fn: extractAmount, expected: 2000 },
  { name: "Dollar symbol", input: "1500 $", fn: extractAmount, expected: 1500 },
  { name: "No currency", input: "prezzo 3000", fn: extractAmount, expected: 3000 },
  { name: "No amount", input: "gratis", fn: extractAmount, expected: "null" },
  { name: "Amount at start", input: "1000 euro per sito", fn: extractAmount, expected: 1000 },
];

const probabilityTests: ParserTest[] = [
  { name: "Simple percent", input: "90%", fn: extractProbability, expected: 90 },
  { name: "Percent with space", input: "80 % probabilità", fn: extractProbability, expected: 80 },
  { name: "Percent in sentence", input: "Deal con probabilità 75%", fn: extractProbability, expected: 75 },
  { name: "Zero percent", input: "0%", fn: extractProbability, expected: 0 },
  { name: "100 percent", input: "100%", fn: extractProbability, expected: 100 },
  { name: "No percent", input: "molto probabile", fn: extractProbability, expected: "null" },
  { name: "Over 100", input: "150%", fn: extractProbability, expected: "null" },
  { name: "Percent with decimal", input: "85.5%", fn: extractProbability, expected: "null" },
];

const dueDateTests = [
  { name: "Domani", input: "entro domani", fn: extractDueDate, expected: "not-null" },
  { name: "Oggi", input: "entro oggi", fn: extractDueDate, expected: "not-null" },
  { name: "dd/mm", input: "entro il 20/06", fn: extractDueDate, expected: "2026-06-20" },
  { name: "dd/mm/yyyy", input: "entro 15/03/2027", fn: extractDueDate, expected: "2027-03-15" },
  { name: "Italian month", input: "entro venerdì 29 maggio", fn: extractDueDate, expected: "2026-05-29" },
  { name: "No date", input: "senza scadenza", fn: extractDueDate, expected: "null" },
  { name: "Italian month short", input: "entro 10 giu", fn: extractDueDate, expected: "2026-06-10" },
  { name: "Italian month with year", input: "entro 5 dicembre 2027", fn: extractDueDate, expected: "2027-12-05" },
];

const expectedCloseTests = [
  { name: "dd/mm in text", input: "30/06", fn: extractExpectedClose, expected: "2026-06-30" },
  { name: "dd/mm/yyyy in text", input: "entro il 15/08/2026", fn: extractExpectedClose, expected: "2026-08-15" },
  { name: "No date", input: "non so quando", fn: extractExpectedClose, expected: "null" },
  { name: "dd/mm/yyyy full", input: "20/12/2026", fn: extractExpectedClose, expected: "2026-12-20" },
];

const contactNameTests: ParserTest[] = [
  { name: "Name before negation", input: "Riccardo non è un contatto freddo", fn: extractNameFromText, expected: "Riccardo" },
  { name: "Full name before negation", input: "Riccardo Consuegra non è tiepido", fn: extractNameFromText, expected: "Riccardo Consuegra" },
  { name: "Name before 'è'", input: "Mario Rossi è caldo", fn: extractNameFromText, expected: "Mario Rossi" },
  { name: "Old pattern still works", input: "Aggiungi contatto Marco Bianchi", fn: extractNameFromText, expected: "Marco Bianchi" },
  { name: "No name", input: "Non è neanche tiepido", fn: extractNameFromText, expected: "null" },
];

const temperatureTests: ParserTest[] = [
  { name: "Non freddo -> warm", input: "Riccardo non è un contatto freddo", fn: extractTemperatureFromText, expected: "warm" },
  { name: "Neanche tiepido -> hot", input: "Non è neanche tiepido", fn: extractTemperatureFromText, expected: "hot" },
  { name: "Neppure freddo -> warm", input: "Neppure freddo", fn: extractTemperatureFromText, expected: "warm" },
  { name: "Non è caldo -> cold", input: "non è caldo", fn: extractTemperatureFromText, expected: "cold" },
  { name: "Positive caldo -> hot", input: "Riccardo è caldo", fn: extractTemperatureFromText, expected: "hot" },
  { name: "Positive tiepido -> warm", input: "è tiepido", fn: extractTemperatureFromText, expected: "warm" },
  { name: "No temperature", input: "Ciao come stai", fn: extractTemperatureFromText, expected: "null" },
];

const parseItalianDateTests = [
  { name: "dd/mm", input: "20/06", fn: parseItalianDate, expected: "2026-06-20" },
  { name: "dd/mm/yyyy", input: "15/03/2027", fn: parseItalianDate, expected: "2027-03-15" },
  { name: "Italian month", input: "29 maggio", fn: parseItalianDate, expected: "2026-05-29" },
  { name: "Italian month with year", input: "10 dicembre 2027", fn: parseItalianDate, expected: "2027-12-10" },
  { name: "Short month", input: "5 giu", fn: parseItalianDate, expected: "2026-06-05" },
  { name: "Domani", input: "domani", fn: parseItalianDate, expected: "not-null" },
  { name: "Oggi", input: "oggi", fn: parseItalianDate, expected: "not-null" },
  { name: "Empty", input: "", fn: parseItalianDate, expected: "null" },
];

function main() {
  let totalPassed = 0;
  let totalFailed = 0;

  const cn = runTests("extractClientName", clientNameTests);
  totalPassed += cn.passed;
  totalFailed += cn.failed;

  const am = runTests("extractAmount", amountTests);
  totalPassed += am.passed;
  totalFailed += am.failed;

  const pr = runTests("extractProbability", probabilityTests);
  totalPassed += pr.passed;
  totalFailed += pr.failed;

  const dd = runDateTests("extractDueDate", dueDateTests);
  totalPassed += dd.passed;
  totalFailed += dd.failed;

  const ec = runDateTests("extractExpectedClose", expectedCloseTests);
  totalPassed += ec.passed;
  totalFailed += ec.failed;

  const pid = runDateTests("parseItalianDate", parseItalianDateTests);
  totalPassed += pid.passed;
  totalFailed += pid.failed;

  const cn2 = runTests("extractNameFromText (contact)", contactNameTests);
  totalPassed += cn2.passed;
  totalFailed += cn2.failed;

  const temp = runTests("extractTemperatureFromText", temperatureTests);
  totalPassed += temp.passed;
  totalFailed += temp.failed;

  console.log(`\n\n========================================`);
  console.log(`TOTAL: ${totalPassed}/${totalPassed + totalFailed} passed`);
  if (totalFailed > 0) {
    console.log(`FAILURES: ${totalFailed}`);
    process.exit(1);
  }
  console.log(`All parser tests passed!`);
}

main();
