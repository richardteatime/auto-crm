import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listContacts, createContact } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { triggerWorkflows } from "@/lib/workflows/trigger";

const QuerySchema = z.object({
  search: z.string().optional(),
  temperature: z.string().optional(),
  source: z.string().optional(),
});

const BodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  source: z.string().optional(),
  temperature: z.string().optional(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const queryObj = Object.fromEntries(searchParams.entries());
  const parsedQuery = QuerySchema.safeParse(queryObj);
  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: "Parametri non validi", issues: parsedQuery.error.issues },
      { status: 400 }
    );
  }

  try {
    const results = await listContacts({
      search: parsedQuery.data.search,
      temperature: parsedQuery.data.temperature,
      source: parsedQuery.data.source,
    });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero dei contatti" },
      { status: 500 }
    );
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
    const result = await createContact({
      name: parsed.data.name.trim(),
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      company: parsed.data.company ?? null,
      vatNumber: parsed.data.vatNumber ?? null,
      address: parsed.data.address ?? null,
      source: parsed.data.source || "otro",
      temperature: parsed.data.temperature || "cold",
      notes: parsed.data.notes ?? null,
      createdBy: auth.user.id,
    });

    await triggerWorkflows("contact_created", {
      contactId: result.id,
      name: result.name,
      email: result.email,
      phone: result.phone,
      company: result.company,
      source: result.source,
    }).catch(() => {});

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione del contatto" },
      { status: 500 }
    );
  }
}
