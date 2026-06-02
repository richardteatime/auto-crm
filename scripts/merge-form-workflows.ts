/**
 * Unisce i DUE workflow con trigger `form_submitted` in UNO solo.
 *
 *   TIENE   : "Lead dal form → Leo chiama o cliente prenota"  (quello col bivio telefono/email)
 *   ASSORBE : "Lead dal form: notifica team"                   (la sua azione viene innestata
 *                                                               subito dopo il trigger)
 *   DISATTIVA: il duplicato (status -> "draft", reversibile, NON eliminato)
 *
 * Risultato:
 *   [Form inviato] -> [Notifica al team] -> [Ha lasciato il telefono?]
 *                                              Sì -> Email a Leo (chiama)
 *                                              No -> Email al cliente (prenota)
 *
 * Il workflow del booking (trigger `booking_created`) NON viene toccato: ha un
 * trigger diverso e non può vivere nello stesso grafo.
 *
 * Uso (dalla cartella auto-crm):  npx tsx scripts/merge-form-workflows.ts
 */
import { Client, Databases, Query } from "node-appwrite";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const PROJECT = process.env.APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

// Nomi di riferimento (con fallback euristico se non combaciano esattamente).
const KEEP_NAME = "Lead dal form → Leo chiama o cliente prenota";
const DUP_NAME = "Lead dal form: notifica team";

type Node = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { nodeType: string; label: string; config: Record<string, unknown> };
};
type Edge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  type?: string;
};

