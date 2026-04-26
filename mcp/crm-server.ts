#!/usr/bin/env npx tsx

/**
 * Auto-CRM MCP Server
 *
 * Exposes CRM data as MCP tools so Claude (Desktop, Web, or Code)
 * can read and write CRM data directly — no API key needed.
 *
 * Uses Appwrite as the database backend.
 *
 * Add to your Claude Desktop config (claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "auto-crm": {
 *       "command": "npx",
 *       "args": ["tsx", "/path/to/auto-crm/mcp/crm-server.ts"],
 *       "env": {
 *         "NEXT_PUBLIC_APPWRITE_ENDPOINT": "http://localhost:80/v1",
 *         "APPWRITE_PROJECT_ID": "...",
 *         "APPWRITE_API_KEY": "...",
 *         "APPWRITE_DATABASE_ID": "crm"
 *       }
 *     }
 *   }
 * }
 */

import { Client, Databases, ID, Query, type Models } from "node-appwrite";

// ---------------------------------------------------------------------------
// Appwrite client setup (independent from the Next.js app)
// ---------------------------------------------------------------------------

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";
const COLLECTIONS = {
  contacts: "contacts",
  pipelineStages: "pipeline_stages",
  deals: "deals",
  activities: "activities",
} as const;

const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip Appwrite metadata and normalise to plain objects with `id`. */
function fromDoc(doc: Models.Document): Record<string, unknown> {
  const { $id, $createdAt, $updatedAt, ...rest } = doc;
  return {
    id: $id,
    createdAt: $createdAt,
    updatedAt: $updatedAt,
    ...rest,
  };
}

function fromDocs(docs: Models.Document[]): Record<string, unknown>[] {
  return docs.map(fromDoc);
}

// ---------------------------------------------------------------------------
// MCP Protocol types
// ---------------------------------------------------------------------------

