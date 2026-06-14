#!/usr/bin/env node
import { config } from "dotenv";
import { Client, Databases, Query } from "node-appwrite";
import { writeFileSync } from "fs";

config({ path: ".env.source.local" });

const ENDPOINT = process.env.SOURCE_APPWRITE_ENDPOINT || "";
const PROJECT_ID = process.env.SOURCE_APPWRITE_PROJECT_ID || "";
const API_KEY = process.env.SOURCE_APPWRITE_API_KEY || "";
const DB_ID = process.env.SOURCE_APPWRITE_DATABASE_ID || "crm";

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new Databases(client);

async function sample(collectionId: string, limit = 3) {
  try {
    const res = await databases.listDocuments(DB_ID, collectionId, [Query.limit(limit)]);
    return res.documents.map((d) => {
      const { $id, $createdAt, $updatedAt, $permissions, $collectionId, $databaseId, ...rest } = d;
      return { id: $id, ...rest };
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const stages = await databases.listDocuments(DB_ID, "pipeline_stages", [Query.limit(100)]);
  const contacts = await sample("contacts");
  const deals = await sample("deals");
  const opportunities = await sample("opportunities");
  const projects = await sample("projects");

  const report = {
    pipelineStages: stages.documents.map((d) => {
      const { $id, $createdAt, $updatedAt, $permissions, ...rest } = d;
      return { id: $id, ...rest };
    }),
    contacts,
    deals,
    opportunities,
    projects,
  };

  console.log(JSON.stringify(report, null, 2));
  writeFileSync("scripts/source-sample.json", JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
