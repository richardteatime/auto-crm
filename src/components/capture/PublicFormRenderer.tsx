"use client";

// Public, embeddable form renderer. Theme-independent (inline styles, no app UI
// kit) so it looks identical whether hosted at /form/[id] or embedded on a
// customer site. Values are keyed by field id; the server maps them to CRM
// fields and runs authoritative validation.

import { useRef, useState } from "react";
import type { FormField, FormStyle } from "@/lib/capture/types";
import { sendPublicAnalytics } from "@/components/capture/PublicAnalyticsTracker";

interface Props {
  formId: string;
  fields: FormField[];
  style: FormStyle;
  successMessage: string;
  landingPageId?: string | null;
  funnelId?: string | null;
  sessionId?: string | null;
  submitUrl?: string;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === false || (typeof v === "string" && !v.trim());
}

export function PublicFormRenderer({
  formId,
  fields,
  style,
  successMessage,
  landingPageId,
  funnelId,
  sessionId,
  submitUrl,
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const dark = style.theme === "dark";
  const radius = style.borderRadius;
  const setValue = (id: string, v: unknown) => {
    if (!started.current) {
      started.current = true;
      sendPublicAnalytics("form_start", "form", formId, sessionId);
    }
    setValues((prev) => ({ ...prev, [id]: v }));
  };

  const fieldStyle: React.CSSProperties = {
    borderRadius: radius,
    background: dark ? "#1e293b" : "#ffffff",
    borderColor: dark ? "#334155" : "#d1d5db",
    color: dark ? "#f1f5f9" : "#0f172a",
  };
  const labelStyle: React.CSSProperties = { color: dark ? "#cbd5e1" : "#334155" };
  const inputClass =
    "w-full border px-3 py-2 text-sm outline-none focus:ring-2 transition-shadow";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    for (const f of fields) {
      if (f.validation?.required && isEmpty(values[f.id])) {
        setError(`Campo obbligatorio: ${f.label}`);
        sendPublicAnalytics("form_field_error", "form", formId, sessionId);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(submitUrl ?? `/api/public/forms/${formId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, landingPageId, funnelId, sessionId, formId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Errore");
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'invio.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div
        className="rounded-xl border p-6 text-center text-sm"
        style={{ ...fieldStyle, borderRadius: Math.max(radius, 12) }}
      >
        {successMessage}
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4"
      style={{ ["--tw-ring-color" as string]: style.primaryColor }}
    >
      {fields.map((f) => (
        <div key={f.id} className="space-y-1.5">
          {f.type !== "checkbox" && (
            <label className="block text-sm font-medium" style={labelStyle}>
              {f.label}
              {f.validation?.required && <span style={{ color: style.primaryColor }}> *</span>}
            </label>
          )}

          {(f.type === "text" || f.type === "email" || f.type === "phone" || f.type === "number" || f.type === "date") && (
            <input
              type={f.type === "phone" ? "tel" : f.type}
              className={inputClass}
              style={fieldStyle}
              placeholder={f.placeholder}
              value={(values[f.id] as string) ?? ""}
              onChange={(e) => setValue(f.id, e.target.value)}
            />
          )}

          {f.type === "textarea" && (
            <textarea
              className={inputClass}
              style={fieldStyle}
              rows={4}
              placeholder={f.placeholder}
              value={(values[f.id] as string) ?? ""}
              onChange={(e) => setValue(f.id, e.target.value)}
            />
          )}

          {f.type === "select" && (
            <select
              className={inputClass}
              style={fieldStyle}
              value={(values[f.id] as string) ?? ""}
              onChange={(e) => setValue(f.id, e.target.value)}
            >
              <option value="">{f.placeholder || "Seleziona..."}</option>
              {f.options.map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {f.type === "radio" && (
            <div className="space-y-1.5">
              {f.options.map((opt, i) => (
                <label key={i} className="flex items-center gap-2 text-sm" style={labelStyle}>
                  <input
                    type="radio"
                    name={f.id}
                    value={opt}
                    checked={values[f.id] === opt}
                    onChange={() => setValue(f.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {f.type === "checkbox" && (
            <label className="flex items-center gap-2 text-sm" style={labelStyle}>
              <input
                type="checkbox"
                checked={Boolean(values[f.id])}
                onChange={(e) => setValue(f.id, e.target.checked)}
              />
              {f.label}
              {f.validation?.required && <span style={{ color: style.primaryColor }}> *</span>}
            </label>
          )}
        </div>
      ))}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
        style={{ background: style.primaryColor, borderRadius: radius }}
      >
        {submitting ? "Invio…" : "Invia"}
      </button>
    </form>
  );
}
