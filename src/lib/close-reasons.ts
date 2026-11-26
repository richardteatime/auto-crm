/** Why a deal / opportunity is closed as lost. Shared by the dialog (client) and the API (server). */
export const CLOSE_REASONS = [
  "Cliente non interessato",
  "Prezzo troppo alto",
  "Ha scelto un concorrente",
  "Nessuna risposta",
  "Progetto rimandato",
  "Altro",
] as const;

export const CLOSE_REASON_MAX = 500;

/** Trimmed reason, or null if missing/too short/too long */
export function parseCloseReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length >= 3 && v.length <= CLOSE_REASON_MAX ? v : null;
}
