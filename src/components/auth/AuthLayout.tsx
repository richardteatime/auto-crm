import { CircleCheck } from "lucide-react";
import { BrandMark } from "@/components/layout/BrandMark";
import { LoginBackdrop } from "./LoginBackdrop";

const HIGHLIGHTS = [
  "La giornata in una schermata: priorità, agenda e trattative da seguire",
  "Pipeline a trascinamento, preventivi in PDF e finanza sempre aggiornata",
  "Cerca qualsiasi cosa con ⌘K, da computer e da telefono",
];

/** Split-screen frame for login and sign-up */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="relative hidden w-[46%] max-w-[720px] overflow-hidden bg-[#07101f] text-white lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60rem 36rem at 10% 0%, rgba(20,103,214,0.55), transparent 60%), radial-gradient(40rem 30rem at 100% 100%, rgba(124,58,237,0.28), transparent 60%)",
          }}
        />
        <LoginBackdrop className="absolute inset-0 size-full" />
        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-9" />
            <span className="text-lg font-extrabold tracking-tight">
              Sarcon<span className="text-[#7cc4ff]">X</span>
              <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">CRM</span>
            </span>
          </div>

          <div className="max-w-md">
            <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight xl:text-5xl">
              Ogni cliente,
              <br />
              <span className="bg-gradient-to-r from-white to-[#7cc4ff] bg-clip-text text-transparent">
                al momento giusto.
              </span>
            </h2>
            <ul className="mt-8 space-y-3.5">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start gap-3 text-[15px] text-white/80">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-[#7cc4ff]" />
                  {h}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/45">© {new Date().getFullYear()} SarconX · Pavia</p>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[380px] animate-fade-up">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark className="size-9" />
            <span className="text-lg font-extrabold tracking-tight">
              Sarcon<span className="text-primary">X</span>
              <span className="ml-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">CRM</span>
            </span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

/** Labelled input that matches the auth screens */
export function AuthField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}

export const authInputClass =
  "flex h-11 w-full rounded-lg border border-input bg-card px-3.5 text-[15px] shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 aria-invalid:border-destructive";
