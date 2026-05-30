import { callHermes } from "@/lib/hermes/client";

async function main() {
  console.log("[test] Calling Hermes...");
  const start = Date.now();
  const result = await callHermes("Quanti contatti ci sono nel CRM?", 9999);
  const elapsed = Date.now() - start;
  console.log("[test] Reply:", result.reply);
  console.log("[test] Session:", result.sessionId);
  console.log("[test] Elapsed:", elapsed, "ms");
}

main().catch((err) => {
  console.error("[test] Error:", err);
  process.exit(1);
});
