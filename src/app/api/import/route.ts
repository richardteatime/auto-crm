import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createContact } from "@/lib/db/contacts";
import { requireAdmin } from "@/lib/auth";

const MAX_IMPORT_BATCH = 500;

const ContactItemSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  source: z.string().optional(),
  notes: z.string().optional().nullable(),
});

const BodySchema = z.object({
  contacts: z.array(ContactItemSchema).max(MAX_IMPORT_BATCH),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
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

  const contactList = parsed.data.contacts;

  const results = {
    imported: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const contact of contactList) {
    try {
      await createContact({
        name: contact.name,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        company: contact.company ?? null,
        source: contact.source || "import",
        temperature: "cold",
        notes: contact.notes ?? null,
      });
      results.imported++;
    } catch {
      results.failed++;
      results.errors.push(`Errore importando ${contact.name}`);
    }
  }

  return NextResponse.json(results, {
    status: results.failed > 0 ? 207 : 201,
  });
}
