"use client";

import { useEffect, useState } from "react";
import { PublicFormRenderer } from "@/components/capture/PublicFormRenderer";
import { PublicLeadForm } from "@/components/capture/PublicLeadForm";
import { defaultFormStyle } from "@/lib/capture/defaults";
import type { FormField, FormStyle } from "@/lib/capture/types";

export function LandingEmbeddedForm({
  formId,
  landingPageId,
  funnelId,
  sessionId,
  submitUrl,
  primaryColor,
}: {
  formId: string;
  landingPageId: string;
  funnelId: string | null;
  sessionId: string | null;
  submitUrl?: string;
  primaryColor: string;
}) {
  const [config, setConfig] = useState<{
    fields: FormField[];
    style: FormStyle;
    successMessage: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/public/forms/${encodeURIComponent(formId)}`)
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        setConfig({
          fields: JSON.parse(data.fields) as FormField[],
          style: { ...defaultFormStyle(), ...(JSON.parse(data.style) as Partial<FormStyle>) },
          successMessage: data.successMessage,
        });
      })
      .catch(() => setFailed(true));
  }, [formId]);

  if (failed) {
    return (
      <PublicLeadForm
        landingPageId={landingPageId}
        formId={formId}
        funnelId={funnelId}
        sessionId={sessionId}
        source={funnelId ? "funnel" : "landing"}
        primaryColor={primaryColor}
        submitUrl={submitUrl}
      />
    );
  }
  if (!config) return <div className="h-40 animate-pulse rounded-lg bg-gray-100" />;
  return (
    <PublicFormRenderer
      formId={formId}
      fields={config.fields}
      style={config.style}
      successMessage={config.successMessage}
      landingPageId={landingPageId}
      funnelId={funnelId}
      sessionId={sessionId}
      submitUrl={submitUrl}
    />
  );
}
