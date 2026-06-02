#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Visual Workflow Builder (FASE 3) — End-to-End test
// -----------------------------------------------------------------------------
// Uso:
//   npx tsx scripts/workflow-e2e.ts
//   REQUIRE_APPWRITE_E2E=true npx tsx scripts/workflow-e2e.ts
//
// Due parti (stesso stile di scripts/lead-pipeline-e2e.ts):
//   PART A — Logica deterministica (registry, condition branching,
//            interpolazione variabili). NON richiede Appwrite: gira sempre.
//   PART B — Esecuzione reale del WorkflowExecutor su Appwrite (branching su
//            edge true/false + scheduling dei delay). Gira SOLO se Appwrite è
//            raggiungibile; altrimenti viene saltata. REQUIRE_APPWRITE_E2E=true
//            tratta lo skip come errore.
//
// SICUREZZA:
//   - n8n disattivato.
//   - RESEND_API_KEY rimossa DOPO il load di .env.local: i nodi `send_email`
//     usati come terminali innocui fanno SEMPRE skip → nessuna email reale.
//   - I workflow di test sono creati in stato `draft` (i trigger reali filtrano
//     `status=active`, quindi NON si attivano con eventi di produzione) e
//     vengono cancellati a fine test. I record schedulati di test vengono
//     cancellati. Le run/log restano come audit (inoffensivi).
// -----------------------------------------------------------------------------

process.env.ENABLE_N8N_AUTOMATIONS = "false";

import { config } from "dotenv";
import type {
  FlowNode,
  FlowEdge,
  NodeExecutorInput,
  Workflow,
} from "@/lib/workflows/types";

// 1) Carica .env.local, 2) POI rimuovi RESEND così send_email fa skip.
config({ path: ".env.local" });
delete process.env.RESEND_API_KEY;

// ---------------------------------------------------------------------------
// Mini test runner (stesso stile di scripts/lead-pipeline-e2e.ts)
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

// Costruttore di input per testare un singolo NodeExecutor in isolamento.
function execInput(
  cfg: Record<string, unknown>,
  payload: Record<string, unknown>,
  variables: Record<string, unknown> = {},
): NodeExecutorInput {
  return {
    nodeId: "test-node",
    nodeType: "test",
    config: cfg,
    context: { trigger: { type: "test", payload }, variables },
  };
}

