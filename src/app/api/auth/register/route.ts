import { NextRequest, NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { users } from "@/lib/appwrite";
import {
  createSession,
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

    // Create the user in Appwrite Auth.
    const user = await users.create(
      ID.unique(),
      email,
      undefined, // phone
      password,
      name
    );

    // Immediately create a session so the user is logged in after registration.
    const { secret } = await createSession(email, password);

    const isFirst = await isFirstUser();

    const response = NextResponse.json(
      {
        success: true,
        user: { id: user.$id, email: user.email, name: user.name },
        isFirstUser: isFirst,
      },
      { status: 201 }
    );

    setSessionCookie(response, secret);
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
      { success: false, error: message },
      { status: 500 }
    );
  }
}
