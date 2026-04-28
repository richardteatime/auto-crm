import { NextRequest, NextResponse } from "next/server";
import { listOpportunities, createOpportunity } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId") || undefined;
  const status = searchParams.get("status") || undefined;

  try {
    const results = await listOpportunities({ contactId, status });

    const format = searchParams.get("format");
    if (format === "csv") {
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
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nel recupero delle opportunità: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { contactId, title, description, notes, attachments, value } = body;
  if (!contactId) return NextResponse.json({ error: "contactId obbligatorio" }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "Il titolo è obbligatorio" }, { status: 400 });

  try {
    const result = await createOpportunity({
      contactId,
      title: title.trim(),
      description: description || null,
      notes: notes || null,
      attachments: attachments || null,
      value: value != null ? Math.round(value * 100) : null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: `Errore nella creazione: ${error instanceof Error ? error.message : "sconosciuto"}` },
      { status: 500 }
    );
  }
}