function parse<T>(raw: unknown, fallback: T): T {
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  if (!PROJECT || !API_KEY) throw new Error("Mancano APPWRITE_PROJECT_ID / APPWRITE_API_KEY in .env.local");
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const db = new Databases(client);
  const now = new Date().toISOString();

  const res = await db.listDocuments(DB_ID, "workflows", [
    Query.equal("triggerType", "form_submitted"),
    Query.limit(50),
  ]);
  console.log(`Workflow con trigger form_submitted: ${res.total}`);
  for (const w of res.documents) console.log(`  - ${w.name} | status=${w.status} | id=${w.$id}`);

  // --- Identifica KEEP (quello col bivio) e DUP (la notifica team) ---
  const docs = res.documents;
  const keep =
    docs.find((w) => w.name === KEEP_NAME) ??
    docs.find((w) => parse<Node[]>(w.nodes, []).some((n) => n.type === "condition")) ??
    docs.find((w) => /leo/i.test(String(w.name)));
  if (!keep) throw new Error("Workflow principale (col bivio) non trovato tra i form_submitted.");

  const dup =
    docs.find((w) => w.$id !== keep.$id && w.name === DUP_NAME) ??
    docs.find((w) => w.$id !== keep.$id && /notifica/i.test(String(w.name)));

  console.log(`\nTengo  : "${keep.name}" (${keep.$id})`);
  console.log(dup ? `Assorbo: "${dup.name}" (${dup.$id})` : "Assorbo: (nessun duplicato trovato — innesto saltato)");

  // --- Grafo di KEEP ---
  const keepNodes = parse<Node[]>(keep.nodes, []);
  let keepEdges = parse<Edge[]>(keep.edges, []);
  const trigger = keepNodes.find((n) => n.type === "trigger");
  if (!trigger) throw new Error("Il workflow principale non ha un nodo trigger.");

  // Bersagli attuali del trigger (di norma: la condizione).
  const triggerOut = keepEdges.filter((e) => e.source === trigger.id);
  const firstTargets = triggerOut.map((e) => e.target);

  // Idempotenza: se il trigger punta già a un'azione, la notifica è già stata innestata.
  const alreadyMerged = firstTargets
    .map((id) => keepNodes.find((n) => n.id === id))
    .some((n) => n?.type === "action");

  // --- Estrai la catena di azioni "notifica team" dal duplicato ---
  let notifyNodes: Node[] = [];
  if (dup && !alreadyMerged) {
    const dupNodes = parse<Node[]>(dup.nodes, []);
    const dupEdges = parse<Edge[]>(dup.edges, []);
    const dupTrigger = dupNodes.find((n) => n.type === "trigger");
    // Segui la catena dal trigger raccogliendo le azioni in ordine.
    let cur = dupTrigger?.id;
    const seen = new Set<string>();
    while (cur) {
      seen.add(cur);
      const nextEdge = dupEdges.find((e) => e.source === cur);
      if (!nextEdge) break;
      const nextNode = dupNodes.find((n) => n.id === nextEdge.target);
      if (!nextNode || seen.has(nextNode.id)) break;
      if (nextNode.type === "action") notifyNodes.push(nextNode);
      cur = nextNode.id;
    }
    if (notifyNodes.length === 0) notifyNodes = dupNodes.filter((n) => n.type === "action");
  }

  if (alreadyMerged) {
    console.log("\nIl workflow principale risulta GIÀ unito (il trigger punta a un'azione). Salto l'innesto.");
  } else if (notifyNodes.length === 0) {
    console.log("\nNessuna azione da innestare dal duplicato. Lascio il grafo invariato.");
  } else {
    // Sposta in basso tutto tranne il trigger, per far spazio alla/e notifica/e.
    const shift = 150 * notifyNodes.length;
    for (const n of keepNodes) {
      if (n.id !== trigger.id) n.position = { ...n.position, y: n.position.y + shift };
    }
    // Clona i nodi notifica con id/posizioni nuovi, tra trigger e (ex) bersagli.
    const stamp = Date.now();
    const clones: Node[] = notifyNodes.map((n, i) => ({
      ...n,
      id: `n_notify_${stamp}_${i}`,
      position: { x: trigger.position.x, y: trigger.position.y + 150 * (i + 1) },
      data: { ...n.data, config: { ...n.data.config } },
    }));

    // Rimuovi gli archi uscenti dal trigger e ricuci: trigger -> notifiche -> bersagli.
    keepEdges = keepEdges.filter((e) => e.source !== trigger.id);
    const chain = [trigger.id, ...clones.map((c) => c.id)];
    const newEdges: Edge[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      newEdges.push({ id: `e_${chain[i]}_${chain[i + 1]}`, source: chain[i], target: chain[i + 1], type: "smoothstep" });
    }
    const lastId = clones[clones.length - 1].id;
    for (const t of firstTargets) {
      newEdges.push({ id: `e_${lastId}_${t}`, source: lastId, target: t, type: "smoothstep" });
    }

    keepNodes.push(...clones);
    keepEdges.push(...newEdges);

    await db.updateDocument(DB_ID, "workflows", keep.$id, {
      nodes: JSON.stringify(keepNodes),
      edges: JSON.stringify(keepEdges),
      description:
        "Quando arriva un lead dal form: avvisa il team, poi — se ha lasciato il telefono avvisa Leo " +
        "per chiamarlo, altrimenti invia al cliente il link per prenotare la call.",
      updatedAt: now,
    });
    console.log(
      `\nInnestate ${clones.length} azione/i di notifica team dopo il trigger: ` +
        clones.map((c) => `${c.data.label} (${c.data.nodeType})`).join(", "),
    );
  }

  // --- Disattiva il duplicato ---
  if (dup && dup.status !== "draft") {
    await db.updateDocument(DB_ID, "workflows", dup.$id, { status: "draft", updatedAt: now });
    console.log(`Duplicato "${dup.name}" -> status "draft" (disattivato, reversibile).`);
  } else if (dup) {
    console.log(`Duplicato "${dup.name}" era già in stato "${dup.status}".`);
  }

  console.log("\nFatto. Ora c'è UN solo workflow attivo su form_submitted.");
}

main().catch((e) => {
  console.error("Errore merge-form-workflows:", e);
  process.exit(1);
});