interface MCPMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const tools = [
  {
    name: "crm_list_contacts",
    description:
      "Lista todos los contactos del CRM. Puedes filtrar por temperatura (cold/warm/hot) o buscar por nombre.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "Buscar por nombre, email o empresa" },
        temperature: {
          type: "string",
          enum: ["cold", "warm", "hot"],
          description: "Filtrar por temperatura del lead",
        },
        limit: { type: "number", description: "Limite de resultados (default 50)" },
      },
    },
  },
  {
    name: "crm_get_contact",
    description: "Obtiene los detalles de un contacto especifico, incluyendo sus deals y actividades.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "ID del contacto" },
      },
      required: ["id"],
    },
  },
  {
    name: "crm_create_contact",
    description: "Crea un nuevo contacto/lead en el CRM.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Nombre completo" },
        email: { type: "string", description: "Email" },
        phone: { type: "string", description: "Telefono" },
        company: { type: "string", description: "Empresa" },
        source: {
          type: "string",
          enum: ["website", "whatsapp", "referido", "redes_sociales", "llamada_fria", "email", "formulario", "evento", "import", "webhook", "otro"],
          description: "Fuente del lead",
        },
        temperature: { type: "string", enum: ["cold", "warm", "hot"], description: "Temperatura" },
        notes: { type: "string", description: "Notas" },
      },
      required: ["name"],
    },
  },
  {
    name: "crm_list_deals",
    description: "Lista todos los deals/oportunidades del pipeline, con informacion del contacto y etapa.",
    inputSchema: {
      type: "object" as const,
      properties: {
        stageId: { type: "string", description: "Filtrar por ID de etapa" },
      },
    },
  },
  {
    name: "crm_create_deal",
    description: "Crea un nuevo deal/oportunidad de venta.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Titulo del deal" },
        value: { type: "number", description: "Valor en centavos (ej: 150000 = $1,500)" },
        contactId: { type: "string", description: "ID del contacto" },
        stageId: { type: "string", description: "ID de la etapa (si no se provee, usa la primera)" },
        probability: { type: "number", description: "Probabilidad de cierre 0-100" },
        notes: { type: "string", description: "Notas" },
      },
      required: ["title", "contactId"],
    },
  },
  {
    name: "crm_move_deal",
    description: "Mueve un deal a otra etapa del pipeline.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dealId: { type: "string", description: "ID del deal" },
        stageId: { type: "string", description: "ID de la nueva etapa" },
      },
      required: ["dealId", "stageId"],
    },
  },
  {
    name: "crm_log_activity",
    description: "Registra una actividad (llamada, email, reunion, nota, seguimiento) para un contacto.",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["call", "email", "meeting", "note", "follow_up"],
          description: "Tipo de actividad",
        },
        description: { type: "string", description: "Descripcion de la actividad" },
        contactId: { type: "string", description: "ID del contacto" },
        dealId: { type: "string", description: "ID del deal (opcional)" },
        scheduledAt: { type: "string", description: "Fecha programada ISO 8601 (para follow-ups)" },
      },
      required: ["type", "description", "contactId"],
    },
  },
  {
    name: "crm_get_pipeline",
    description:
      "Obtiene el estado completo del pipeline: todas las etapas con sus deals. Ideal para analisis.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "crm_get_followups",
    description: "Obtiene todos los seguimientos pendientes, organizados por: vencidos, hoy, proximos.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "crm_get_stats",
    description:
      "Obtiene estadisticas del CRM: total contactos, deals activos, valor en pipeline, leads calientes, tasa de conversion.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers (async — all Appwrite ops are promise-based)
// ---------------------------------------------------------------------------

async function handleTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    // -----------------------------------------------------------------------
    // 1. crm_list_contacts
    // -----------------------------------------------------------------------
    case "crm_list_contacts": {
      const queries: string[] = [
        Query.limit(Number(args.limit) || 50),
        Query.orderDesc("$createdAt"),
      ];

      if (args.search) {
        queries.push(Query.search("name", args.search as string));
      }
      if (args.temperature) {
        queries.push(Query.equal("temperature", args.temperature as string));
      }

      const res = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.contacts,
        queries,
      );
      return fromDocs(res.documents);
    }

    // -----------------------------------------------------------------------
    // 2. crm_get_contact
    // -----------------------------------------------------------------------
    case "crm_get_contact": {
      let contact: Models.Document;
      try {
        contact = await databases.getDocument(
          DB_ID,
          COLLECTIONS.contacts,
          args.id as string,
        );
      } catch {
        return { error: "Contacto no encontrado" };
      }

      const [dealsRes, activitiesRes] = await Promise.all([
        databases.listDocuments(DB_ID, COLLECTIONS.deals, [
          Query.equal("contactId", args.id as string),
          Query.limit(200),
        ]),
        databases.listDocuments(DB_ID, COLLECTIONS.activities, [
          Query.equal("contactId", args.id as string),
          Query.orderDesc("$createdAt"),
          Query.limit(200),
        ]),
      ]);

      return {
        ...fromDoc(contact),
        deals: fromDocs(dealsRes.documents),
        activities: fromDocs(activitiesRes.documents),
      };
    }

    // -----------------------------------------------------------------------
    // 3. crm_create_contact
    // -----------------------------------------------------------------------
    case "crm_create_contact": {
      const now = new Date().toISOString();

      const doc = await databases.createDocument(
        DB_ID,
        COLLECTIONS.contacts,
        ID.unique(),
        {
          name: args.name,
          email: (args.email as string) || null,
          phone: (args.phone as string) || null,
          company: (args.company as string) || null,
          source: (args.source as string) || "otro",
          temperature: (args.temperature as string) || "cold",
          score: 0,
          notes: (args.notes as string) || null,
          createdAt: now,
          updatedAt: now,
        },
      );

      return {
        id: doc.$id,
        message: `Contacto "${args.name}" creado exitosamente`,
      };
    }

    // -----------------------------------------------------------------------
    // 4. crm_list_deals
    // -----------------------------------------------------------------------
    case "crm_list_deals": {
      const queries: string[] = [
        Query.limit(500),
        Query.orderDesc("$createdAt"),
      ];

      if (args.stageId) {
        queries.push(Query.equal("stageId", args.stageId as string));
      }

      const res = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.deals,
        queries,
      );

      // Deals have denormalized contactName, contactTemperature,
      // stageName, stageColor stored directly — no joins needed.
      return fromDocs(res.documents);
    }

    // -----------------------------------------------------------------------
    // 5. crm_create_deal
    // -----------------------------------------------------------------------
    case "crm_create_deal": {
      const now = new Date().toISOString();

      // Resolve stage: use provided or fall back to first stage
      let stageId = args.stageId as string;
      if (!stageId) {
        const stagesRes = await databases.listDocuments(
          DB_ID,
          COLLECTIONS.pipelineStages,
          [Query.orderAsc("order"), Query.limit(1)],
        );
        if (stagesRes.documents.length === 0) {
          return { error: "No hay etapas de pipeline" };
        }
        stageId = stagesRes.documents[0].$id;
      }

      // Resolve contact for denormalized fields
      let contactName: string | null = null;
      let contactTemperature: string | null = null;
      try {
        const contact = await databases.getDocument(
          DB_ID,
          COLLECTIONS.contacts,
          args.contactId as string,
        );
        contactName = (contact as Record<string, unknown>).name as string;
        contactTemperature = (contact as Record<string, unknown>).temperature as string;
      } catch {
        // Contact not found — leave denorm fields null
      }

      // Resolve stage for denormalized fields
      let stageName: string | null = null;
      let stageColor: string | null = null;
      let wonAt: string | undefined;
      try {
        const stage = await databases.getDocument(
          DB_ID,
          COLLECTIONS.pipelineStages,
          stageId,
        );
        stageName = (stage as Record<string, unknown>).name as string;
        stageColor = (stage as Record<string, unknown>).color as string;
        if ((stage as Record<string, unknown>).isWon) {
          wonAt = now;
        }
      } catch {
        // Stage not found — leave denorm fields null
      }

      const doc = await databases.createDocument(
        DB_ID,
        COLLECTIONS.deals,
        ID.unique(),
        {
          title: args.title,
          value: Number(args.value) || 0,
          stageId,
          contactId: args.contactId,
          contactName,
          contactTemperature,
          stageName,
          stageColor,
          probability: Number(args.probability) || 0,
          notes: (args.notes as string) || null,
          expectedClose: null,
          attachments: null,
          isRecurring: false,
          recurringMonths: null,
          recurringStartDate: null,
          wonAt: wonAt ?? null,
          createdAt: now,
          updatedAt: now,
        },
      );

      return {
        id: doc.$id,
        message: `Deal "${args.title}" creado exitosamente`,
      };
    }

    // -----------------------------------------------------------------------
    // 6. crm_move_deal
    // -----------------------------------------------------------------------
    case "crm_move_deal": {
      const now = new Date().toISOString();
      const dealId = args.dealId as string;
      const newStageId = args.stageId as string;

      // Resolve new stage for denormalized fields
      let stageName: string | null = null;
      let stageColor: string | null = null;
      let wonAt: string | null | undefined = undefined; // undefined = don't update
      try {
        const stage = await databases.getDocument(
          DB_ID,
          COLLECTIONS.pipelineStages,
          newStageId,
        );
        stageName = (stage as Record<string, unknown>).name as string;
        stageColor = (stage as Record<string, unknown>).color as string;

        if ((stage as Record<string, unknown>).isWon) {
          // Check if deal already has wonAt
          try {
            const existingDeal = await databases.getDocument(
              DB_ID,
              COLLECTIONS.deals,
              dealId,
            );
            if (!(existingDeal as Record<string, unknown>).wonAt) {
              wonAt = now;
            }
          } catch {
            wonAt = now;
          }
        } else {
          // Moved away from won — clear wonAt
          wonAt = null;
        }
      } catch {
        // Stage not found — proceed with just the stageId update
      }

      const payload: Record<string, unknown> = {
        stageId: newStageId,
        stageName,
        stageColor,
        updatedAt: now,
      };

      if (wonAt !== undefined) {
        payload.wonAt = wonAt;
      }

      await databases.updateDocument(DB_ID, COLLECTIONS.deals, dealId, payload);

      return { message: "Deal movido exitosamente" };
    }

    // -----------------------------------------------------------------------
    // 7. crm_log_activity
    // -----------------------------------------------------------------------
    case "crm_log_activity": {
      const now = new Date().toISOString();

      // Resolve contact for contactName denorm
      let contactName: string | null = null;
      try {
        const contact = await databases.getDocument(
          DB_ID,
          COLLECTIONS.contacts,
          args.contactId as string,
        );
        contactName = (contact as Record<string, unknown>).name as string;
      } catch {
        // Contact not found — leave contactName null
      }

      const doc = await databases.createDocument(
        DB_ID,
        COLLECTIONS.activities,
        ID.unique(),
        {
          type: args.type,
          description: args.description,
          contactId: args.contactId,
          contactName,
          dealId: (args.dealId as string) || null,
          scheduledAt: args.scheduledAt
            ? new Date(args.scheduledAt as string).toISOString()
            : null,
          completedAt: null,
          isCompleted: false,
          startAt: null,
          endAt: null,
          notes: null,
          attachments: null,
          createdAt: now,
        },
      );

      return {
        id: doc.$id,
        message: "Actividad registrada exitosamente",
      };
    }

    // -----------------------------------------------------------------------
    // 8. crm_get_pipeline
    // -----------------------------------------------------------------------
    case "crm_get_pipeline": {
      const [stagesRes, dealsRes] = await Promise.all([
        databases.listDocuments(DB_ID, COLLECTIONS.pipelineStages, [
          Query.orderAsc("order"),
          Query.limit(100),
        ]),
        databases.listDocuments(DB_ID, COLLECTIONS.deals, [
          Query.limit(500),
        ]),
      ]);

      const stages = fromDocs(stagesRes.documents);
      const deals = fromDocs(dealsRes.documents);

      return stages.map((stage) => ({
        ...stage,
        deals: deals.filter((d) => d.stageId === stage.id),
      }));
    }

    // -----------------------------------------------------------------------
    // 9. crm_get_followups
    // -----------------------------------------------------------------------
    case "crm_get_followups": {
      const res = await databases.listDocuments(
        DB_ID,
        COLLECTIONS.activities,
        [
          Query.equal("isCompleted", false),
          Query.orderAsc("scheduledAt"),
          Query.limit(500),
        ],
      );

      const pending = fromDocs(res.documents);

      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );

      return {
        overdue: pending.filter(
          (f) =>
            f.scheduledAt &&
            new Date(f.scheduledAt as string) < startOfDay,
        ),
        today: pending.filter((f) => {
          if (!f.scheduledAt) return false;
          const d = new Date(f.scheduledAt as string);
          return d >= startOfDay && d < endOfDay;
        }),
        upcoming: pending.filter(
          (f) =>
            f.scheduledAt &&
            new Date(f.scheduledAt as string) >= endOfDay,
        ),
        unscheduled: pending.filter((f) => !f.scheduledAt),
      };
    }

    // -----------------------------------------------------------------------
    // 10. crm_get_stats
    // -----------------------------------------------------------------------
    case "crm_get_stats": {
      const [contactsRes, stagesRes, dealsRes, hotLeadsRes] =
        await Promise.all([
          databases.listDocuments(DB_ID, COLLECTIONS.contacts, [
            Query.limit(1),
          ]),
          databases.listDocuments(DB_ID, COLLECTIONS.pipelineStages, [
            Query.limit(100),
          ]),
          databases.listDocuments(DB_ID, COLLECTIONS.deals, [
            Query.limit(500),
          ]),
          databases.listDocuments(DB_ID, COLLECTIONS.contacts, [
            Query.equal("temperature", "hot"),
            Query.limit(1),
          ]),
        ]);

      const stages = fromDocs(stagesRes.documents);
      const allDeals = fromDocs(dealsRes.documents);

      const wonStageIds = stages
        .filter((s) => s.isWon === true)
        .map((s) => s.id as string);
      const lostStageIds = stages
        .filter((s) => s.isLost === true)
        .map((s) => s.id as string);
      const closedIds = [...wonStageIds, ...lostStageIds];

      const activeDeals = allDeals.filter(
        (d) => !closedIds.includes(d.stageId as string),
      );
      const wonDeals = allDeals.filter((d) =>
        wonStageIds.includes(d.stageId as string),
      );

      return {
        totalContacts: contactsRes.total,
        activeDeals: activeDeals.length,
        totalPipelineValue: activeDeals.reduce(
          (sum, d) => sum + ((d.value as number) || 0),
          0,
        ),
        wonDealsValue: wonDeals.reduce(
          (sum, d) => sum + ((d.value as number) || 0),
          0,
        ),
        wonDealsCount: wonDeals.length,
        totalDeals: allDeals.length,
        conversionRate:
          allDeals.length > 0
            ? Math.round((wonDeals.length / allDeals.length) * 100)
            : 0,
        hotLeads: hotLeadsRes.total,
      };
    }

    default:
      return { error: `Tool ${name} not found` };
  }
}

