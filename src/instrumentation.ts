// Background checks.
// - Lead checks (escalation of uncalled leads, due call-back reminders): only where
//   LEAD_CRON_ENABLED=1, i.e. the SarconX production instance. The preview shares
//   the same database and must not send duplicate alerts; separate CRMs share the
//   leads too, so they keep it off.
// - Quote expiry alerts (3 days before + expiry day, unpaid quotes): where
//   LEAD_CRON_ENABLED=1 or QUOTE_CRON_ENABLED=1. Each CRM instance with its own
//   database (e.g. CRM Matteo) sets QUOTE_CRON_ENABLED=1; the preview sets neither.
// - Vendiora automatic WhatsApp (call reminders, offer follow-ups/expiry, end of coaching):
//   only with LEAD_CRON_ENABLED=1 and Vendiora on, so one instance sends them.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __leadChecks?: NodeJS.Timeout; __quoteChecks?: NodeJS.Timeout; __vdChecks?: NodeJS.Timeout };

  if (process.env.LEAD_CRON_ENABLED === "1" && !g.__leadChecks) {
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

  const quotesOn = process.env.QUOTE_CRON_ENABLED === "1" || process.env.LEAD_CRON_ENABLED === "1";
  if (quotesOn && process.env.QUOTE_CRON_ENABLED !== "0" && !g.__quoteChecks) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const { runQuoteExpiryChecks } = await import("@/lib/quotes/expiry-alerts");
        const r = await runQuoteExpiryChecks();
        if (r.pre || r.due) console.log(`[quote checks] pre=${r.pre} due=${r.due}`);
      } catch (e) {
        console.error("[quote checks]", e instanceof Error ? e.message : e);
      } finally {
        running = false;
      }
    };
    g.__quoteChecks = setInterval(tick, 30 * 60_000);
    setTimeout(tick, 60_000);
  }

  if (process.env.LEAD_CRON_ENABLED === "1" && process.env.VENDIORA_CRON_ENABLED !== "0" && !g.__vdChecks) {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const { vendioraEnabled } = await import("@/lib/roles");
        if (!vendioraEnabled()) return;
        const { getSettings } = await import("@/lib/vendiora/db");
        if ((await getSettings()).playbook.enabled) {
          // Playbook on: it replaces the simple automations (same moments, more steps)
          const { runPlaybook } = await import("@/lib/vendiora/engine");
          const r = await runPlaybook();
          if (Object.keys(r).length) console.log(`[vendiora playbook] ${JSON.stringify(r)}`);
        } else {
          const { runVendioraAutomations } = await import("@/lib/vendiora/automations");
          const r = await runVendioraAutomations();
          if (r.reminders || r.followups || r.expired || r.coachingEnd) console.log(`[vendiora auto] ${JSON.stringify(r)}`);
        }
      } catch (e) {
        console.error("[vendiora auto]", e instanceof Error ? e.message : e);
      } finally {
        running = false;
      }
    };
    g.__vdChecks = setInterval(tick, Math.max(60_000, Number(process.env.VENDIORA_CHECK_INTERVAL_MS || 2 * 60_000)));
    setTimeout(tick, 90_000);
  }
}
