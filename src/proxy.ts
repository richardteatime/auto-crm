import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "appwrite-session";
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.APPWRITE_API_KEY || "";

const PUBLIC_PATHS = [
  "/api/webhook",
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
