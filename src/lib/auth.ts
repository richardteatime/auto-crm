import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const SESSION_COOKIE = "appwrite-session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// ---------------------------------------------------------------------------
// Signed session token (HMAC-SHA256)
// Cookie format: userId.sessionId.hmac
// This avoids depending on Appwrite's session secret, which is empty in 1.7.4.
// ---------------------------------------------------------------------------

function signToken(userId: string, sessionId: string): string {
  const payload = `${userId}.${sessionId}`;
  const hmac = createHmac("sha256", APPWRITE_API_KEY)
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
  const expected = createHmac("sha256", APPWRITE_API_KEY)
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
 * Uses Admin API (API key) to fetch user details — no session secret needed.
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const raw = getSessionToken(request);
  if (!raw) return null;

  const parsed = verifyToken(raw);
  if (!parsed) return null;

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