// ---------------------------------------------------------------------------
async function main() {
  console.log("\n=== PART A — Logica deterministica (no Appwrite) ===\n");

  const types = await import("@/lib/workflows/types");
  const registry = await import("@/lib/workflows/registry");
  const handlers = await import("@/lib/workflows/handlers");

  await test("A1 — Registry: trigger/condition/delay + azioni implementate", async () => {
    // Trigger (6), condition (4), delay (2): tutti registrati con la categoria giusta.
    for (const t of types.TRIGGER_NODE_TYPES) {
      const def = registry.getNodeDefinition(t);
      assert(def !== undefined, `trigger '${t}' non registrato`);
      eq(def!.category, "trigger", `categoria di '${t}'`);
    }
    for (const t of types.CONDITION_NODE_TYPES) {
      const def = registry.getNodeDefinition(t);
      assert(def !== undefined, `condition '${t}' non registrata`);
      eq(def!.category, "condition", `categoria di '${t}'`);
    }
    for (const t of types.DELAY_NODE_TYPES) {
      const def = registry.getNodeDefinition(t);
      assert(def !== undefined, `delay '${t}' non registrato`);
      eq(def!.category, "delay", `categoria di '${t}'`);
    }
    // Azioni effettivamente implementate (9). Le azioni non implementate NON
    // devono essere esposte nell'editor: un nodo configurabile ma ineseguibile
    // sarebbe un bug di prodotto, non una feature incompleta innocua.
    const implementedActions = [
      "create_contact",
      "update_contact",
      "create_deal",
      "update_deal",
      "create_task",
      "send_email",
      "send_internal_message",
      "move_pipeline_stage",
      "http_request",
    ];
    for (const t of implementedActions) {
      assert(registry.getNodeDefinition(t) !== undefined, `azione '${t}' non registrata`);
    }
    eq(
      registry.getAllNodeDefinitions().length,
      types.TRIGGER_NODE_TYPES.length + types.CONDITION_NODE_TYPES.length +
        types.DELAY_NODE_TYPES.length + implementedActions.length,
      "numero totale di nodi registrati (21)",
    );
    assert(
      registry.getNodeDefinition("create_note") === undefined,
      "create_note non implementato non deve avere un executor",
    );
    assert(
      !(types.ACTION_NODE_TYPES as readonly string[]).includes("create_note"),
      "create_note non implementato non deve essere esposto nell'editor",
    );
  });

  await test("A2 — if_field_equals: ramo TRUE quando il campo coincide", async () => {
    const r = await handlers.ifFieldEqualsExecutor(
      execInput(
        { field: "category", compareValue: "hot", trueNextNodeId: "T", falseNextNodeId: "F" },
        { category: "hot" },
      ),
    );
    eq(r.status, "ok", "status");
    assert(r.output?.result === true, "output.result dovrebbe essere true");
    eq(r.nextNodeId, "T", "nextNodeId (ramo true)");
  });

  await test("A3 — if_field_equals: ramo FALSE quando il campo differisce", async () => {
    const r = await handlers.ifFieldEqualsExecutor(
      execInput(
        { field: "category", compareValue: "hot", trueNextNodeId: "T", falseNextNodeId: "F" },
        { category: "cold" },
      ),
    );
    assert(r.output?.result === false, "output.result dovrebbe essere false");
    eq(r.nextNodeId, "F", "nextNodeId (ramo false)");
  });

  await test("A4 — if_score_above: confronto soglia su variabili di contesto", async () => {
    const hi = await handlers.ifScoreAboveExecutor(execInput({ threshold: 70 }, {}, { score: 80 }));
    assert(hi.output?.result === true, "score 80 > 70 dovrebbe essere true");
    const lo = await handlers.ifScoreAboveExecutor(execInput({ threshold: 70 }, {}, { score: 50 }));
    assert(lo.output?.result === false, "score 50 > 70 dovrebbe essere false");
  });

  await test("A5 — Interpolazione {{trigger.payload.*}} nelle condizioni", async () => {
    const match = await handlers.ifFieldEqualsExecutor(
      execInput(
        { field: "{{trigger.payload.email}}", compareValue: "marco@example.com" },
        { email: "marco@example.com" },
      ),
    );
    assert(match.output?.result === true, "la variabile interpolata dovrebbe combaciare");
    const noMatch = await handlers.ifFieldEqualsExecutor(
      execInput(
        { field: "{{trigger.payload.email}}", compareValue: "marco@example.com" },
        { email: "altro@example.com" },
      ),
    );
    assert(noMatch.output?.result === false, "email diversa: non dovrebbe combaciare");
  });

  // -------------------------------------------------------------------------
  console.log("\n=== PART B — WorkflowExecutor su Appwrite ===\n");

  const db = await import("@/lib/db");
  const { WorkflowExecutor } = await import("@/lib/workflows/executor");

  // Probe: Appwrite raggiungibile e collection 'workflows' presente?
  let appwriteUp = false;
  try {
    await db.listWorkflows();
    appwriteUp = true;
  } catch (e) {
    console.log(
      `[probe] Appwrite non raggiungibile (${e instanceof Error ? e.message : e})`,
    );
  }

  if (!appwriteUp) {
    for (const name of [
      "B1 — Workflow di branching creato (draft)",
      "B2 — Esecuzione ramo TRUE (category=hot)",
      "B3 — Esecuzione ramo FALSE (category=cold)",
      "B4 — Delay: run 'scheduled' + workflowId persistito (fix resume)",
    ]) {
      skipTest(name, "Appwrite non configurato/raggiungibile");
    }
  } else {
    const stamp = Date.now();
    const createdWorkflowIds: string[] = [];
    const innocuousEmail = {
      to: "e2e-noreply@example.com",
      subject: "[E2E] test",
      body: "test",
    };
    let branchWf: Workflow | null = null;

    await test("B1 — Workflow di branching creato (draft)", async () => {
      const nodes: FlowNode[] = [
        { id: "n_trigger", type: "trigger", position: { x: 0, y: 0 }, data: { nodeType: "contact_created", label: "Trigger", config: {} } },
        { id: "n_cond", type: "condition", position: { x: 0, y: 100 }, data: { nodeType: "if_field_equals", label: "Se hot", config: { field: "category", compareValue: "hot" } } },
        { id: "n_hot", type: "action", position: { x: -120, y: 220 }, data: { nodeType: "send_email", label: "Email Hot", config: innocuousEmail } },
        { id: "n_cold", type: "action", position: { x: 120, y: 220 }, data: { nodeType: "send_email", label: "Email Cold", config: innocuousEmail } },
      ];
      const edges: FlowEdge[] = [
        { id: "e1", source: "n_trigger", target: "n_cond" },
        { id: "e2", source: "n_cond", target: "n_hot", label: "true" },
        { id: "e3", source: "n_cond", target: "n_cold", label: "false" },
      ];
      branchWf = await db.createWorkflow({
        name: `[E2E] branch ${stamp}`,
        triggerType: "contact_created",
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
      });
      createdWorkflowIds.push(branchWf.id);
      console.log(`   workflow branch creato: ${branchWf.id}`);
      eq(branchWf.status, "draft", "status iniziale (non si auto-attiva)");
      const parsed = JSON.parse(branchWf.nodes) as FlowNode[];
      eq(parsed.length, 4, "nodi persistiti");
    });

    await test("B2 — Esecuzione ramo TRUE (category=hot)", async () => {
      assert(branchWf !== null, "workflow branch non creato (B1 fallito)");
      const res = await new WorkflowExecutor().run(branchWf!, { category: "hot", email: "e2e@example.com" });
      eq(res.status, "completed", `run status (${res.error ?? "no error"})`);
      assert(!!res.runId, "runId mancante");
      const logs = await db.listWorkflowRunLogs(res.runId!);
      const nodeIds = logs.map((l) => l.nodeId);
      assert(nodeIds.includes("n_cond"), "il nodo condizione dovrebbe essere loggato");
      assert(nodeIds.includes("n_hot"), "il ramo TRUE (n_hot) dovrebbe essere eseguito");
      assert(!nodeIds.includes("n_cold"), "il ramo FALSE (n_cold) NON dovrebbe essere eseguito");
      const emailLog = logs.find((l) => l.nodeId === "n_hot");
      eq(emailLog?.status, "skipped", "send_email senza RESEND → skipped (nessuna email reale)");
    });

    await test("B3 — Esecuzione ramo FALSE (category=cold)", async () => {
      assert(branchWf !== null, "workflow branch non creato (B1 fallito)");
      const res = await new WorkflowExecutor().run(branchWf!, { category: "cold", email: "e2e@example.com" });
      eq(res.status, "completed", `run status (${res.error ?? "no error"})`);
      const logs = await db.listWorkflowRunLogs(res.runId!);
      const nodeIds = logs.map((l) => l.nodeId);
      assert(nodeIds.includes("n_cold"), "il ramo FALSE (n_cold) dovrebbe essere eseguito");
      assert(!nodeIds.includes("n_hot"), "il ramo TRUE (n_hot) NON dovrebbe essere eseguito");
    });

    await test("B4 — Delay: run 'scheduled' + workflowId persistito (fix resume)", async () => {
      const nodes: FlowNode[] = [
        { id: "d_trigger", type: "trigger", position: { x: 0, y: 0 }, data: { nodeType: "contact_created", label: "Trigger", config: {} } },
        { id: "d_wait", type: "delay", position: { x: 0, y: 100 }, data: { nodeType: "wait_for", label: "Attendi 5m", config: { amount: 5, unit: "minutes" } } },
        { id: "d_after", type: "action", position: { x: 0, y: 220 }, data: { nodeType: "send_email", label: "Email dopo", config: innocuousEmail } },
      ];
      const edges: FlowEdge[] = [
        { id: "de1", source: "d_trigger", target: "d_wait" },
        { id: "de2", source: "d_wait", target: "d_after" },
      ];
      const delayWf = await db.createWorkflow({
        name: `[E2E] delay ${stamp}`,
        triggerType: "contact_created",
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
      });
      createdWorkflowIds.push(delayWf.id);

      const res = await new WorkflowExecutor().run(delayWf, { email: "e2e@example.com" });
      eq(res.status, "scheduled", `run dovrebbe sospendersi sul delay (${res.error ?? "no error"})`);
      assert(!!res.runId, "runId mancante");

      const pending = await db.listWorkflowScheduled("pending");
      const mine = pending.find((s) => s.runId === res.runId);
      assert(mine !== undefined, "atteso un record workflow_scheduled per questa run");
      eq(mine!.nodeId, "d_wait", "il delay schedulato punta al nodo wait");
      // Il fix: senza di esso workflowId sarebbe "" e il worker non ritroverebbe
      // mai il workflow (getWorkflow("") → null → 'Workflow non trovato').
      eq(mine!.workflowId, delayWf.id, "workflowId persistito nel record schedulato");

      // Cleanup del record schedulato di test (così il worker non lo processa).
      try {
        await db.deleteWorkflowScheduled(mine!.id);
      } catch {
        // best-effort
      }
    });

    // Cleanup: rimuovi i workflow di test (erano in draft → mai attivi).
    for (const id of createdWorkflowIds) {
      try {
        await db.deleteWorkflow(id);
      } catch {
        // best-effort
      }
    }
    console.log(`   cleanup: ${createdWorkflowIds.length} workflow di test rimossi`);
  }

  // -------------------------------------------------------------------------
  const passed = results.filter((r) => r.passed && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.passed).length;
  const requireAppwrite = process.env.REQUIRE_APPWRITE_E2E === "true";

  console.log(
    `\n${"=".repeat(64)}\nWorkflow Builder E2E: ${passed} passed, ${skipped} skipped, ${failed} failed / ${results.length} totale\n${"=".repeat(64)}`,
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
        : "\n🎉 Workflow Builder verificato end-to-end (branching + delay scheduling).",
    );
  }
}

main().catch((err) => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
