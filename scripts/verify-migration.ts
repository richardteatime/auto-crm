#!/usr/bin/env node
import "./load-env";

import { Client, Databases, Query } from "node-appwrite";

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "";
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.APPWRITE_API_KEY || "";
const DB_ID = process.env.APPWRITE_DATABASE_ID || "crm";

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const db = new Databases(client);

const COLLECTIONS = [
  "contacts",
  "pipeline_stages",
  "deals",
  "opportunities",
  "projects",
  "quotes",
  "activities",
  "revenues",
  "calendar_events",
];

async function countCollection(collectionId: string) {
  const res = await db.listDocuments(DB_ID, collectionId, [Query.limit(1)]);
  return res.total;
}

async function main() {
  console.log("=== CONTEGGI TARGET ===\n");
  for (const col of COLLECTIONS) {
    const count = await countCollection(col);
    console.log(`${col}: ${count}`);
  }

  console.log("\n=== SPOT-CHECK RELAZIONI ===\n");
  const deals = await db.listDocuments(DB_ID, "deals", [Query.limit(3)]);
  for (const deal of deals.documents) {
    const contactId = String(deal.contactId ?? "");
    const stageId = String(deal.stageId ?? "");
    let contactName = "N/A";
    let stageName = "N/A";
    try {
      const contact = await db.getDocument(DB_ID, "contacts", contactId);
      contactName = String(contact.name ?? "");
    } catch {
      contactName = "NOT FOUND";
    }
    try {
      const stage = await db.getDocument(DB_ID, "pipeline_stages", stageId);
      stageName = String(stage.name ?? "");
    } catch {
      stageName = "NOT FOUND";
    }
    console.log(`deal ${deal.$id}: contact=${contactName}, stage=${stageName}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
