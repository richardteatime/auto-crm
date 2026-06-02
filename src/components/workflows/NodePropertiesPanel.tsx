"use client";

import type { FlowNode } from "@/lib/workflows/types";
import { NODE_CATEGORY_LABELS } from "@/lib/workflows/types";
import {
  NODE_SUBTYPES,
  NODE_FIELDS,
  SUBTYPE_LABELS,
  type NodeField,
} from "@/lib/workflows/node-fields";

interface NodePropertiesPanelProps {
  node: FlowNode | null;
  onChange?: (node: FlowNode) => void;
  onDelete?: (nodeId: string) => void;
}

export function NodePropertiesPanel({ node, onChange, onDelete }: NodePropertiesPanelProps) {
  if (!node) {
    return (
      <aside className="w-72 border-l bg-card flex flex-col h-full">
        <div className="px-3 py-3 border-b">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proprietà</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">Seleziona un nodo nel canvas per configurarlo.</p>
        </div>
      </aside>
    );
  }

  const category = node.type; // trigger | action | condition | delay | integration
  const subtypeOptions = NODE_SUBTYPES[category] ?? [];
  const currentSubtype = node.data.nodeType;
  const isConfigured = subtypeOptions.some((o) => o.value === currentSubtype);
  const fields: NodeField[] = isConfigured ? NODE_FIELDS[currentSubtype] ?? [] : [];
  const config = (node.data.config ?? {}) as Record<string, unknown>;
  const categoryLabel = NODE_CATEGORY_LABELS[category as keyof typeof NODE_CATEGORY_LABELS] ?? category;

  const chooseSubtype = (subtype: string) => {
    onChange?.({
      ...node,
      data: { ...node.data, nodeType: subtype, label: SUBTYPE_LABELS[subtype] ?? node.data.label },
    });
  };

  const setConfig = (key: string, value: unknown) => {
    onChange?.({ ...node, data: { ...node.data, config: { ...config, [key]: value } } });
  };

  return (
    <aside className="w-72 border-l bg-card flex flex-col h-full">
      <div className="px-3 py-3 border-b">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proprietà</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{categoryLabel}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Selettore del tipo specifico */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Cosa fa questo nodo?</label>
          <select
            value={isConfigured ? currentSubtype : ""}
            onChange={(e) => chooseSubtype(e.target.value)}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          >
            <option value="" disabled>
              — Scegli —
            </option>
            {subtypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {!isConfigured && (
          <p className="rounded-md bg-muted/50 px-2 py-2 text-[11px] text-muted-foreground">
            Scegli dall&apos;elenco qui sopra cosa deve fare questo nodo: poi compaiono i campi da compilare.
          </p>
        )}

        {isConfigured && fields.length === 0 && (
          <p className="rounded-md bg-muted/50 px-2 py-2 text-[11px] text-muted-foreground">
            Questo nodo non richiede configurazione.
          </p>
        )}

        {/* Campi guidati per il sottotipo scelto */}
        {isConfigured &&
          fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  value={String(config[f.key] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) => setConfig(f.key, e.target.value)}
                  rows={3}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                />
              ) : f.type === "select" ? (
                <select
                  value={String(config[f.key] ?? "")}
                  onChange={(e) => setConfig(f.key, e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                >
                  {(f.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={String(config[f.key] ?? "")}
                  placeholder={f.placeholder}
                  onChange={(e) => setConfig(f.key, e.target.value)}
                  className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                />
              )}
              {f.hint && <p className="text-[10px] text-muted-foreground">{f.hint}</p>}
            </div>
          ))}

        {/* Aiuto specifico per le condizioni */}
        {category === "condition" && isConfigured && (
          <p className="rounded-md border border-dashed px-2 py-2 text-[11px] text-muted-foreground">
            Collega l&apos;uscita <span className="font-semibold text-green-600">Sì</span> al passo da eseguire se la
            condizione è vera, e <span className="font-semibold text-red-500">No</span> all&apos;alternativa.
          </p>
        )}

        {/* Suggerimento variabili */}
        {isConfigured && fields.length > 0 && category !== "condition" && (
          <p className="text-[10px] text-muted-foreground">
            Suggerimento: scrivi <code className="rounded bg-muted px-1">{"{{trigger.payload.campo}}"}</code> per
            inserire automaticamente i dati che hanno avviato il workflow.
          </p>
        )}

        {/* Avanzato: etichetta + JSON grezzo per i power user */}
        <details className="rounded-md border bg-muted/20 p-2">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">Avanzato</summary>
          <div className="mt-2 space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Etichetta nodo</label>
              <input
                type="text"
                value={node.data.label}
                onChange={(e) => onChange?.({ ...node, data: { ...node.data, label: e.target.value } })}
                className="w-full rounded-md border bg-background px-2 py-1 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Config (JSON)</label>
              <textarea
                value={JSON.stringify(config, null, 2)}
                onChange={(e) => {
                  try {
                    onChange?.({ ...node, data: { ...node.data, config: JSON.parse(e.target.value) } });
                  } catch {
                    // JSON non valido durante la digitazione: ignora
                  }
                }}
                rows={5}
                className="w-full rounded-md border bg-background px-2 py-1 text-[11px] font-mono"
              />
            </div>
          </div>
        </details>

        {onDelete && (
          <button
            onClick={() => onDelete(node.id)}
            className="w-full rounded-md border border-red-200 bg-red-50 px-2 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
          >
            Elimina questo nodo
          </button>
        )}
      </div>
    </aside>
  );
}
