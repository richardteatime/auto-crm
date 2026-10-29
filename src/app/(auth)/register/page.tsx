"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, CircleCheck, Loader2 } from "lucide-react";
import { AuthField, AuthLayout, authInputClass } from "@/components/auth/AuthLayout";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdFor, setCreatedFor] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Le password non corrispondono");
      return;
    }

    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || "Errore durante la registrazione");
        return;
      }

      // The first account is logged in straight away; a colleague's account is not
      if (data.isFirstUser) {
        router.push("/");
        router.refresh();
      } else {
        setCreatedFor(data.user?.name ?? name);
      }
    } catch {
      setError("Impossibile connettersi al server");
    } finally {
      setLoading(false);
    }
  }

  if (createdFor) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-start">
          <span className="flex size-11 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
            <CircleCheck className="size-5" />
          </span>
          <h1 className="mt-4 text-[28px] font-extrabold tracking-tight">Account creato</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {createdFor} può ora accedere con l&apos;email e la password che hai scelto. Passagliele in modo sicuro.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-card hover:brightness-110"
          >
            Torna al CRM
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-[28px] font-extrabold tracking-tight">Crea un account</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Funziona per il primo account del CRM, oppure da dentro il CRM per aggiungere un collega.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <AuthField id="name" label="Nome e cognome">
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={authInputClass}
            placeholder="Mario Rossi"
          />
        </AuthField>

        <AuthField id="email" label="Email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
            placeholder="nome@sarconx.com"
          />
        </AuthField>

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField id="password" label="Password">
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authInputClass}
              placeholder="Almeno 8 caratteri"
            />
          </AuthField>
          <AuthField id="confirmPassword" label="Conferma">
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={authInputClass}
              placeholder="Ripeti la password"
            />
          </AuthField>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[15px] font-semibold text-primary-foreground shadow-card transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {loading ? "Creazione in corso…" : "Crea account"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Hai già un account?{" "}
        <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          Accedi
        </Link>
      </p>
    </AuthLayout>
  );
}
