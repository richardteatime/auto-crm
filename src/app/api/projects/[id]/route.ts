import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProject, updateProject, deleteProject } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { notifyAssignment } from "@/lib/notify";

type Ctx = { params: Promise<{ id: string }> };

const BodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(["aperto", "in_lavorazione", "bloccato", "in_pausa", "revisione_cto", "consegnato"]).optional(),
  priority: z.string().optional(),
  assignedTo: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
}).passthrough();

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
    const assignedTo: string[] | undefined = parsed.data.assignedTo !== undefined
      ? parsed.data.assignedTo
      : undefined;

    // Detect assignedTo changes before updating
    let previousAssignedTo: string[] = [];
    if (assignedTo !== undefined) {
      const current = await getProject(id);
      previousAssignedTo = current?.assignedTo ?? [];
    }

    const project = await updateProject(id, assignedTo !== undefined ? { ...parsed.data, assignedTo } : parsed.data);

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
