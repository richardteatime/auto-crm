import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import {
  setFinanceCookie,
  clearFinanceCookie,
  verifyFinanceToken,
  isFinanceUser,
} from "@/lib/finance-auth";

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
        { error: "Dati non validi", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { userId } = await createSession(parsed.data.email, parsed.data.password);

    if (!isFinanceUser(userId)) {
      return NextResponse.json(
        { error: "Accesso non autorizzato" },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ success: true });
    setFinanceCookie(response, userId);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Credenziali non valide" },
      { status: 401 }
    );
  }
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("finance-session")?.value;
  if (!token || !verifyFinanceToken(token)) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearFinanceCookie(response);
  return response;
}
