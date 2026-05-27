// Standalone test parser per createTask (no DB deps)

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

const tests = [
  { input: "Crea un task contattare Riccardo per offerta", expectedTitle: "contattare Riccardo per offerta" },
  { input: "Crea task chiamare cliente domani alle 10", expectedTitle: "chiamare cliente domani alle 10" },
  { input: "Nuovo task: revisione contratto", expectedTitle: "revisione contratto" },
  { input: "Aggiungi task per preparare preventivo", expectedTitle: "per preparare preventivo" },
  { input: "Task: seguire lead freddo", expectedTitle: "seguire lead freddo" },
  { input: "Crea task per Rossi - chiamare domani", expectedTitle: "chiamare domani" },
  { input: "crea task", expectedTitle: null },
  { input: "Crea un task", expectedTitle: null },
  { input: "Crea task oggi", expectedTitle: "oggi" },
  { input: "Crea task domani mattina", expectedTitle: "domani mattina" },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = extractAfterKeyword(t.input, ["crea task", "task", "nuovo task"]);
  const ok = result === t.expectedTitle || (result?.trim() === t.expectedTitle);
  if (ok) {
    passed++;
    console.log(`✅ "${t.input}"`);
  } else {
    failed++;
    console.log(`❌ "${t.input}"`);
    console.log(`   Atteso: "${t.expectedTitle}"`);
    console.log(`   Ottenuto: "${result}"`);
  }
}

console.log(`\n${passed}/${tests.length} passati, ${failed} falliti`);
