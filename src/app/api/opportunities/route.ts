import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listOpportunities, createOpportunity } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const QuerySchema = z.object({
  contactId: z.string().optional(),
  status: z.string().optional(),
  format: z.string().optional(),
});

const BodySchema = z.object({
  contactId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  attachments: z.string().optional().nullable(),
  value: z.number().optional().nullable(),
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
    const results = await listOpportunities({
      contactId: parsedQuery.data.contactId,
      status: parsedQuery.data.status,
    });

    if (parsedQuery.data.format === "csv") {
      const header = "ID,Titolo,Stato,Valore,Descrizione,Note,Creato\n";
      const rows = results.map((o) => [
        o.id,
        `"${(o.title || "").replace(/"/g, '""')}"`,
        o.status,
        o.value != null ? (o.value / 100).toFixed(2) : "",
        `"${(o.description || "").replace(/"/g, '""')}"`,
        `"${(o.notes || "").replace(/"/g, '""')}"`,
        o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
      ].join(",")).join("\n");
      return new Response(header + rows, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=opportunita.csv",
        },
      });
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Errore nel recupero delle opportunità" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body;
  try { body = await request.json(); } catch {
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
    const result = await createOpportunity({
      contactId: parsed.data.contactId,
      title: parsed.data.title.trim(),
      description: parsed.data.description ?? null,
      notes: parsed.data.notes ?? null,
      attachments: parsed.data.attachments ?? null,
      value: parsed.data.value != null ? Math.round(parsed.data.value * 100) : null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore nella creazione" },
      { status: 500 }
    );
  }
}
