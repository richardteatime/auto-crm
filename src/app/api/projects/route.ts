import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listProjects, createProject } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";

const BodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(["aperto", "in_lavorazione", "bloccato", "in_pausa", "revisione_cto", "consegnato"]).optional(),
  priority: z.string().optional(),
  assignedTo: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
});

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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const assignedTo: string[] = parsed.data.assignedTo ?? [];
    const project = await createProject({ ...parsed.data, assignedTo, createdBy: auth.user.id });

    for (const userId of assignedTo) {
      await notifyAssignment({
        assignedToUserId: userId,
        fromUserId: auth.user.id,
        fromUserName: auth.user.name || auth.user.email,
        type: "project_assigned",
        title: `Nuovo progetto assegnato: ${parsed.data.title}`,
        body: `Assegnato da ${auth.user.name || auth.user.email}`,
        relatedId: project.id,
      });
    }

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
