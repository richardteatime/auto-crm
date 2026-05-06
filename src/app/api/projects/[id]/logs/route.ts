import { NextRequest, NextResponse } from "next/server";
import { listProjectLogs, createProjectLog, getProject, updateProject } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import type { ProjectStatus } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const logs = await listProjectLogs(id);
    return NextResponse.json(logs);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const body = await request.json();
    if (!body.toStatus) return NextResponse.json({ error: "toStatus obbligatorio" }, { status: 400 });
    if (!body.notes?.trim()) return NextResponse.json({ error: "notes obbligatorio" }, { status: 400 });

    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Progetto non trovato" }, { status: 404 });

    const [log] = await Promise.all([
      createProjectLog({
        projectId: id,
        fromStatus: project.status,
        toStatus: body.toStatus,
        notes: body.notes,
      }),
      updateProject(id, {
        status: body.toStatus as ProjectStatus,
        deliveredAt:
          body.toStatus === "consegnato" && !project.deliveredAt
            ? new Date()
            : undefined,
      }),
    ]);

    return NextResponse.json(log, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
