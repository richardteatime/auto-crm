"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/components/shared/CurrentUserContext";

const MIN_LENGTH = 8;

type Field = "currentPassword" | "newPassword" | "confirmPassword";
type Values = Record<Field, string>;

const EMPTY: Values = { currentPassword: "", newPassword: "", confirmPassword: "" };

const FIELDS: { id: Field; label: string; autoComplete: string; hint?: string }[] = [
  { id: "currentPassword", label: "Password attuale", autoComplete: "current-password" },
  { id: "newPassword", label: "Nuova password", autoComplete: "new-password", hint: `Almeno ${MIN_LENGTH} caratteri` },
  { id: "confirmPassword", label: "Ripeti la nuova password", autoComplete: "new-password" },
];

function validate(values: Values): Partial<Values> {
  const errors: Partial<Values> = {};
  if (!values.currentPassword) errors.currentPassword = "Inserisci la password attuale";
  if (values.newPassword.length < MIN_LENGTH) {
    errors.newPassword = `Almeno ${MIN_LENGTH} caratteri`;
  } else if (values.newPassword === values.currentPassword) {
    errors.newPassword = "Deve essere diversa da quella attuale";
  }
  if (!errors.newPassword && values.confirmPassword !== values.newPassword) {
    errors.confirmPassword = "Le due password non coincidono";
  }
  return errors;
}

export function ChangePasswordCard() {
  const user = useCurrentUser();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Values>>({});
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const onChange = (field: Field) => (e: ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((errs) => ({ ...errs, [field]: undefined }));
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const message = data.error || "Non è stato possibile cambiare la password";
        if (data.field) setErrors({ [data.field]: message });
        else toast.error(message);
        return;
      }
      setValues(EMPTY);
      setShow(false);
      toast.success("Password cambiata", {
        description: "Dal prossimo accesso usa quella nuova.",
      });
    } catch {
      toast.error("Impossibile connettersi al server");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Password
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cambia la password con cui entri nel CRM
          {user?.email ? (
            <>
              {" "}come <span className="font-medium text-foreground">{user.email}</span>
            </>
          ) : null}
          .
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Lets the browser's password manager pair the new password with this account */}
          <input type="email" name="username" autoComplete="username" value={user?.email ?? ""} readOnly hidden />

          <div className="grid gap-4 sm:grid-cols-3">
            {FIELDS.map((field) => {
              const error = errors[field.id];
              const note = error ?? field.hint;
              return (
                <div key={field.id} className="space-y-1.5">
                  <Label htmlFor={field.id}>{field.label}</Label>
                  <Input
                    id={field.id}
                    name={field.id}
                    type={show ? "text" : "password"}
                    autoComplete={field.autoComplete}
                    value={values[field.id]}
                    onChange={onChange(field.id)}
                    aria-invalid={!!error || undefined}
                    aria-describedby={note ? `${field.id}-note` : undefined}
                    className="h-11"
                  />
                  {note && (
                    <p
                      id={`${field.id}-note`}
                      className={error ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}
                    >
                      {note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              {show ? "Nascondi password" : "Mostra password"}
            </button>
            <Button type="submit" disabled={saving} className="h-11 w-full px-5 sm:w-auto sm:min-w-40">
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvataggio…
                </>
              ) : (
                "Cambia password"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
