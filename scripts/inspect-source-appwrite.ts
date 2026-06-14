#!/usr/bin/env node
import { config } from "dotenv";
import { Client, Databases, Query } from "node-appwrite";
import { writeFileSync } from "fs";
import { join } from "path";

config({ path: ".env.source.local" });

const ENDPOINT = process.env.SOURCE_APPWRITE_ENDPOINT || "";
const PROJECT_ID = process.env.SOURCE_APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.SOURCE_APPWRITE_API_KEY || "";
const DB_ID = process.env.SOURCE_APPWRITE_DATABASE_ID || "crm";

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error("Mancano SOURCE_APPWRITE_ENDPOINT, PROJECT_ID o API_KEY in .env.source.local");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

interface FieldInfo {
  key: string;
  type: string;
  required: boolean;
  array: boolean;
  default?: unknown;
  elements?: string;
  relatedCollection?: string;
  relationType?: string;
}

interface CollectionInfo {
  id: string;
  name: string;
  documentCount: number;
  fields: FieldInfo[];
}

async function main() {
  console.log(`Connessione a ${ENDPOINT} → progetto ${PROJECT_ID} → database ${DB_ID}`);

  let collectionsPage;
  try {
    collectionsPage = await databases.listCollections(DB_ID);
  } catch (error) {
    console.error("Errore nel listare le collection:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const collections = collectionsPage.collections;
  console.log(`Trovate ${collections.length} collection`);

  const result: CollectionInfo[] = [];

  for (const collection of collections) {
    const collectionId = collection.$id;
    const collectionName = collection.name;

    // Count documents
    let documentCount = 0;
    try {
      const docs = await databases.listDocuments(DB_ID, collectionId, [Query.limit(1)]);
      documentCount = docs.total;
    } catch {
      documentCount = -1;
    }

    // List attributes
    let fields: FieldInfo[] = [];
    try {
      const attrs = await databases.listAttributes(DB_ID, collectionId);
      fields = attrs.attributes.map((attr: Record<string, unknown>) => ({
        key: attr.key,
        type: attr.type,
        required: attr.required,
        array: attr.array,
        default: attr.default,
        elements: attr.elements,
        relatedCollection: attr.relatedCollection,
        relationType: attr.relationType,
      })) as FieldInfo[];
    } catch {
      fields = [];
    }

    result.push({
      id: collectionId,
      name: collectionName,
      documentCount,
      fields,
    });

    console.log(`- ${collectionId} (${collectionName}): ${documentCount} documenti, ${fields.length} attributi`);
  }

  const outPath = join(process.cwd(), "scripts", "source-schema.json");
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nReport salvato in: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
