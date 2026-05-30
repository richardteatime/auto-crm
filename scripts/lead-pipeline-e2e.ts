#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Lead Pipeline MVP — End-to-End test (scenario "Marco Rossi", PLAN.md)
// -----------------------------------------------------------------------------
// Uso:
//   npx tsx scripts/lead-pipeline-e2e.ts
//   REQUIRE_APPWRITE_E2E=true npx tsx scripts/lead-pipeline-e2e.ts
//
// Due parti:
//   PART A — Logica deterministica (parser, scoring, categoria, bozza
//            preventivo). NON richiede Appwrite: gira sempre.
//   PART B — Flusso completo su Appwrite (email inbound → dedup → automazioni → call
//            outcome → proposal → quote → notifica). Gira SOLO se Appwrite è
//            raggiungibile; altrimenti viene saltata. Impostare
//            REQUIRE_APPWRITE_E2E=true per trattare lo skip come errore.
//
// NB sicurezza (PLAN): il test NON cancella mai i lead. La PART B crea un lead
// marcato (source "e2e-test") e ne stampa l'id per ispezione manuale.
// -----------------------------------------------------------------------------

// Engine interno deterministico per il test (n8n disattivato).
process.env.ENABLE_N8N_AUTOMATIONS = "false";

import { config } from "dotenv";
import type { Lead } from "@/lib/leads/types";
import type { NextRequest } from "next/server";

config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Scenario input (PLAN.md — "Test end-to-end finale")
// ---------------------------------------------------------------------------
const SCENARIO_EMAIL = [
  "Nome: Marco",
  "Cognome: Rossi",
  "Email: marco@example.com",
  "Telefono: +393331234567",
  "Azienda: Trattoria Rossi",
  "Messaggio: Mi serve un sito per il mio ristorante",
  "Budget: 1500",
].join("\n");

const EXPECTED = {
  firstName: "Marco",
  lastName: "Rossi",
  email: "marco@example.com",
  phone: "+393331234567",
  company: "Trattoria Rossi",
  category: "static_website" as const,
  // PLAN prose dice "80/100", ma elenca TUTTI e 5 i fattori (email, telefono,
  // messaggio, categoria, budget). Il parser estrae "Budget: 1500" nel campo
  // scored, quindi per la tabella di scoring autorevole il punteggio è 100.
  // Il "80" nella prosa è un'incongruenza aritmetica del piano (4×20). Il test
  // verifica la tabella, non la prosa. (Documentato in IMPLEMENTATION_LOG.md.)
  score: 100,
  basePriceCents: 120000, // static_website basePrice 1200 € → 120000 cent
  clientBudget: 1500,
};

// ---------------------------------------------------------------------------
// Mini test runner (stesso stile di scripts/gate1-e2e.ts)
// ---------------------------------------------------------------------------
interface TestResult {
  name: string;
  passed: boolean;
  skipped?: boolean;
  error?: string;
}
const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, error: msg });
    console.error(`❌ ${name}: ${msg}`);
  }
}

