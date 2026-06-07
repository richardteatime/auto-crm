import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ID } from "node-appwrite";
import { users } from "@/lib/appwrite";
import {
  createSession,
  isFirstUser,
  setSessionCookie,
} from "@/lib/auth";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dati non validi", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;

    // Check if this is the first user BEFORE creating the account.
    const isFirst = await isFirstUser();

    // Create the user in Appwrite Auth.
    const user = await users.create(
      ID.unique(),
      email,
      undefined, // phone
      password,
      name
    );

    // Immediately create a session so the user is logged in after registration.
    const { userId, sessionId } = await createSession(email, password);

    const response = NextResponse.json(
      {
        success: true,
        user: { id: user.$id, email: user.email, name: user.name },
        isFirstUser: isFirst,
      },
      { status: 201 }
    );

    setSessionCookie(response, userId, sessionId);
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
