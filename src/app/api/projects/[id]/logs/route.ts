import { NextRequest, NextResponse } from "next/server";
import { listProjectLogs, createProjectLog, getProject, updateProject } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";
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

    const newAssignedTo: string[] = Array.isArray(body.assignedTo) ? body.assignedTo : [];
    const projectUpdate: Parameters<typeof updateProject>[1] = {
      status: body.toStatus as ProjectStatus,
      deliveredAt:
        body.toStatus === "consegnato" && !project.deliveredAt
          ? new Date()
          : undefined,
    };
    if (body.assignedTo !== undefined) projectUpdate.assignedTo = newAssignedTo;

    const [log] = await Promise.all([
      createProjectLog({
        projectId: id,
        fromStatus: project.status,
        toStatus: body.toStatus,
        notes: body.notes,
      }),
      updateProject(id, projectUpdate),
    ]);

    if (body.assignedTo !== undefined) {
      const newlyAssigned = newAssignedTo.filter((uid) => !project.assignedTo.includes(uid));
      for (const userId of newlyAssigned) {
        await notifyAssignment({
          assignedToUserId: userId,
          fromUserId: auth.user.id,
          fromUserName: auth.user.name || auth.user.email,
          type: "project_assigned",
          title: `Progetto assegnato: ${project.title}`,
          body: `Assegnato da ${auth.user.name || auth.user.email}`,
          relatedId: id,
        });
      }
    }

    return NextResponse.json(log, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
