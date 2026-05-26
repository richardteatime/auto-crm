import { NextRequest, NextResponse } from "next/server";
import { listAgentTasks } from "@/lib/db/agent-tasks";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tasks = await listAgentTasks({ runId: id });
    return NextResponse.json(tasks);
  } catch (err) {
    console.error("[orchestrator/runs/[id]/tasks] error:", err);
    return NextResponse.json({ error: "Errore nel caricamento tasks" }, { status: 500 });
  }
}
