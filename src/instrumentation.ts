// Background lead checks (escalation of uncalled leads, due call-back reminders).
// Runs only where LEAD_CRON_ENABLED=1, i.e. the production instance: the preview
// shares the same database and must not send duplicate alerts.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.LEAD_CRON_ENABLED !== "1") return;

  const g = globalThis as unknown as { __leadChecks?: NodeJS.Timeout };
  if (g.__leadChecks) return;

  const everyMs = Math.max(60_000, Number(process.env.LEAD_CHECK_INTERVAL_MS || 120_000));
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { runLeadChecks } = await import("@/lib/leads/notify");
      const r = await runLeadChecks();
      if (r.escalated || r.reminded) console.log(`[lead checks] escalated=${r.escalated} reminded=${r.reminded}`);
    } catch (e) {
      console.error("[lead checks]", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };
  g.__leadChecks = setInterval(tick, everyMs);
  setTimeout(tick, 15_000);
}
