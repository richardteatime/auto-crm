import { NextRequest, NextResponse } from "next/server";
import { listWorkflowEvents } from "@/lib/db/workflow-events";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const events = await listWorkflowEvents({ runId: id, limit: 100 });
    return NextResponse.json(events);
  } catch (err) {
    console.error("[orchestrator/runs/[id]/events] error:", err);
    return NextResponse.json({ error: "Errore nel caricamento eventi" }, { status: 500 });
  }
}
