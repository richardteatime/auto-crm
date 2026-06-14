import { NextRequest, NextResponse } from "next/server";
import { listAgentTasks } from "@/lib/db/agent-tasks";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const tasks = await listAgentTasks({ runId: id });
    return NextResponse.json(tasks);
  } catch (err) {
    console.error("[orchestrator/runs/[id]/tasks] error:", err);
    return NextResponse.json({ error: "Errore nel caricamento tasks" }, { status: 500 });
  }
}
