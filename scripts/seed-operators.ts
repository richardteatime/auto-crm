#!/usr/bin/env node
import "./load-env";

import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { upsertCrmOperator } from "@/lib/db/crm-operators";

const USERS = [
  {
    name: "Francesco Mellucci",
    appwriteUserId: "6a162ac9000920902da8",
  },
  {
    name: "Leonardo Sartori",
    appwriteUserId: "6a2dccd40010177db894",
  },
  {
    name: "Ricardo Consuegra",
    appwriteUserId: "6a2dcc800037d83f4532",
  },
];

// Leonardo was initially created with a duplicate/wrong ID during the migration.
// Remove any stale operator record pointing to the old ID so it does not grant admin access.
const STALE_LEONARDO_ID = "6a2dcefde095891b0300";

async function deleteStaleLeonardoOperator() {
  try {
    const res = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.crmOperators,
      [Query.equal("appwriteUserId", STALE_LEONARDO_ID), Query.limit(100)],
    );
    for (const doc of res.documents) {
      await databases.deleteDocument(DB_ID, COLLECTIONS.crmOperators, doc.$id);
      console.log(`Deleted stale Leonardo operator: ${doc.$id}`);
    }
  } catch (error) {
    console.warn(
      "Could not clean up stale Leonardo operator:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function findOperatorByUserId(userId: string) {
  try {
    const res = await databases.listDocuments(
      DB_ID,
      COLLECTIONS.crmOperators,
      [Query.equal("appwriteUserId", userId), Query.limit(1)],
    );
    return res.documents[0]?.$id ?? null;
  } catch {
    return null;
  }
}

async function main() {
  await deleteStaleLeonardoOperator();

  for (const user of USERS) {
    const existingId = await findOperatorByUserId(user.appwriteUserId);
    await upsertCrmOperator({
      id: existingId ?? undefined,
      name: user.name,
      appwriteUserId: user.appwriteUserId,
      role: "admin",
      scopes: ["finance", "crm:*"],
      active: true,
      notes: "Created during production migration",
    });
    console.log(
      `crm_operator admin ${existingId ? "updated" : "created"}: ${user.name} (${user.appwriteUserId})`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
