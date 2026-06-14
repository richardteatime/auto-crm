import { NextRequest, NextResponse } from "next/server";
import { listProjectArtifacts } from "@/lib/db/project-artifacts";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const artifacts = await listProjectArtifacts({ runId: id });
    return NextResponse.json(artifacts);
  } catch (err) {
    console.error("[orchestrator/runs/[id]/artifacts] error:", err);
    return NextResponse.json({ error: "Errore nel caricamento artifacts" }, { status: 500 });
  }
}
