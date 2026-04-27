import { NextRequest, NextResponse } from "next/server";

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";

const SESSION_COOKIE = "appwrite-session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, matching Appwrite default

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

export function setSessionCookie(
  response: NextResponse,
  sessionSecret: string
) {
  response.cookies.set(SESSION_COOKIE, sessionSecret, {
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
 * Get the current user from the session cookie.
 * Uses direct REST call to bypass SDK v24 header incompatibility with 1.7.4.
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  try {
    const baseUrl = APPWRITE_ENDPOINT.replace(/\/v1\/?$/, "");
    const res = await fetch(`${baseUrl}/v1/account`, {
      headers: {
        "Content-Type": "application/json",
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Session": token,
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
 * Use this in API routes:
 *
 *   const result = await requireAuth(request);
 *   if (result.error) return result.error;
 *   const user = result.user;
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
 * Useful for the first-time setup flow.
 */
export async function isFirstUser(): Promise<boolean> {
  try {
    // Direct REST call to bypass SDK v24 query format (incompatible with 1.7.4)
    const endpoint = APPWRITE_ENDPOINT;
    const url = endpoint.replace(/\/v1\/?$/, "") + "/v1/users";
    const res = await fetch(url, {
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": process.env.APPWRITE_API_KEY || "",
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
 * Server-side login: create an email+password session via direct REST call
 * (bypass SDK v24 which sends incompatible headers to Appwrite 1.7.4).
 */
export async function createSession(
  email: string,
  password: string
): Promise<{ secret: string; userId: string }> {
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
  return { secret: data.secret, userId: data.userId };
}

/**
 * Server-side logout: delete the session via direct REST call.
 */
export async function deleteSession(
  sessionToken: string
): Promise<void> {
  const baseUrl = APPWRITE_ENDPOINT.replace(/\/v1\/?$/, "");
  await fetch(`${baseUrl}/v1/account/sessions/current`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Session": sessionToken,
    },
  });
}
