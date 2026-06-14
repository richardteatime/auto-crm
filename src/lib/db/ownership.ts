import { databases, DB_ID } from "@/lib/appwrite";

export async function getDocumentOwner(
  collectionId: string,
  documentId: string,
): Promise<string | null> {
  try {
    const doc = await databases.getDocument(DB_ID, collectionId, documentId);
    return (doc.createdBy as string) || null;
  } catch {
    return null;
  }
}
