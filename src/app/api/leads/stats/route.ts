import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { databases, LEADS_DB_ID, COLLECTIONS } from "@/lib/appwrite";
import { IS_SEPARATE_INSTANCE } from "@/lib/instance";
import { listLeads } from "@/lib/db/leads";
import { Query } from "@/lib/query17";

// Badge count for the menu: new leads to call + call-backs already due
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  try {
    const now = new Date().toISOString();
    if (IS_SEPARATE_INSTANCE) {
      // Scoped instance: count only the leads it can see
      const open = await listLeads({ statuses: ["nuovo", "da_richiamare", "appuntamento", "proposta"], max: 1000 });
      const fresh = open.filter((l) => l.status === "nuovo").length;
      const due = open.filter((l) => l.status !== "nuovo" && l.nextActionAt && l.nextActionAt <= now).length;
      return NextResponse.json({ new: fresh, due, toCall: fresh + due });
    }
    const [fresh, due] = await Promise.all([
      databases.listDocuments(LEADS_DB_ID, COLLECTIONS.leads, [Query.equal("status", "nuovo"), Query.limit(1)]),
      databases.listDocuments(LEADS_DB_ID, COLLECTIONS.leads, [
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
