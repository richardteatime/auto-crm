import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listQuotes } from "@/lib/db/quotes";
import { getDeal } from "@/lib/db/deals";
import { getContact } from "@/lib/db/contacts";
import { generateText, isAIEnabled } from "@/lib/claude";
import { normalizeServiceName, parseDbItems } from "@/lib/quote-items";

export const dynamic = "force-dynamic";

/**
 * POST /api/quotes/describe
 * Body: { service, quoteTitle?, dealId?, otherServices?, force? }
 *
 * Returns the long description of a quote line:
 *  1. reuses the most recent description already written for the same service
 *     (so recurring services stay consistent and cost nothing), unless `force`;
 *  2. otherwise writes a new one with the configured AI provider.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const service = typeof body.service === "string" ? body.service.trim().slice(0, 200) : "";
  if (service.length < 3) {
    return NextResponse.json({ error: "Scrivi prima il nome del servizio" }, { status: 400 });
  }
  const force = body.force === true;
  const quoteTitle = typeof body.quoteTitle === "string" ? body.quoteTitle.trim().slice(0, 200) : "";
  const dealId = typeof body.dealId === "string" ? body.dealId : "";
  const otherServices = Array.isArray(body.otherServices)
    ? body.otherServices
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 120))
        .filter((s) => normalizeServiceName(s) !== normalizeServiceName(service))
        .slice(0, 12)
    : [];

  // 1. Reuse an existing description for the same service (most recent quote first).
  if (!force) {
    const key = normalizeServiceName(service);
    try {
      const quotes = await listQuotes();
      for (const q of quotes) {
        const match = parseDbItems(q.items).find(
          (i) => i.details?.trim() && normalizeServiceName(i.description ?? "") === key,
        );
        if (match?.details) {
          return NextResponse.json({ details: match.details.trim(), source: "storico", quoteNumber: q.number });
        }
      }
    } catch {
      // history lookup is best-effort
    }
  }

  // 2. Generate a new one.
  if (!isAIEnabled()) {
    return NextResponse.json(
      { error: "Generazione automatica non disponibile: nessuna chiave IA configurata" },
      { status: 503 },
    );
  }

  let company = "";
  let dealTitle = "";
  if (dealId) {
    try {
      const deal = await getDeal(dealId);
      if (deal) {
        dealTitle = deal.title ?? "";
        if (deal.contactId) {
          const contact = await getContact(deal.contactId);
          company = contact?.company || contact?.name || "";
        }
      }
    } catch {
      // context is optional
    }
  }

  const context = [
    quoteTitle && `Titolo del preventivo: "${quoteTitle}".`,
    dealTitle && dealTitle !== quoteTitle && `Trattativa: "${dealTitle}".`,
    company && `Cliente: ${company}.`,
    otherServices.length > 0 &&
      `Altre voci dello stesso preventivo (non ripeterne i contenuti): ${otherServices.join("; ")}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Sei il responsabile commerciale di SarconX, software house italiana (Pavia/Milano) che realizza siti web, e-commerce, gestionali e CRM su misura, automazioni dei processi aziendali e servizi digitali chiavi in mano.

Scrivi la descrizione di una riga di preventivo per il servizio: "${service}".
${context}

Requisiti:
- Italiano professionale, tono consulenziale e concreto, niente enfasi pubblicitaria.
- Una frase introduttiva (massimo 30 parole) che spiega cosa ottiene il cliente.
- Poi da 4 a 6 punti elenco, ognuno su una riga che inizia con "- ", con le attività e i consegnabili inclusi.
- Elenca solo ciò che rientra normalmente in questo servizio: niente extra che il cliente potrebbe dare per inclusi senza che lo siano.
- Non indicare prezzi, tempistiche, garanzie, percentuali o numeri inventati.
- Niente titoli, grassetto, markdown o emoji. Massimo 110 parole in totale.

Rispondi solo con il testo della descrizione.`;

  const raw = await generateText(prompt, { maxTokens: 450, timeoutMs: 30_000 });
  const details = cleanup(raw);
  if (!details) {
    return NextResponse.json(
      { error: "Non sono riuscito a generare la descrizione, riprova" },
      { status: 502 },
    );
  }

  return NextResponse.json({ details, source: "ia" });
}

function cleanup(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*(descrizione|description)\s*:\s*/i, "")
    .split("\n")
    .map((l) => l.replace(/^\s*[*•·]\s+/, "- ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
}
