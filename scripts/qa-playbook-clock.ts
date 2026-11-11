// QA only (never on prod): runs the playbook engine with a clock moved forward, to check timed sequences.
// Usage: npx tsx scripts/qa-playbook-clock.ts <days> [stepHours]
import { runPlaybook } from "../src/lib/vendiora/engine";

async function main() {
  if (/easlydev|appwrite\.app/.test(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "")) throw new Error("solo in locale");
  const days = Number(process.argv[2] || 30);
  const step = Number(process.argv[3] || 12) * 3_600_000;
  const start = Date.now();
  for (let t = start; t <= start + days * 86_400_000; t += step) {
    const r = await runPlaybook(t);
    const nz = Object.fromEntries(Object.entries(r).filter(([, v]) => v));
    if (Object.keys(nz).length) console.log(`+${((t - start) / 86_400_000).toFixed(1)}g`, JSON.stringify(nz));
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
