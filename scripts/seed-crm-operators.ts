#!/usr/bin/env node
import { config } from "dotenv";
import type { CrmOperatorRole } from "@/lib/crm-operators/types";

config({ path: ".env.local" });

type OperatorInput = {
  name: string;
  role: CrmOperatorRole;
  scopes?: string[];
  appwriteUserId?: string | null;
  telegramUserId?: string | null;
  chatwootContactId?: string | null;
  chatwootAgentId?: string | null;
  active?: boolean;
  notes?: string | null;
};

const VALID_ROLES = new Set<CrmOperatorRole>([
  "admin",
  "sales",
  "finance",
  "operations",
  "developer",
]);

function usage(): string {
  return [
    "Uso:",
    "  CRM_OPERATORS_JSON='[{\"name\":\"Leonardo\",\"telegramUserId\":\"123456\",\"role\":\"admin\",\"scopes\":[\"*\"]}]' npm run telegram:operators",
    "",
    "Ruoli validi: admin, sales, finance, operations, developer",
    "Se scopes non viene indicato, lo script applica scope sicuri di default per ruolo.",
  ].join("\n");
}

function defaultScopesForRole(role: CrmOperatorRole): string[] {
  switch (role) {
    case "admin":
      return ["*"];
    case "sales":
      return ["crm:command", "crm:read", "crm:write"];
    case "finance":
      return ["crm:command", "crm:read", "finance:read"];
    case "operations":
      return ["crm:command", "crm:read", "crm:write"];
    case "developer":
      return ["crm:command", "crm:read", "projects:workflow"];
  }
}

function parseOperators(): OperatorInput[] {
  const raw = process.env.CRM_OPERATORS_JSON;
  if (!raw) {
    throw new Error(`CRM_OPERATORS_JSON non configurato.\n\n${usage()}`);
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("CRM_OPERATORS_JSON deve essere un array JSON.");
  }

  return parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Operatore #${index + 1}: record non valido.`);
    }
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const role = record.role as CrmOperatorRole;
    if (!name) {
      throw new Error(`Operatore #${index + 1}: name obbligatorio.`);
    }
    if (!VALID_ROLES.has(role)) {
      throw new Error(`Operatore ${name}: ruolo non valido "${String(record.role)}".`);
    }

    const scopes = Array.isArray(record.scopes)
      ? record.scopes.map((scope) => String(scope).trim()).filter(Boolean)
      : defaultScopesForRole(role);

    return {
      name,
      role,
      scopes,
      appwriteUserId: typeof record.appwriteUserId === "string" ? record.appwriteUserId : null,
      telegramUserId: typeof record.telegramUserId === "string" ? record.telegramUserId : null,
      chatwootContactId: typeof record.chatwootContactId === "string" ? record.chatwootContactId : null,
      chatwootAgentId: typeof record.chatwootAgentId === "string" ? record.chatwootAgentId : null,
      active: typeof record.active === "boolean" ? record.active : true,
      notes: typeof record.notes === "string" ? record.notes : null,
    };
  });
}

async function findExistingOperator(input: OperatorInput) {
  const operators = await import("@/lib/db/crm-operators");
  if (input.telegramUserId) {
    const byTelegram = await operators.getOperatorByTelegramUserId(input.telegramUserId);
    if (byTelegram) return byTelegram;
  }
  if (input.chatwootContactId) {
    const byChatwoot = await operators.getOperatorByChatwootContactId(input.chatwootContactId);
    if (byChatwoot) return byChatwoot;
  }
  return null;
}

async function main() {
  const { upsertCrmOperator } = await import("@/lib/db/crm-operators");
  const inputs = parseOperators();

  if (inputs.length === 0) {
    throw new Error("Nessun operatore da seedare.");
  }

  for (const input of inputs) {
    if (!input.telegramUserId && !input.chatwootContactId) {
      console.warn(
        `Operatore ${input.name}: nessun telegramUserId/chatwootContactId; verrà creato ma non potrà autenticarsi via bot finché non aggiungi un identificativo.`,
      );
    }

    const existing = await findExistingOperator(input);
    const saved = await upsertCrmOperator({
      id: existing?.id,
      name: input.name,
      appwriteUserId: input.appwriteUserId,
      telegramUserId: input.telegramUserId,
      chatwootContactId: input.chatwootContactId,
      chatwootAgentId: input.chatwootAgentId,
      role: input.role,
      scopes: input.scopes ?? defaultScopesForRole(input.role),
      active: input.active,
      notes: input.notes,
    });

    console.log(
      `${existing ? "Aggiornato" : "Creato"} operatore ${saved.name} (${saved.role}) id=${saved.id}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
