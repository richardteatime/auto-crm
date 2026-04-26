import { Client, Account } from "node-appwrite";
import { users } from "./appwrite";
import { NextRequest, NextResponse } from "next/server";

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "http://localhost:80/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "";

const SESSION_COOKIE = "appwrite-session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year, matching Appwrite default

/** Create a client WITHOUT the API key — used for user-session operations. */
function createSessionClient() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);
  return { client, account: new Account(client) };
}

/** Create a client and attach an existing session token. */
function createAuthenticatedClient(sessionToken: string) {
  const { client, account } = createSessionClient();
  client.setSession(sessionToken);
  return { client, account };
}

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
 * Returns null when there is no cookie or the session is invalid.
 */
export async function getCurrentUser(
  request: NextRequest
): Promise<AuthUser | null> {
  const token = getSessionToken(request);
  if (!token) return null;

  try {
    const { account } = createAuthenticatedClient(token);
    const user = await account.get();
    return {
      id: user.$id,
      email: user.email,
      name: user.name,
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
    const result = await users.list({ queries: ["limit(1)"] });
    return result.total === 0;
  } catch {
    // If we can't reach Appwrite, assume users exist to be safe.
    return false;
  }
}

/**
 * Server-side login: create an email+password session via the Appwrite Account
 * SDK (no API key) and return the session secret.
 */
export async function createSession(
  email: string,
  password: string
): Promise<{ secret: string; userId: string }> {
  const { account } = createSessionClient();
  const session = await account.createEmailPasswordSession(email, password);
  return { secret: session.secret, userId: session.userId };
}

/**
 * Server-side logout: delete the session identified by the cookie token.
 */
export async function deleteSession(
  sessionToken: string
): Promise<void> {
  const { account } = createAuthenticatedClient(sessionToken);
  await account.deleteSession("current");
}