// ---------------------------------------------------------------------------
// MCP stdio transport
// ---------------------------------------------------------------------------

let buffer = "";

process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;

  // Process complete messages (newline-delimited JSON)
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg: MCPMessage = JSON.parse(line);
      handleMessage(msg);
    } catch (e) {
      process.stderr.write(`Error parsing message: ${e}\n`);
    }
  }
});

function handleMessage(msg: MCPMessage): void {
  if (!msg.method) return;

  switch (msg.method) {
    case "initialize":
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "auto-crm",
            version: "1.0.0",
          },
        },
      });
      break;

    case "notifications/initialized":
      // No response needed
      break;

    case "tools/list":
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: { tools },
      });
      break;

    case "tools/call": {
      const params = msg.params as {
        name: string;
        arguments?: Record<string, unknown>;
      };
      handleTool(params.name, params.arguments || {})
        .then((result) => {
          send({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            },
          });
        })
        .catch((e) => {
          send({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Error: ${e instanceof Error ? e.message : String(e)}`,
                },
              ],
              isError: true,
            },
          });
        });
      break;
    }

    default:
      send({
        jsonrpc: "2.0",
        id: msg.id,
        error: { code: -32601, message: `Method not found: ${msg.method}` },
      });
  }
}

function send(msg: MCPMessage): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

process.stderr.write("Auto-CRM MCP Server running (Appwrite)\n");
