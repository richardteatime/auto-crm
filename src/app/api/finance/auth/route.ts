import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import {
  setFinanceCookie,
  clearFinanceCookie,
  verifyFinanceToken,
  isFinanceUser,
} from "@/lib/finance-auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e password obbligatorie" },
        { status: 400 }
      );
    }

    const { userId } = await createSession(email, password);

    if (!isFinanceUser(userId)) {
      return NextResponse.json(
        { error: "Accesso non autorizzato" },
        { status: 403 }
      );
    }

    const response = NextResponse.json({ success: true });
    setFinanceCookie(response, userId);
    return response;
  } catch (e) {
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

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  clearFinanceCookie(response);
  return response;
}
