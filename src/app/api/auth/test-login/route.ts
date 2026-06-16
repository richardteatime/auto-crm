import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/appwrite";
import { createServerSession, setSessionCookie } from "@/lib/auth";

/**
 * Test-only login endpoint.
 *
 * Creates an authenticated session for E2E tests without using the
 * rate-limited /account/sessions/email endpoint. It relies on the Appwrite
 * admin API to create/find a test user and create a server session.
 *
 * This route is disabled in production and requires ALLOW_TEST_AUTH=true.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Test login is disabled in production" },
      { status: 403 }
    );
  }

  if (process.env.ALLOW_TEST_AUTH !== "true") {
    return NextResponse.json(
      { success: false, error: "Test login is not allowed" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email =
    typeof body.email === "string" ? body.email : "e2e-test@example.com";
  const password =
    typeof body.password === "string" ? body.password : "TestPassword123!";
  const name = typeof body.name === "string" ? body.name : "E2E Test User";

  let userId: string;
  try {
    const user = await users.create("unique()", email, undefined, password, name);
    userId = user.$id;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("already exists") || message.includes("409")) {
      const list = await users.list([]);
      const existing = list.users.find((u) => u.email === email);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: "Test user exists but could not be found" },
          { status: 500 }
        );
      }
      userId = existing.$id;
    } else {
      return NextResponse.json(
        { success: false, error: "Failed to create/find test user" },
        { status: 500 }
      );
    }
  }

  try {
    const { userId: sessionUserId, sessionId } = await createServerSession(
      userId
    );

    if (sessionUserId !== userId) {
      return NextResponse.json(
        { success: false, error: "Session user mismatch" },
        { status: 500 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: { id: userId, email, name },
    });
    setSessionCookie(response, userId, sessionId);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
