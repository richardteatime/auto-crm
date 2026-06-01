"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Play, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { newFunnelStep, parseFunnelSteps } from "@/lib/capture/funnels";
import type { Funnel, FunnelCondition, FunnelEvent, FunnelStatus, FunnelStep, LandingPage } from "@/lib/capture/types";

const STATUS_LABELS = { draft: "Bozza", active: "Attivo", archived: "Archiviato" };

export function FunnelEditor({ funnel, landingPages, events }: { funnel: Funnel; landingPages: LandingPage[]; events: FunnelEvent[] }) {
  const router = useRouter();
  const [name, setName] = useState(funnel.name);
  const [status, setStatus] = useState<FunnelStatus>(funnel.status);
  const [steps, setSteps] = useState(() => parseFunnelSteps(funnel.steps));
  const [thankYouPageId, setThankYouPageId] = useState(funnel.thankYouPageId ?? "");
  const [origin, setOrigin] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const metrics = (stepId: string) => {
    const views = events.filter((event) => event.stepId === stepId && event.eventType === "step_view").length;
    const submits = events.filter((event) => event.stepId === stepId && event.eventType === "step_submit").length;
    return { views, submits, dropOff: views > 0 ? Math.max(0, Math.round((1 - submits / views) * 100)) : 0 };
  };

  const touch = () => setDirty(true);
  const setStep = (id: string, patch: Partial<FunnelStep>) => {
    setSteps((prev) => prev.map((step) => step.id === id ? { ...step, ...patch } : step));
    touch();
  };
  const add = () => {
    const step = newFunnelStep(landingPages[0]?.id ?? "");
    setSteps((prev) => [...prev, step]);
    touch();
  };
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next);
    touch();
  };
  const remove = (id: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== id).map((step) => ({
      ...step,
      nextStepId: step.nextStepId === id ? null : step.nextStepId,
    })));
    touch();
  };
  const setCondition = (id: string, patch: Partial<FunnelCondition>) => {
    const step = steps.find((item) => item.id === id);
    if (!step) return;
    const current = step.conditions[0] ?? {
      field: "email", operator: "exists", value: null, trueNextStepId: null, falseNextStepId: null,
    };
    setStep(id, { conditions: [{ ...current, ...patch }] });
  };

  const persist = async (nextStatus?: FunnelStatus) => {
    if (steps.some((step) => !step.landingPageId)) {
      toast.error("Ogni step deve avere una landing page");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/funnels/${funnel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, steps: JSON.stringify(steps), thankYouPageId, ...(nextStatus ? { status: nextStatus } : {}) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Errore");
      if (nextStatus) setStatus(nextStatus);
      setDirty(false);
      toast.success(nextStatus === "active" ? "Funnel attivato" : "Modifiche salvate");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Errore");
    } finally {
      setSaving(false);
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => router.push("/funnels")}><ArrowLeft className="h-4 w-4" /></Button>
      <div className="flex-1"><h1 className="font-semibold">{name}</h1><p className="text-xs text-muted-foreground">{steps.length} step Â· {STATUS_LABELS[status]}</p></div>
      {status === "active" && <a href={`${origin}/f/${funnel.slug}`} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm"><ExternalLink className="mr-1 h-4 w-4" />Apri</Button></a>}
      <Button variant="outline" size="sm" disabled={!dirty || saving} onClick={() => persist()}><Save className="mr-1 h-4 w-4" />Salva</Button>
      <Button size="sm" disabled={saving} onClick={() => persist(status === "active" ? "draft" : "active")}><Play className="mr-1 h-4 w-4" />{status === "active" ? "Metti in bozza" : "Attiva"}</Button>
    </div>

    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        {steps.map((step, index) => {
          const stepMetrics = metrics(step.id);
          return <div key={step.id} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{index + 1}</span>
            <Input value={step.name} onChange={(e) => setStep(step.id, { name: e.target.value })} />
            <Button variant="ghost" size="icon" onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => remove(step.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Landing page
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={step.landingPageId} onChange={(e) => setStep(step.id, { landingPageId: e.target.value })}>
                <option value="">Seleziona</option>{landingPages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Step successivo
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={step.nextStepId ?? ""} onChange={(e) => setStep(step.id, { nextStepId: e.target.value || null })}>
                <option value="">Fine funnel</option>{steps.filter((item) => item.id !== step.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>Visite: {stepMetrics.views}</span>
            <span>Submit: {stepMetrics.submits}</span>
            <span>Drop-off: {stepMetrics.dropOff}%</span>
          </div>
          <details className="rounded-md bg-muted/40 p-3">
            <summary className="cursor-pointer text-xs font-semibold">Condizione opzionale</summary>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <Input placeholder="Campo, es. email" value={step.conditions[0]?.field ?? ""} onChange={(e) => setCondition(step.id, { field: e.target.value })} />
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={step.conditions[0]?.operator ?? "exists"} onChange={(e) => setCondition(step.id, { operator: e.target.value as FunnelCondition["operator"] })}><option value="exists">Esiste</option><option value="equals">Uguale a</option></select>
              <Input placeholder="Valore" value={step.conditions[0]?.value ?? ""} onChange={(e) => setCondition(step.id, { value: e.target.value || null })} />
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={step.conditions[0]?.trueNextStepId ?? ""} onChange={(e) => setCondition(step.id, { trueNextStepId: e.target.value || null })}><option value="">Default se vero</option>{steps.filter((item) => item.id !== step.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={step.conditions[0]?.falseNextStepId ?? ""} onChange={(e) => setCondition(step.id, { falseNextStepId: e.target.value || null })}><option value="">Default se falso</option>{steps.filter((item) => item.id !== step.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <Button variant="outline" onClick={() => setStep(step.id, { conditions: [] })}>Rimuovi condizione</Button>
            </div>
          </details>
        </div>;
        })}
        <Button variant="outline" className={cn("w-full", steps.length === 0 && "border-dashed")} onClick={add}><Plus className="mr-2 h-4 w-4" />Aggiungi step</Button>
      </div>
      <aside className="space-y-3 rounded-lg border p-4">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Nome<Input value={name} onChange={(e) => { setName(e.target.value); touch(); }} /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">Thank-you landing
          <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={thankYouPageId} onChange={(e) => { setThankYouPageId(e.target.value); touch(); }}>
            <option value="">Pagina conferma standard</option>{landingPages.map((page) => <option key={page.id} value={page.id}>{page.name}</option>)}
          </select>
        </label>
        <div className="text-xs text-muted-foreground"><p>Visite: {funnel.views}</p><p>Conversioni: {funnel.conversions}</p></div>
      </aside>
    </div>
  </div>;
}
