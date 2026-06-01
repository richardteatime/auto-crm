"use client";

// Property editor for a single form field. Parent passes the selected field and
// receives the updated field back.

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import {
  CRM_FIELD_LABELS,
  FORM_FIELD_LABELS,
} from "@/lib/capture/types";
import type { FormField, CrmFieldKey } from "@/lib/capture/types";

const CRM_KEYS = Object.keys(CRM_FIELD_LABELS) as CrmFieldKey[];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const hasOptions = (t: FormField["type"]) => t === "select" || t === "radio";
const hasPlaceholder = (t: FormField["type"]) => t !== "checkbox" && t !== "radio" && t !== "date";

export function FormFieldEditor({
  field,
  onChange,
}: {
  field: FormField;
  onChange: (next: FormField) => void;
}) {
  const setOption = (i: number, v: string) =>
    onChange({ ...field, options: field.options.map((o, idx) => (idx === i ? v : o)) });

  return (
    <div className="space-y-3">
      <div className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
        Tipo: <span className="font-medium text-foreground">{FORM_FIELD_LABELS[field.type]}</span>
      </div>

      <Field label="Etichetta">
        <Input value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} />
      </Field>

      {hasPlaceholder(field.type) && (
        <Field label="Placeholder">
          <Input value={field.placeholder} onChange={(e) => onChange({ ...field, placeholder: e.target.value })} />
        </Field>
      )}

      <Field label="Mappatura CRM">
        <Select
          value={field.crmField}
          onValueChange={(v) => v && onChange({ ...field, crmField: v as CrmFieldKey })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRM_KEYS.map((k) => (
              <SelectItem key={k} value={k}>{CRM_FIELD_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={field.validation.required}
          onChange={(e) => onChange({ ...field, validation: { ...field.validation, required: e.target.checked } })}
        />
        Campo obbligatorio
      </label>

      {field.type === "number" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Minimo">
            <Input
              type="number"
              value={field.validation.min ?? ""}
              onChange={(e) => onChange({ ...field, validation: { ...field.validation, min: e.target.value === "" ? null : Number(e.target.value) } })}
            />
          </Field>
          <Field label="Massimo">
            <Input
              type="number"
              value={field.validation.max ?? ""}
              onChange={(e) => onChange({ ...field, validation: { ...field.validation, max: e.target.value === "" ? null : Number(e.target.value) } })}
            />
          </Field>
        </div>
      )}

      {hasOptions(field.type) && (
        <Field label="Opzioni">
          <div className="space-y-2">
            {field.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input value={opt} onChange={(e) => setOption(i, e.target.value)} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                  onClick={() => onChange({ ...field, options: field.options.filter((_, idx) => idx !== i) })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full cursor-pointer"
              onClick={() => onChange({ ...field, options: [...field.options, `Opzione ${field.options.length + 1}`] })}
            >
              <Plus className="h-4 w-4 mr-1" /> Aggiungi opzione
            </Button>
          </div>
        </Field>
      )}
    </div>
  );
}
