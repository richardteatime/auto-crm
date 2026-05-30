import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.APPWRITE_API_KEY || "";
const FINANCE_COOKIE = "finance-session";
const FINANCE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Authorized finance users (Appwrite user IDs)
const FINANCE_USER_IDS = [
  "69ef70767bfe83ca7647", // Ricardo consuegra
  "69ef7adf0011bc8f0d8d", // leonardo sartori
  "69fe3569001d6868d7e0", // francesco mellucci
];

export function isFinanceUser(userId: string): boolean {
  return FINANCE_USER_IDS.includes(userId);
}

function signFinanceToken(userId: string): string {
  const payload = `${userId}.finance`;
  const hmac = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

export function verifyFinanceToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, marker, signature] = parts;
  if (marker !== "finance") return null;
  const expected = createHmac("sha256", SESSION_SECRET)
    .update(`${userId}.finance`)
    .digest("hex");
  try {
    if (
      !timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expected, "hex")
      )
    )
      return null;
  } catch {
    return null;
  }
  if (!isFinanceUser(userId)) return null;
  return userId;
}

export function setFinanceCookie(response: NextResponse, userId: string) {
  const token = signFinanceToken(userId);
  response.cookies.set(FINANCE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: FINANCE_MAX_AGE,
  });
  return response;
}

export function clearFinanceCookie(response: NextResponse) {
  response.cookies.set(FINANCE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function getFinanceToken(request: NextRequest): string | null {
  return request.cookies.get(FINANCE_COOKIE)?.value ?? null;
}
