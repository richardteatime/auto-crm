import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Compass className="size-5" />
      </span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Errore 404</p>
      <h1 className="mt-1 text-xl font-bold tracking-tight">Questa pagina non esiste</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Forse il contatto o la trattativa sono stati eliminati, oppure il link è sbagliato. Prova a cercarlo con ⌘K.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-card hover:brightness-110"
      >
        Torna a Oggi
      </Link>
    </div>
  );
}
