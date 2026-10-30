import { NextRequest, NextResponse } from "next/server";
import { users } from "@/lib/appwrite";
import { createSession, deleteSession, requireAuth } from "@/lib/auth";

// Same bounds Appwrite enforces on user passwords
const MIN_LENGTH = 8;
const MAX_LENGTH = 256;

type Field = "currentPassword" | "newPassword";

function fail(error: string, status: number, field?: Field) {
  return NextResponse.json({ success: false, error, field }, { status });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Richiesta non valida", 400);
  }
  const { currentPassword, newPassword } = body;

  if (typeof currentPassword !== "string" || !currentPassword) {
    return fail("Inserisci la password attuale", 400, "currentPassword");
  }
  if (typeof newPassword !== "string" || newPassword.length < MIN_LENGTH) {
    return fail(`La nuova password deve avere almeno ${MIN_LENGTH} caratteri`, 400, "newPassword");
  }
  if (newPassword.length > MAX_LENGTH) {
    return fail(`La nuova password può avere al massimo ${MAX_LENGTH} caratteri`, 400, "newPassword");
  }
  if (newPassword === currentPassword) {
    return fail("La nuova password deve essere diversa da quella attuale", 400, "newPassword");
  }

  // Appwrite has no "check password" call: opening a session with the current
  // password proves it, and that throwaway session is closed right away.
  try {
    const check = await createSession(auth.user.email, currentPassword);
    await deleteSession(check.userId, check.sessionId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("rate_limit") || message.includes("429")) {
      return fail("Troppi tentativi. Riprova tra qualche minuto.", 429);
    }
    if (
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("ETIMEDOUT")
    ) {
      return fail("Impossibile connettersi al server. Riprova tra poco.", 503);
    }
    return fail("La password attuale non è corretta", 400, "currentPassword");
  }

  try {
    await users.updatePassword(auth.user.id, newPassword);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    const type = (error as { type?: string }).type ?? "";

    // Appwrite's optional password policies (history, personal data, dictionary)
    if (type === "password_recently_used") {
      return fail("Hai usato questa password di recente: scegline un'altra", 400, "newPassword");
    }
    if (type === "password_personal_data") {
      return fail("La password non può contenere il tuo nome, l'email o il telefono", 400, "newPassword");
    }
    if (message.includes("commonly used")) {
      return fail("Questa password è troppo comune: scegline un'altra", 400, "newPassword");
    }

    console.error("[PASSWORD CHANGE ERROR]", message);
    return fail("Non è stato possibile cambiare la password. Riprova.", 500);
  }
}
