import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, setSessionCookie } from "@/lib/auth";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dati non validi", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    const { userId, sessionId } = await createSession(email, password);

    // Fetch user details from the server SDK to return to the client.
    const { users } = await import("@/lib/appwrite");
    const user = await users.get(userId);

    const response = NextResponse.json({
      success: true,
      user: { id: user.$id, email: user.email, name: user.name },
    });

    setSessionCookie(response, userId, sessionId);
    return response;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Errore durante il login";

    console.error("[LOGIN ERROR]", message);

    // Email verification required
    if (message.includes("verification") || message.includes("verif")) {
      return NextResponse.json(
        { success: false, error: "Email non verificato. Controlla la tua email e verifica l'account." },
        { status: 403 }
      );
    }

    // Rate limit exceeded
    if (message.includes("rate_limit") || message.includes("429")) {
      return NextResponse.json(
        { success: false, error: "Troppi tentativi. Riprova tra qualche minuto." },
        { status: 429 }
      );
    }

    // Connection failure
    if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("fetch failed") || message.includes("ETIMEDOUT")) {
      return NextResponse.json(
        { success: false, error: "Impossibile connettersi al server. Controlla la configurazione Appwrite." },
        { status: 503 }
      );
    }

    // Appwrite returns 401 for invalid credentials.
    if (message.includes("Invalid credentials") || message.includes("401")) {
      return NextResponse.json(
        { success: false, error: "Email o password non valide" },
        { status: 401 }
      );
    }

    // User not found (Appwrite returns 400 for missing user in session creation).
    if (message.includes("user") && message.includes("not found")) {
      return NextResponse.json(
        { success: false, error: "Utente non trovato" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Email o password non valide" },
      { status: 401 }
    );
  }
}
