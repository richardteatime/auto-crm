"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <h2 className="mb-2 text-xl font-bold text-gray-900">
        Errore nel caricamento della sezione Finance
      </h2>
      <p className="mb-6 text-gray-600">
        Si è verificato un errore imprevisto. Riprova o torna indietro.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Riprova
      </button>
    </div>
  );
}
