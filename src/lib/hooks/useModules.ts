"use client";

import { useState, useEffect, useCallback } from "react";
import type { ModuleId } from "@/lib/modules";

interface UseModulesResult {
  enabled: ModuleId[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useModules(): UseModulesResult {
  const [enabled, setEnabled] = useState<ModuleId[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/modules");
      if (!res.ok) throw new Error("Errore nel caricamento moduli");
      const data = (await res.json()) as { enabled: ModuleId[] };
      setEnabled(data.enabled ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  return { enabled, loading, error, refresh: fetchModules };
}
