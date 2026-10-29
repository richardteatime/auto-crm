"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-300">
        <TriangleAlert className="size-5" />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight">Qualcosa non è andato</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Non sono riuscito a caricare questa pagina. Di solito basta riprovare; se continua, il database potrebbe essere
        momentaneamente irraggiungibile.
      </p>
      {error.digest && <p className="mt-2 font-mono text-[11px] text-muted-foreground">Codice: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset} className="gap-1.5">
          <RotateCcw className="size-4" />
          Riprova
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Torna a Oggi
        </Button>
      </div>
    </div>
  );
}
