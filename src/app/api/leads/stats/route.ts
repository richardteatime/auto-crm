import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { databases, DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { Query } from "@/lib/query17";

// Badge count for the menu: new leads to call + call-backs already due
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const now = new Date().toISOString();
    const [fresh, due] = await Promise.all([
      databases.listDocuments(DB_ID, COLLECTIONS.leads, [Query.equal("status", "nuovo"), Query.limit(1)]),
      databases.listDocuments(DB_ID, COLLECTIONS.leads, [
        Query.equal("status", ["da_richiamare", "appuntamento", "proposta"]),
        Query.lessThanEqual("nextActionAt", now),
        Query.limit(1),
      ]),
    ]);
    return NextResponse.json({ new: fresh.total, due: due.total, toCall: fresh.total + due.total });
  } catch {
    return NextResponse.json({ new: 0, due: 0, toCall: 0 });
  }
}
