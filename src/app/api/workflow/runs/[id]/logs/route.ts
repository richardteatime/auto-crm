import { NextRequest, NextResponse } from "next/server";
import { listWorkflowRunLogs } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const logs = await listWorkflowRunLogs(id);
    return NextResponse.json(logs);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero dei log" },
      { status: 500 },
    );
  }
}
