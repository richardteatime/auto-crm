import { cookies } from "next/headers";
import { users } from "@/lib/appwrite";
import { verifyToken, type AuthUser } from "@/lib/auth";
import { roleFromLabels, canEnterCrm } from "@/lib/roles";

/** Current user for Server Components (route handlers keep using getCurrentUser) */
export async function getServerUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const raw = store.get("appwrite-session")?.value;
  if (!raw) return null;
  const parsed = verifyToken(raw);
  if (!parsed) return null;
  try {
    const u = await users.get(parsed.userId);
    if (!canEnterCrm(u.labels)) return null;
    return { id: u.$id, email: u.email, name: u.name, labels: u.labels ?? [], role: roleFromLabels(u.labels) };
  } catch {
    return null;
  }
}
