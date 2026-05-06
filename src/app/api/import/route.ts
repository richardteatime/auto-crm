import { NextRequest, NextResponse } from "next/server";
import { createContact } from "@/lib/db/contacts";
import { isValidEmail } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";

const MAX_IMPORT_BATCH = 500;

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }
  const { contacts: contactList } = body;

  if (!Array.isArray(contactList) || contactList.length === 0) {
    return NextResponse.json(
      { error: "È richiesto un array di contatti" },
      { status: 400 }
    );
  }

  if (contactList.length > MAX_IMPORT_BATCH) {
    return NextResponse.json(
      { error: `Massimo ${MAX_IMPORT_BATCH} contatti per importazione` },
      { status: 400 }
    );
  }

  const results = {
    imported: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const contact of contactList) {
    if (!contact.name) {
      results.failed++;
      results.errors.push(`Contatto senza nome`);
      continue;
    }

    if (contact.email && !isValidEmail(contact.email)) {
      results.failed++;
      results.errors.push(`Email non valida per ${contact.name}`);
      continue;
    }

    try {
      await createContact({
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        company: contact.company || null,
        source: contact.source || "import",
        temperature: contact.temperature || "cold",
        notes: contact.notes || null,
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
