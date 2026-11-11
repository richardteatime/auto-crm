import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/vendiora/db";
import { readBody } from "@/lib/vendiora/http";
import { PB_GROUPS, PB_MESSAGES } from "@/lib/vendiora/playbook-messages";
import { ANGLE_INFO, CONTINUOUS_SERVICES, PLAYBOOK_PACKAGES, VALUE_LADDER } from "@/lib/vendiora/playbook";

export const dynamic = "force-dynamic";

/** Playbook catalogue (packages, calls, angles, messages) + actions: seed packages, run the engine now */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const s = await getSettings();
  return NextResponse.json({
    packages: PLAYBOOK_PACKAGES, angles: ANGLE_INFO, ladder: VALUE_LADDER, continuous: CONTINUOUS_SERVICES,
    groups: PB_GROUPS, messages: PB_MESSAGES.map((m) => ({ ...m, override: s.playbook.messages[m.id] ?? null })),
    enabled: s.playbook.enabled,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  if (b.action === "seed") {
    const { seedPlaybookPackages } = await import("@/lib/vendiora/engine");
    return NextResponse.json(await seedPlaybookPackages());
  }
  if (b.action === "run") {
    // Sends only on the instance that runs the cron (prod); elsewhere it only reports
    if (process.env.LEAD_CRON_ENABLED !== "1") return NextResponse.json({ error: "Su questa istanza i messaggi automatici sono spenti" }, { status: 409 });
    const { runPlaybook } = await import("@/lib/vendiora/engine");
    return NextResponse.json({ result: await runPlaybook() });
  }
  return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
}
