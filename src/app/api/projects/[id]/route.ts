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

    // Detect assignedTo changes before updating
    let previousAssignedTo: string | null = null;
    if (body.assignedTo !== undefined) {
      const current = await getProject(id);
      previousAssignedTo = current?.assignedTo ?? null;
    }

    const project = await updateProject(id, body);

    const newAssignedTo = body.assignedTo ?? null;
    if (newAssignedTo && newAssignedTo !== previousAssignedTo) {
      await notifyAssignment({
        assignedToUserId: newAssignedTo,
        fromUserId: auth.user.id,
        fromUserName: auth.user.name || auth.user.email,
        type: "project_assigned",
        title: `Progetto assegnato: ${project.title}`,
        body: `Assegnato da ${auth.user.name || auth.user.email}`,
        relatedId: id,
      });
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
