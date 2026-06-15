import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getDocumentOwner } from "@/lib/db/ownership";
import { getBookingLink } from "@/lib/db/booking-links";
import { isFinanceUser } from "@/lib/finance-auth";

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

// Dedicated session secret — decoupled from the Appwrite API key so that
// rotating the API key does not invalidate all active user sessions.
const _SESSION_SECRET = process.env.SESSION_SECRET;
if (!_SESSION_SECRET) {
  throw new Error("SESSION_SECRET è obbligatorio. Configurarlo in .env.local");
}
const SESSION_SECRET = _SESSION_SECRET;

const SESSION_COOKIE = "appwrite-session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// ---------------------------------------------------------------------------
// Signed session token (HMAC-SHA256)
// Cookie format: userId.sessionId.hmac
// ---------------------------------------------------------------------------

function signToken(userId: string, sessionId: string): string {
  const payload = `${userId}.${sessionId}`;
  const hmac = createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}.${hmac}`;
}

export function verifyToken(
  token: string
): { userId: string; sessionId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, sessionId, signature] = parts;
  const expected = createHmac("sha256", SESSION_SECRET)
    .update(`${userId}.${sessionId}`)
    .digest("hex");
  try {
    if (
      !timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expected, "hex")
      )
    )
      return null;
  } catch {
    return null;
  }
  return { userId, sessionId };
}

export async function verifySessionActive(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  try {
    const { users } = await import("@/lib/appwrite");
    const sessions = await users.listSessions(userId);
    return sessions.sessions.some((session) => session.$id === sessionId);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Admin check
// ---------------------------------------------------------------------------

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const { databases, DB_ID } = await import("@/lib/appwrite");
    const { Query } = await import("@/lib/query17");
    const ops = await databases.listDocuments(DB_ID, "crm_operators", [
      Query.equal("appwriteUserId", userId),
      Query.limit(1),
    ]);
    return ops.documents[0]?.role === "admin";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export function setSessionCookie(
  response: NextResponse,
  userId: string,
  sessionId: string
) {
  const token = signToken(userId, sessionId);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function getSessionToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * Get the current user from the signed session cookie.
 * Uses Admin API (API key) to fetch user details.
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const raw = getSessionToken(request);
  if (!raw) return null;

  const parsed = verifyToken(raw);
  if (!parsed) return null;

  const sessionActive = await verifySessionActive(parsed.userId, parsed.sessionId);
  if (!sessionActive) return null;

  try {
    const baseUrl = APPWRITE_ENDPOINT.replace(/\/v1\/?$/, "");
    const res = await fetch(`${baseUrl}/v1/users/${parsed.userId}`, {
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": APPWRITE_API_KEY,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.$id,
      email: data.email,
      name: data.name,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication. Returns either the user or a 401 NextResponse.
 */
export async function requireAuth(
  request: NextRequest
): Promise<
  | { user: AuthUser; error?: never }
  | { user?: never; error: NextResponse }
> {
  const user = await getCurrentUser(request);
  if (user) return { user };

  return {
    error: NextResponse.json(
      { success: false, error: "Non autenticato" },
      { status: 401 }
    ),
  };
}

/**
 * Require ownership or admin role for a specific document.
 * Denies by default if ownership cannot be determined.
 */
export async function requireOwnerOrAdmin(
  request: NextRequest,
  collectionId: string,
  documentId: string,
): Promise<
  | { user: AuthUser; error?: never }
  | { user?: never; error: NextResponse }
> {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  // Admin bypass
  if (await isAdmin(auth.user.id)) return { user: auth.user };

  const ownerId = await getDocumentOwner(collectionId, documentId);
  if (!ownerId || ownerId !== auth.user.id) {
    return {
      error: NextResponse.json(
        { success: false, error: "Non autorizzato" },
        { status: 403 },
      ),
    };
  }
  return { user: auth.user };
}

/**
 * Require admin role. Returns user only if they are an admin in crm_operators.
 */
export async function requireAdmin(
  request: NextRequest,
): Promise<
  | { user: AuthUser; error?: never }
  | { user?: never; error: NextResponse }
> {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  if (await isAdmin(auth.user.id)) return { user: auth.user };

  return {
    error: NextResponse.json(
      { success: false, error: "Richiede ruolo admin" },
      { status: 403 },
    ),
  };
}

/**
 * Require admin role or that the current user is assigned to the booking link.
 * Returns `{ user, isAdmin }` so callers can decide whether to allow all fields
 * (admin) or only availability (assignee).
 */
export async function requireAdminOrAssignee(
  request: NextRequest,
  linkId: string,
): Promise<
  | { user: AuthUser; isAdmin: boolean; error?: never }
  | { user?: never; error: NextResponse }
> {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  if (await isAdmin(auth.user.id)) return { user: auth.user, isAdmin: true };

  const link = await getBookingLink(linkId);
  if (!link) {
    return {
      error: NextResponse.json(
        { success: false, error: "Link non trovato" },
        { status: 404 },
      ),
    };
  }

  const assignees = link.assignedTo
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (assignees.includes(auth.user.id)) return { user: auth.user, isAdmin: false };

  return {
    error: NextResponse.json(
      { success: false, error: "Non autorizzato" },
      { status: 403 },
    ),
  };
}

/**
 * Require finance access or admin role.
 */
export async function requireFinanceOrAdmin(
  request: NextRequest,
): Promise<
  | { user: AuthUser; error?: never }
  | { user?: never; error: NextResponse }
> {
  const auth = await requireAuth(request);
  if (auth.error) return auth;

  if (isFinanceUser(auth.user.id)) return { user: auth.user };
  if (await isAdmin(auth.user.id)) return { user: auth.user };

  return {
    error: NextResponse.json(
      { success: false, error: "Richiede accesso finanziario o ruolo admin" },
      { status: 403 },
    ),
  };
}

/**
 * Check whether any users have been registered yet.
 */
export async function isFirstUser(): Promise<boolean> {
  try {
    const baseUrl = APPWRITE_ENDPOINT.replace(/\/v1\/?$/, "");
    const res = await fetch(`${baseUrl}/v1/users`, {
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": APPWRITE_API_KEY,
      },
    });
    if (res.ok) {
      const data = await res.json();
      return data.total === 0;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Server-side login: create an email+password session via REST to verify
 * credentials, then return userId and sessionId for our signed cookie.
 */
export async function createSession(
  email: string,
  password: string
): Promise<{ userId: string; sessionId: string }> {
  const baseUrl = APPWRITE_ENDPOINT.replace(/\/v1\/?$/, "");
  const res = await fetch(`${baseUrl}/v1/account/sessions/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 500));
  }

  const data = await res.json();
  return {
    userId: data.userId,
    sessionId: data.$id,
  };
}

/**
 * Server-side logout: delete the session via Admin API.
 */
export async function deleteSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const baseUrl = APPWRITE_ENDPOINT.replace(/\/v1\/?$/, "");
  await fetch(`${baseUrl}/v1/users/${userId}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Key": APPWRITE_API_KEY,
    },
  });
}
