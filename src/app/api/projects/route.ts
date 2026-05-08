import { NextRequest, NextResponse } from "next/server";
import { listProjects, createProject } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const projects = await listProjects();
    return NextResponse.json(projects);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title obbligatorio" }, { status: 400 });
    }
    const project = await createProject(body);

    if (body.assignedTo) {
      await notifyAssignment({
        assignedToUserId: body.assignedTo,
        fromUserId: auth.user.id,
        fromUserName: auth.user.name || auth.user.email,
        type: "project_assigned",
        title: `Nuovo progetto assegnato: ${body.title}`,
        body: `Assegnato da ${auth.user.name || auth.user.email}`,
        relatedId: project.id,
      });
    }

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
