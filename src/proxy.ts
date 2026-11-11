import { NextRequest, NextResponse } from "next/server";
import { roleFromLabels, canEnterCrm, salesCanAccess, isBlockedUser, vendioraEnabled, SALES_HOME, type Role } from "@/lib/roles";

const SESSION_COOKIE = "appwrite-session";
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.APPWRITE_API_KEY || "";

const PUBLIC_PATHS = [
  "/api/webhook",
  "/api/leads/intake",
  "/api/vendiora/wa/inbound",
  "/sw.js",
  "/manifest.webmanifest",
  "/api/auth",
  "/api/health",
  "/login",
  "/register",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(publicPath + "/")
  );
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  );
}

async function verifyTokenEdge(
  token: string,
  secret: string
): Promise<{ userId: string; sessionId: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, sessionId, signature] = parts;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${userId}.${sessionId}`)
    );
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (signature !== expected) return null;
    return { userId, sessionId };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Role check (Node runtime). The signed cookie only carries the user id, so the
// role comes from the Appwrite user labels, cached briefly per user.
// ---------------------------------------------------------------------------
const ROLE_TTL_MS = 60_000;
const roleCache = new Map<string, { role: Role; exp: number }>();

async function roleOf(userId: string): Promise<Role | null> {
  const hit = roleCache.get(userId);
  if (hit && hit.exp > Date.now()) return hit.role;
  const endpoint = (process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "").replace(/\/v1\/?$/, "");
  try {
    const res = await fetch(`${endpoint}/v1/users/${userId}`, {
      headers: {
        "X-Appwrite-Project": process.env.APPWRITE_PROJECT_ID || "",
        "X-Appwrite-Key": process.env.APPWRITE_API_KEY || "",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { labels?: string[] };
    if (!canEnterCrm(data.labels)) return null; // no access to this CRM instance
    const role = roleFromLabels(data.labels);
    roleCache.set(userId, { role, exp: Date.now() + ROLE_TTL_MS });
    return role;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static assets and public paths bypass auth entirely.
  if (isStaticAsset(pathname) || isPublic(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  // No session → block.
  if (!sessionToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Non autenticato" },
        { status: 401 }
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verify HMAC signature to prevent cookie forgery.
  const valid = await verifyTokenEdge(sessionToken, SESSION_SECRET);
  if (!valid) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Sessione non valida" },
        { status: 401 }
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Account shut out of this CRM (CRM_BLOCKED_USERS): drop the session and send to login
  if (isBlockedUser(valid.userId)) {
    const res = pathname.startsWith("/api/")
      ? NextResponse.json({ success: false, error: "Questo account non ha accesso a questo CRM." }, { status: 403 })
      : NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // Vendiora switched off here (separate instances, VENDIORA_ENABLED=0): back to the leads
  if (!vendioraEnabled() && (pathname === "/vendiora" || pathname.startsWith("/vendiora/") || pathname.startsWith("/api/vendiora/"))) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ success: false, error: "Vendiora non è attiva in questo CRM" }, { status: 404 });
    return NextResponse.redirect(new URL("/leads", request.url));
  }

  // A salesperson only reaches the Lead section: everything else is refused server-side.
  // In a separate CRM instance every page needs a user with access to it.
  if (process.env.CRM_ACCESS_LABEL || !salesCanAccess(pathname)) {
    const role = await roleOf(valid.userId);
    if (role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Non hai accesso a questa sezione" },
          { status: role ? 403 : 401 }
        );
      }
      const home = request.nextUrl.clone();
      home.pathname = role ? SALES_HOME : "/login";
      home.search = "";
      return NextResponse.redirect(home);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
