"use client";

import type { FlowNode } from "@/lib/workflows/types";

interface NodePropertiesPanelProps {
  node: FlowNode | null;
  onChange?: (node: FlowNode) => void;
}

export function NodePropertiesPanel({ node, onChange }: NodePropertiesPanelProps) {
  if (!node) {
    return (
      <aside className="w-64 border-l bg-card flex flex-col h-full">
        <div className="px-3 py-3 border-b">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proprietà</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">Seleziona un nodo per modificarne le proprietà</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 border-l bg-card flex flex-col h-full">
      <div className="px-3 py-3 border-b">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Proprietà</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <div className="rounded-md border bg-muted/50 px-2 py-1.5 text-xs capitalize">{node.type}</div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">ID</label>
          <div className="rounded-md border bg-muted/50 px-2 py-1.5 text-xs font-mono">{node.id}</div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Label</label>
          <input
            type="text"
            value={node.data.label}
            onChange={(e) =>
              onChange?.({
                ...node,
                data: { ...node.data, label: e.target.value },
              })
            }
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Config (JSON)</label>
          <textarea
            value={JSON.stringify(node.data.config, null, 2)}
            onChange={(e) => {
              try {
                const config = JSON.parse(e.target.value);
                onChange?.({
                  ...node,
                  data: { ...node.data, config },
                });
              } catch {
                // ignore invalid JSON while typing
              }
            }}
            rows={6}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs font-mono"
          />
        </div>
      </div>
    </aside>
  );
}
