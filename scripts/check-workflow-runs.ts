/**
 * Diagnostica: mostra i workflow attivi su form_submitted, gli ultimi run e i
 * log dei nodi (per capire se send_email è ok / skipped / failed).
 *   npx tsx scripts/check-workflow-runs.ts
 */
import { Client, Databases, Query } from "node-appwrite";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1")
  .setProject(process.env.APPWRITE_PROJECT_ID || "")
  .setKey(process.env.APPWRITE_API_KEY || "");
const db = new Databases(client);
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

async function main() {
  console.log("RESEND_API_KEY presente in .env.local:", !!process.env.RESEND_API_KEY);

  const wfs = await db.listDocuments(DB_ID, "workflows", [
    Query.equal("triggerType", "form_submitted"),
    Query.limit(10),
  ]);
  console.log(`\nWorkflow con trigger form_submitted: ${wfs.total}`);
  for (const w of wfs.documents) {
    console.log(`  - ${w.name} | status=${w.status} | id=${w.$id}`);
  }

  const runs = await db.listDocuments(DB_ID, "workflow_runs", [
    Query.orderDesc("$createdAt"),
    Query.limit(8),
  ]);
  console.log(`\nUltimi workflow_runs: ${runs.total}`);
  for (const r of runs.documents) {
    console.log(
      `\nRUN ${r.$id} | wf=${r.workflowId} | trigger=${r.triggerType} | status=${r.status} | error=${r.error ?? "-"}`,
    );
    const logs = await db.listDocuments(DB_ID, "workflow_run_logs", [
      Query.equal("runId", r.$id),
      Query.limit(30),
    ]);
    if (logs.total === 0) {
      console.log("   (nessun log di nodo)");
    }
    for (const l of logs.documents) {
      console.log(
        `   • ${l.nodeType} | ${l.status} | err=${l.error ?? "-"} | out=${String(l.output ?? "").slice(0, 140)}`,
      );
    }
  }
}

main().catch((e) => {
  console.error("Errore diagnosi:", e);
  process.exit(1);
});
