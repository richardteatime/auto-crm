import { NextRequest, NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { users } from "@/lib/appwrite";
import {
  createSession,
  getCurrentUser,
  isFirstUser,
  setSessionCookie,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: "Email, password e nome sono obbligatori" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "La password deve avere almeno 8 caratteri" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Formato email non valido" },
        { status: 400 }
      );
    }

    // Check if this is the first user BEFORE creating the account.
    const isFirst = await isFirstUser();

    // Once the first account exists, sign-up is closed to the public:
    // only a logged-in team member can create an account for a colleague.
    const requester = isFirst ? null : await getCurrentUser(request);
    if (!isFirst && !requester) {
      return NextResponse.json(
        {
          success: false,
          error: "Registrazione chiusa: chiedi a un collega di crearti l'account",
        },
        { status: 403 }
      );
    }

    // Create the user in Appwrite Auth.
    const user = await users.create(
      ID.unique(),
      email,
      undefined, // phone
      password,
      name
    );

    const response = NextResponse.json(
      {
        success: true,
        user: { id: user.$id, email: user.email, name: user.name },
        isFirstUser: isFirst,
      },
      { status: 201 }
    );

    // Only the very first user is logged in right away: a colleague's new
    // account must not replace the session of whoever created it.
    if (isFirst) {
      const { userId, sessionId } = await createSession(email, password);
      setSessionCookie(response, userId, sessionId);
    }
    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Errore durante la registrazione";

    // Appwrite returns "user already exists" as a 409.
    if (message.includes("already exists") || message.includes("409")) {
      return NextResponse.json(
        { success: false, error: "Un utente con questa email esiste già" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Errore durante la registrazione" },
      { status: 500 }
    );
  }
}
