"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useModules } from "@/lib/hooks/useModules";
import { OPTIONAL_MODULES, isModuleEnabled, type ModuleId } from "@/lib/modules";

export default function AdminPage() {
  const { enabled, refresh } = useModules();
  const [localEnabled, setLocalEnabled] = useState<ModuleId[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (enabled) setLocalEnabled(enabled);
  }, [enabled]);

  async function toggleModule(id: ModuleId) {
    const next = localEnabled.includes(id)
      ? localEnabled.filter((m) => m !== id)
      : [...localEnabled, id];
    setLocalEnabled(next);

    setSaving(true);
    try {
      const res = await fetch("/api/modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Errore");
      toast.success("Modulo aggiornato");
      refresh();
    } catch {
      toast.error("Errore nell'aggiornamento del modulo");
      setLocalEnabled(enabled ?? []);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Torna alla dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground">
            Configura i moduli disponibili per questo cliente
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Moduli opzionali
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Attiva o disattiva i moduli opzionali. I moduli disattivati restituiranno 404 — il cliente non saprà nemmeno che esistono.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {OPTIONAL_MODULES.map((mod) => {
              const active = isModuleEnabled(localEnabled, mod.id);
              return (
                <div
                  key={mod.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    active ? "border-primary/30 bg-primary/5" : "bg-muted/30"
                  }`}
                >
                  <input
                    id={`module-${mod.id}`}
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleModule(mod.id)}
                    disabled={saving}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={`module-${mod.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {mod.label}
                      </label>
                      {active ? (
                        <Badge variant="default" className="text-[10px]">
                          Attivo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Disattivato
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {mod.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                      Pagine: {mod.pages.join(", ") || "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
