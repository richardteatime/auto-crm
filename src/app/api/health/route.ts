import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "node-appwrite";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await databases.listDocuments(DB_ID, COLLECTIONS.pipelineStages, [
      Query.limit(1),
    ]);
    return Response.json({ status: "ok", db: "connected" });
  } catch {
    return Response.json(
      { status: "error", db: "disconnected" },
      { status: 503 }
    );
  }
}
