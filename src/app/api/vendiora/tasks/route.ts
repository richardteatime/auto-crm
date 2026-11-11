import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createTaskOnce, getClient, listTasks } from "@/lib/vendiora/db";
import { readBody, str, iso, fail } from "@/lib/vendiora/http";
import { TASK_ROLES, type TaskRole } from "@/lib/vendiora/types";

export const dynamic = "force-dynamic";

/** Team tasks created by the playbook (calls, voice notes, escalations) + manual ones */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") === "fatto" ? "fatto" : sp.get("status") === "tutti" ? undefined : "aperto";
  const tasks = await listTasks({ status, clientId: sp.get("clientId") ?? undefined, leadId: sp.get("leadId") ?? undefined });
  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const b = await readBody(request);
  if (b instanceof NextResponse) return b;
  const title = str(b.title, 300);
  if (!title) return NextResponse.json({ error: "Scrivi cosa c'è da fare" }, { status: 400 });
  const role = (TASK_ROLES as readonly string[]).includes(String(b.role)) ? (b.role as TaskRole) : "admin";
  const clientId = str(b.clientId, 64);
  if (clientId && !(await getClient(clientId))) return NextResponse.json({ error: "Cliente non trovato" }, { status: 404 });
  try {
    const t = await createTaskOnce({
      key: `manual:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, clientId, leadId: str(b.leadId, 64), title,
      detail: str(b.detail, 4000), role, dueAt: iso(b.dueAt) ?? new Date().toISOString(), urgent: b.urgent === true,
    });
    return NextResponse.json({ task: t });
  } catch (e) { return fail(e); }
}
