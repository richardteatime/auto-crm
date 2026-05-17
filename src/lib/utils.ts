import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simple but effective email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// Convert a datetime value (string ISO, number timestamp, Date) to milliseconds
export function toMs(value: string | number | Date | null | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
  const parsed = new Date(value).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

export const VALID_TEMPERATURES = ["cold", "warm", "hot"] as const;
export const VALID_SOURCES = [
  "website", "whatsapp", "referido", "redes_sociales",
  "llamada_fria", "email", "formulario", "evento", "import", "webhook", "otro"
] as const;
export const VALID_ACTIVITY_TYPES = ["call", "email", "meeting", "note", "follow_up"] as const;

/**
 * Convert a browser-local datetime string (e.g. "2024-05-20T17:00")
 * to a UTC ISO string (e.g. "2024-05-20T15:00:00.000Z").
 * Must run in the browser where the user's timezone is known.
 */
export function localDateStrToUtcIso(localDateStr: string): string {
  return new Date(localDateStr).toISOString();
}
