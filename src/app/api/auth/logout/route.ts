import { NextRequest, NextResponse } from "next/server";
import {
  deleteSession,
  getSessionToken,
  clearSessionCookie,
  verifyToken,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const raw = getSessionToken(request);

  if (raw) {
    const parsed = verifyToken(raw);
    if (parsed) {
      try {
        await deleteSession(parsed.userId, parsed.sessionId);
      } catch {
        // Session may already be expired or invalid — that's fine.
      }
    }
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
