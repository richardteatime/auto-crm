import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { ID, type Models } from "node-appwrite";
import { Query } from "@/lib/query17";

// ---------------------------------------------------------------------------
// getSetting
// ---------------------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  try {
    const res = await databases.listDocuments(DB_ID, COLLECTIONS.crmSettings, [
      Query.equal("key", key),
      Query.limit(1),
    ]);

    if (res.documents.length === 0) return null;
    return (res.documents[0] as unknown as { value: string }).value;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// setSetting (upsert pattern)
// ---------------------------------------------------------------------------

export async function setSetting(
  key: string,
  value: string,
): Promise<void> {
  // Try to find existing document for this key
  const res = await databases.listDocuments(DB_ID, COLLECTIONS.crmSettings, [
    Query.equal("key", key),
    Query.limit(1),
  ]);

  if (res.documents.length > 0) {
    // Update existing
    await databases.updateDocument(
      DB_ID,
      COLLECTIONS.crmSettings,
      res.documents[0].$id,
      { value },
    );
  } else {
    // Create new
    await databases.createDocument(
      DB_ID,
      COLLECTIONS.crmSettings,
      ID.unique(),
      { key, value },
    );
  }
}
