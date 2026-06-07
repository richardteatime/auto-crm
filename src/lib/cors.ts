import type { NextRequest } from "next/server";

/**
 * Returns the allowed origin for a public API request.
 * Reads PUBLIC_API_ORIGINS (comma-separated). If empty, falls back to "*"
 * but logs a warning in production.
 */
export function getAllowedOrigin(request: NextRequest): string {
  const raw = process.env.PUBLIC_API_ORIGINS ?? "";
  const whitelist = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const origin = request.headers.get("origin") ?? "";

  if (whitelist.length > 0) {
    if (origin && whitelist.includes(origin)) return origin;
    // No matching origin: still allow null-origin (e.g. curl / native apps)
    // but block cross-origin browsers.
    return "null";
  }

  if (process.env.NODE_ENV === "production") {
    console.warn("[cors] PUBLIC_API_ORIGINS non configurato: CORS aperto a *");
  }
  return "*";
}

export function corsHeaders(
  request: NextRequest,
  methods = "POST, OPTIONS",
): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(request),
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
