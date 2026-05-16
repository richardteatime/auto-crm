import { NextRequest, NextResponse } from "next/server";
import { getProject, updateProject, deleteProject } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Non trovato" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    const body = await request.json();
    const assignedTo: string[] | undefined = body.assignedTo !== undefined
      ? (Array.isArray(body.assignedTo) ? body.assignedTo : [])
      : undefined;

    // Detect assignedTo changes before updating
    let previousAssignedTo: string[] = [];
    if (assignedTo !== undefined) {
      const current = await getProject(id);
      previousAssignedTo = current?.assignedTo ?? [];
    }

    const project = await updateProject(id, assignedTo !== undefined ? { ...body, assignedTo } : body);

    if (assignedTo !== undefined) {
      const newlyAssigned = assignedTo.filter((uid) => !previousAssignedTo.includes(uid));
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

    return NextResponse.json(project);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  try {
    await deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
