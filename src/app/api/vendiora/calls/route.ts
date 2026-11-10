import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listCalls, listClients, getClient, updateCall } from "@/lib/vendiora/db";
import { readBody, fail } from "@/lib/vendiora/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const [calls, clients] = await Promise.all([listCalls(), listClients()]);
  const live = new Map(clients.map((c) => [c.id, c]));
  return NextResponse.json({
    calls: calls.filter((c) => live.has(c.clientId)).map((c) => ({ ...c, clientStatus: live.get(c.clientId)!.status, coach: live.get(c.clientId)!.coach })),
  });
}

/** { clientId, plan: "weekly" }: gives every unscheduled call of the client a date, one a week from the kick-off */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  const client = typeof b.clientId === "string" ? await getClient(b.clientId) : null;
  if (!client) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  const calls = await listCalls({ clientId: client.id });
  const startMs = client.kickoffAt ? Date.parse(client.kickoffAt) : (() => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.getTime();
  })();
  try {
    let n = 0;
    for (const c of calls) {
      if (c.scheduledAt || c.status === "fatta") continue;
      const at = new Date(startMs + (c.number - 1) * 7 * 86_400_000).toISOString();
      await updateCall(c.id, { scheduledAt: at, status: "prenotata" });
      n++;
    }
    return NextResponse.json({ ok: true, planned: n });
  } catch (e) { return fail(e); }
}
