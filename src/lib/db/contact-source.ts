import type { LeadSource } from "@/types";

const SOURCE_ALIASES: Record<string, LeadSource> = {
  website: "website",
  whatsapp: "whatsapp",
  referido: "referido",
  redes_sociales: "redes_sociales",
  llamada_fria: "llamada_fria",
  email: "email",
  formulario: "formulario",
  evento: "evento",
  import: "import",
  webhook: "webhook",
  otro: "otro",
  form: "formulario",
  booking: "evento",
  landing: "website",
  funnel: "website",
};

export function normalizeContactSource(
  source: string | null | undefined,
): LeadSource {
  const normalized = source?.trim().toLowerCase();
  if (!normalized) return "otro";
  return SOURCE_ALIASES[normalized] ?? "otro";
}
