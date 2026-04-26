import type { Temperature, LeadSource, ActivityType } from "@/types";

export const TEMPERATURE_CONFIG: Record<
  Temperature,
  { label: string; color: string; bgColor: string }
> = {
  cold: { label: "Freddo", color: "#64748b", bgColor: "#f1f5f9" },
  warm: { label: "Tiepido", color: "#ea580c", bgColor: "#fff7ed" },
  hot: { label: "Caldo", color: "#dc2626", bgColor: "#fef2f2" },
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Sito web",
  whatsapp: "WhatsApp",
  referido: "Referral",
  redes_sociales: "Social media",
  llamada_fria: "Chiamata a freddo",
  email: "Email",
  formulario: "Modulo",
  evento: "Evento",
  import: "Importato",
  webhook: "Webhook",
  otro: "Altro",
};

export const ACTIVITY_TYPE_CONFIG: Record<
  ActivityType,
  { label: string; icon: string }
> = {
  call: { label: "Chiamata", icon: "Phone" },
  email: { label: "Email", icon: "Mail" },
  meeting: { label: "Riunione", icon: "Users" },
  note: { label: "Nota", icon: "FileText" },
  follow_up: { label: "Follow-up", icon: "Clock" },
};

export type ActivityStatus = "completed" | "overdue" | "open";

export function getActivityStatus(activity: {
  completedAt: number | Date | null | undefined;
  startAt?: number | Date | null;
  scheduledAt?: number | Date | null;
}): ActivityStatus {
  if (activity.completedAt) return "completed";
  const dueRaw = activity.startAt ?? activity.scheduledAt;
  if (dueRaw) {
    const ms = dueRaw instanceof Date ? dueRaw.getTime() : dueRaw < 1e12 ? dueRaw * 1000 : dueRaw;
    if (ms < Date.now()) return "overdue";
  }
  return "open";
}

export const ACTIVITY_STATUS_STYLE: Record<
  ActivityStatus,
  { iconBg: string; iconColor: string; label: string }
> = {
  completed: { iconBg: "bg-green-100",  iconColor: "text-green-600",  label: "Completata" },
  overdue:   { iconBg: "bg-red-100",    iconColor: "text-red-600",    label: "Scaduta"    },
  open:      { iconBg: "bg-yellow-100", iconColor: "text-yellow-600", label: "Aperta"     },
};

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function cleanPhoneForWhatsApp(phone: string): string {
  // "+52 55 1234 5678" → "525512345678"
  return phone.replace(/[\s\-\(\)]/g, "").replace(/^\+/, "");
}

function toDate(date: Date | number): Date {
  if (date instanceof Date) return date;
  // If number is less than 1e12, it's in seconds; otherwise milliseconds
  return new Date(date < 1e12 ? date * 1000 : date);
}

export function formatDate(date: Date | number | null): string {
  if (!date) return "-";
  const d = toDate(date);
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatRelativeDate(date: Date | number): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Oggi";
  if (diffDays === 1) return "Ieri";
  if (diffDays < 7) return `${diffDays} giorni fa`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} settimane fa`;
  return formatDate(date);
}