function skipTest(name: string, why: string) {
  results.push({ name, passed: true, skipped: true });
  console.log(`⚠️  ${name} — SALTATO: ${why}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function eq<T>(actual: T, expected: T, label: string) {
  assert(
    actual === expected,
    `${label}: atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`,
  );
}

// Replica del fold budget→customFields fatto da /api/leads/email-inbound.
function syntheticLeadFromParsed(parsed: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  businessName?: string | null;
  website?: string | null;
  projectType?: string | null;
  category?: Lead["category"];
  budget?: string | null;
  message?: string | null;
  customFields: Record<string, string>;
}): Lead {
  const customFields: Record<string, string> = { ...parsed.customFields };
  if (parsed.budget && !customFields.budget) customFields.budget = parsed.budget;
  const now = new Date();
  return {
    id: "synthetic-e2e",
    firstName: parsed.firstName ?? null,
    lastName: parsed.lastName ?? null,
    fullName: parsed.fullName || "Lead senza nome",
    email: parsed.email ?? null,
    phone: parsed.phone ?? null,
    company: parsed.company ?? null,
    businessName: parsed.businessName ?? null,
    website: parsed.website ?? null,
    projectType: parsed.projectType ?? null,
    category: parsed.category ?? "unknown",
    source: "email",
    formName: null,
    message: parsed.message ?? null,
    rawSubject: null,
    rawBody: SCENARIO_EMAIL,
    customFields: JSON.stringify(customFields),
    status: "new",
    pipelineStage: "prospect",
    assignedTo: null,
    leadScore: 0,
    contactId: null,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
async function main() {
  console.log("\n=== PART A — Logica deterministica (no Appwrite) ===\n");

  const { parseLeadEmail } = await import("@/lib/leads/parser");
  const { scoreFromParsed, scoreBand, hasClearRequest } = await import(
    "@/lib/leads/scoring"
  );
  const { buildQuoteDraft } = await import("@/lib/leads/quotes");

  const { parsed, strategy } = await parseLeadEmail({
    subject: "Nuova richiesta dal form",
    text: SCENARIO_EMAIL,
  });

  await test("A1 — Parser estrae i campi base (chiave-valore)", async () => {
    eq(strategy, "key_value", "strategy");
    eq(parsed.firstName ?? null, EXPECTED.firstName, "firstName");
    eq(parsed.lastName ?? null, EXPECTED.lastName, "lastName");
    eq(parsed.fullName ?? null, "Marco Rossi", "fullName");
    eq(parsed.email ?? null, EXPECTED.email, "email");
    eq(parsed.phone ?? null, EXPECTED.phone, "phone");
    eq(parsed.company ?? null, EXPECTED.company, "company");
    eq(parsed.budget ?? null, "1500", "budget");
    assert(
      (parsed.message ?? "").toLowerCase().includes("sito"),
      `message dovrebbe contenere la richiesta, ottenuto: ${parsed.message}`,
    );
  });

  await test("A2 — Categoria = static_website", async () => {
    eq(parsed.category ?? "unknown", EXPECTED.category, "category");
  });

  await test("A3 — Score = 100 (tutti e 5 i fattori) — band 'hot'", async () => {
    // Breakdown esplicito (tabella PLAN: ognuno +20).
    assert(!!parsed.email, "fattore email mancante");
    assert(!!parsed.phone, "fattore telefono mancante");
    assert(hasClearRequest(parsed.message), "fattore richiesta chiara mancante");
    assert(
      (parsed.category ?? "unknown") !== "unknown",
      "fattore categoria mancante",
    );
    assert(!!parsed.budget, "fattore budget mancante");

    const score = scoreFromParsed(parsed);
    eq(score, EXPECTED.score, "leadScore (tabella autorevole, non la prosa '80')");
    eq(scoreBand(score), "hot", "scoreBand");
  });

  await test("A4 — Bozza preventivo: 1200 € (120000 cent) + budget 1500", async () => {
    const lead = syntheticLeadFromParsed(parsed);
    const draft = buildQuoteDraft(lead);
    eq(draft.category, EXPECTED.category, "draft.category");
    eq(draft.amountSuggested, EXPECTED.basePriceCents, "draft.amountSuggested (cent)");
    eq(draft.clientBudget, EXPECTED.clientBudget, "draft.clientBudget");
    assert(draft.items.length >= 1, "draft.items vuoto");
    eq(draft.items[0].amount, EXPECTED.basePriceCents, "draft.items[0].amount");
    assert(
      (draft.generatedText ?? "").includes("BOZZA"),
      "generatedText dovrebbe marcare la bozza",
    );
    // Regola di sicurezza PLAN: mai inviare senza approvazione manuale.
    assert(
      (draft.generatedText ?? "").includes("approvazione manuale"),
      "generatedText DEVE contenere l'avviso di approvazione manuale (regola sicurezza)",
    );
  });

  // -------------------------------------------------------------------------
  console.log("\n=== PART B — Flusso completo su Appwrite ===\n");

  const db = await import("@/lib/db");
  const { fireTrigger } = await import("@/lib/leads/automation");
  const { POST: receiveInboundEmail } = await import(
    "@/app/api/leads/email-inbound/route"
  );

  // Probe: Appwrite raggiungibile e collection 'leads' presente?
  let appwriteUp = false;
  try {
    await db.listLeads();
    appwriteUp = true;
  } catch (e) {
    console.log(
      `[probe] Appwrite non raggiungibile (${e instanceof Error ? e.message : e})`,
    );
  }

  if (!appwriteUp) {
    for (const name of [
      "B1 — Lead creato in prospect",
      "B2 — Email inbound deduplicata sul lead esistente",
      "B3 — Movimento pipeline tracciato (→ prospect)",
      "B4 — Automation run loggata + call task Leo",
      "B5 — Leo registra outcome needs_quote → call_completed",
      "B6 — Lead spostato a proposal (status qualified)",
      "B7 — Quote draft generato e persistito (1200 €)",
      "B8 — Founder notificato (azione proposal eseguita)",
    ]) {
      skipTest(name, "Appwrite non configurato/raggiungibile");
    }
  } else {
    // Lead marcato e con email unica per non collidere con la dedup tra run.
    const stamp = Date.now();
    const liveEmail = `marco.rossi+e2e-${stamp}@example.com`;
    const livePhone = `+39333${String(stamp).slice(-7)}`;
    const liveCompany = `Trattoria Rossi E2E ${stamp}`;
    const inboundText = SCENARIO_EMAIL
      .replace("marco@example.com", liveEmail)
      .replace("+393331234567", livePhone)
      .replace("Trattoria Rossi", liveCompany);
    let leadId = "";

    await test("B1 — Lead creato in prospect", async () => {
      const secret = await db.getSetting("webhook_secret");
      const headers = new Headers({
        "content-type": "application/json",
        "x-forwarded-for": `lead-pipeline-e2e-${stamp}`,
      });
      if (secret) headers.set("x-webhook-secret", secret);
      const response = await receiveInboundEmail(
        new Request("http://localhost/api/leads/email-inbound", {
          method: "POST",
          headers,
          body: JSON.stringify({
            subject: "Nuova richiesta dal form",
            text: inboundText,
            from: `Marco Rossi <${liveEmail}>`,
            formName: "lead-pipeline-e2e",
          }),
        }) as NextRequest,
      );
      const body = (await response.json()) as {
        action?: string;
        error?: string;
        leadId?: string;
      };
      eq(response.status, 201, `email inbound HTTP status (${body.error ?? "no error"})`);
      eq(body.action, "created", "email inbound action");
      assert(!!body.leadId, "email inbound non ha restituito leadId");
      leadId = body.leadId!;
      const lead = await db.getLead(leadId);
      assert(lead !== null, "lead creato dall'endpoint non trovato");
      console.log(`   leadId creato: ${leadId} (non verrà cancellato)`);
      eq(lead!.pipelineStage, "prospect", "pipelineStage");
      eq(lead!.category, "static_website", "category");
      eq(lead!.leadScore, EXPECTED.score, "leadScore");
    });

    await test("B2 — Email inbound deduplicata sul lead esistente", async () => {
      const secret = await db.getSetting("webhook_secret");
      const headers = new Headers({
        "content-type": "application/json",
        "x-forwarded-for": `lead-pipeline-e2e-dedup-${stamp}`,
      });
      if (secret) headers.set("x-webhook-secret", secret);
      const response = await receiveInboundEmail(
        new Request("http://localhost/api/leads/email-inbound", {
          method: "POST",
          headers,
          body: JSON.stringify({
            subject: "Seconda richiesta dallo stesso form",
            text: inboundText,
            from: `Marco Rossi <${liveEmail}>`,
            formName: "lead-pipeline-e2e",
          }),
        }) as NextRequest,
      );
      const body = (await response.json()) as {
        action?: string;
        deduped?: boolean;
        error?: string;
        leadId?: string;
      };
      eq(response.status, 200, `dedup HTTP status (${body.error ?? "no error"})`);
      eq(body.action, "updated", "dedup action");
      eq(body.deduped, true, "deduped");
      eq(body.leadId, leadId, "dedup leadId");
    });

    await test("B3 — Movimento pipeline tracciato (→ prospect)", async () => {
      const movements = await db.listPipelineMovements(leadId);
      assert(
        movements.some((m) => m.toStage === "prospect"),
        "atteso un movimento verso prospect",
      );
    });

    await test("B4 — Automation run loggata + call task Leo", async () => {
      const runs = await db.listAutomationRuns({ leadId });
      assert(runs.length >= 1, "attesa almeno una automation run loggata");
      assert(
        runs.some((r) => r.triggerType === "lead_created"),
        "attesa una run per trigger lead_created",
      );
      const task = await db.getOpenCallTaskForLead(leadId);
      assert(task !== null, "attesa una call task aperta per Leo");
    });

    await test("B5 — Leo registra outcome needs_quote → call_completed", async () => {
      const task = await db.getOpenCallTaskForLead(leadId);
      assert(task !== null, "nessuna call task da completare");
      await db.updateCallTask(task!.id, {
        status: "completed",
        callOutcome: "needs_quote",
        completedAt: new Date(),
        notes: "Cliente interessato a sito ristorante con admin.",
      });
      // Stesso payload dell'endpoint /call-outcome.
      await fireTrigger("call_completed", {
        leadId,
        outcome: "needs_quote",
        notes: "Cliente interessato a sito ristorante con admin.",
        callTaskId: task!.id,
      });
    });

    await test("B6 — Lead spostato a proposal (status qualified)", async () => {
      const lead = await db.getLead(leadId);
      assert(lead !== null, "lead non trovato dopo call_completed");
      eq(lead!.pipelineStage, "proposal", "pipelineStage dopo needs_quote");
      eq(lead!.status, "qualified", "status dopo needs_quote");
      const movements = await db.listPipelineMovements(leadId);
      assert(
        movements.some((m) => m.toStage === "proposal"),
        "atteso un movimento verso proposal",
      );
    });

    await test("B7 — Quote draft generato e persistito (1200 €)", async () => {
      const quotes = await db.listLeadQuotes(leadId);
      const draft = quotes.find((q) => q.status === "draft");
      assert(draft !== undefined, "attesa una bozza preventivo (status draft)");
      eq(draft!.category, "static_website", "quote.category");
      eq(draft!.amountSuggested, EXPECTED.basePriceCents, "quote.amountSuggested");
      assert(
        (draft!.generatedText ?? "").includes("approvazione manuale"),
        "la bozza DEVE riportare l'avviso di approvazione manuale",
      );
    });

    await test("B8 — Founder notificato (azione proposal eseguita)", async () => {
      const runs = await db.listAutomationRuns({ leadId });
      const proposalRun = runs.find(
        (r) => r.triggerType === "stage_changed_to_proposal",
      );
      assert(
        proposalRun !== undefined,
        "attesa una run per stage_changed_to_proposal",
      );
      let actions: string[] = [];
      try {
        actions = JSON.parse(proposalRun!.actionsExecuted ?? "[]");
      } catch {
        actions = [];
      }
      assert(
        actions.some((a) => a.startsWith("notify_founder_admin")),
        `attesa azione notify_founder_admin, ottenuto: ${proposalRun!.actionsExecuted}`,
      );
    });
  }

  // -------------------------------------------------------------------------
  const passed = results.filter((r) => r.passed && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.passed).length;
  const requireAppwrite = process.env.REQUIRE_APPWRITE_E2E === "true";

  console.log(
    `\n${"=".repeat(64)}\nLead Pipeline E2E: ${passed} passed, ${skipped} skipped, ${failed} failed / ${results.length} totale\n${"=".repeat(64)}`,
  );
  if (failed > 0 || (requireAppwrite && skipped > 0)) {
    console.error("\nTest falliti:");
    for (const r of results.filter((r) => !r.passed)) {
      console.error(`  - ${r.name}: ${r.error}`);
    }
    if (requireAppwrite && skipped > 0) {
      console.error("  - PART B Appwrite obbligatoria: gli skip non sono ammessi.");
    }
    process.exitCode = 1;
  } else {
    console.log(
      skipped > 0
        ? "\n✅ Logica deterministica OK. PART B saltata (Appwrite non disponibile)."
        : "\n🎉 Scenario Marco Rossi verificato end-to-end.",
    );
  }
}

main().catch((err) => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
