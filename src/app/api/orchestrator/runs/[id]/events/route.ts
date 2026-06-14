import { NextRequest, NextResponse } from "next/server";
import { listWorkflowEvents } from "@/lib/db/workflow-events";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const events = await listWorkflowEvents({ runId: id, limit: 100 });
    return NextResponse.json(events);
  } catch (err) {
    console.error("[orchestrator/runs/[id]/events] error:", err);
    return NextResponse.json({ error: "Errore nel caricamento eventi" }, { status: 500 });
  }
}
