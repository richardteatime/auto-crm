"use client";

import { useState } from "react";

export interface PublicLeadField {
  key: "name" | "email" | "phone" | "company" | "website" | "message";
  label: string;
  type: "text" | "email" | "tel" | "textarea";
  required: boolean;
}

const DEFAULT_FIELDS: PublicLeadField[] = [
  { key: "name", label: "Nome", type: "text", required: true },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Telefono", type: "tel", required: false },
  { key: "message", label: "Messaggio", type: "textarea", required: false },
];

export interface PublicLeadFormProps {
  landingPageId?: string | null;
  formId?: string | null;
  funnelId?: string | null;
  bookingLinkId?: string | null;
  sessionId?: string | null;
  source?: string | null;
  buttonText?: string;
  successMessage?: string;
  primaryColor?: string;
  fields?: PublicLeadField[];
  submitUrl?: string;
  onSuccess?: () => void;
}

export function PublicLeadForm({
  landingPageId = null,
  formId = null,
  funnelId = null,
  bookingLinkId = null,
  sessionId = null,
  source = null,
  buttonText = "Invia",
  successMessage = "Grazie! Ti ricontatteremo presto.",
  primaryColor = "#2563eb",
  fields = DEFAULT_FIELDS,
  submitUrl = "/api/public/leads",
  onSuccess,
}: PublicLeadFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setError(`Il campo "${f.label}" è obbligatorio.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          source,
          landingPageId,
          formId,
          funnelId,
          bookingLinkId,
          sessionId,
          data: values,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || "Errore durante l'invio.");
      }
      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setDone(true);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'invio.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        className="rounded-lg border p-6 text-center"
        style={{ borderColor: `${primaryColor}40`, background: `${primaryColor}0d` }}
      >
        <p className="text-base font-medium">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1 text-left">
          <label className="block text-sm font-medium">
            {f.label}
            {f.required && <span style={{ color: primaryColor }}> *</span>}
          </label>
          {f.type === "textarea" ? (
            <textarea
              value={values[f.key] ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ ["--tw-ring-color" as string]: primaryColor }}
            />
          ) : (
            <input
              type={f.type}
              value={values[f.key] ?? ""}
              onChange={(e) => update(f.key, e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2"
              style={{ ["--tw-ring-color" as string]: primaryColor }}
            />
          )}
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
        style={{ background: primaryColor }}
      >
        {submitting ? "Invio…" : buttonText}
      </button>
    </form>
  );
}
