import { NextRequest, NextResponse } from "next/server";
import {
  deleteSession,
  getSessionToken,
  clearSessionCookie,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const token = getSessionToken(request);

  if (token) {
    try {
      await deleteSession(token);
    } catch {
      // Session may already be expired or invalid — that's fine.
      // We still clear the cookie on our side.
    }
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
