"use client";

import { Zap, Play, GitBranch, Clock, Globe, type LucideIcon } from "lucide-react";
import {
  NODE_CATEGORY_LABELS,
  NODE_CATEGORY_COLORS,
  TRIGGER_NODE_TYPES,
  ACTION_NODE_TYPES,
  CONDITION_NODE_TYPES,
  DELAY_NODE_TYPES,
  TRIGGER_LABELS,
  ACTION_LABELS,
  CONDITION_LABELS,
  DELAY_LABELS,
} from "@/lib/workflows/types";
import type { NodeCategory } from "@/lib/workflows/types";

const CATEGORY_ICONS: Record<NodeCategory, LucideIcon> = {
  trigger: Zap,
  action: Play,
  condition: GitBranch,
  delay: Clock,
  integration: Globe,
};

const CATEGORY_ITEMS: Record<NodeCategory, { type: string; label: string }[]> = {
  trigger: TRIGGER_NODE_TYPES.map((t) => ({ type: t, label: TRIGGER_LABELS[t] })),
  action: ACTION_NODE_TYPES.map((t) => ({ type: t, label: ACTION_LABELS[t] })),
  condition: CONDITION_NODE_TYPES.map((t) => ({ type: t, label: CONDITION_LABELS[t] })),
  delay: DELAY_NODE_TYPES.map((t) => ({ type: t, label: DELAY_LABELS[t] })),
  integration: [],
};

export function NodeSidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="w-52 border-r bg-card flex flex-col h-full">
      <div className="px-3 py-3 border-b">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nodi</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {(Object.keys(NODE_CATEGORY_LABELS) as Array<NodeCategory>).map((cat) => {
          const items = CATEGORY_ITEMS[cat];
          if (items.length === 0) return null;
          const Icon = CATEGORY_ICONS[cat];
          return (
            <div key={cat}>
              <p className="px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {NODE_CATEGORY_LABELS[cat]}
              </p>
              <div className="space-y-1">
                {items.map((item) => (
                  <div
                    key={item.type}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-grab active:cursor-grabbing transition-colors"
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type)}
                  >
                    <span style={{ color: NODE_CATEGORY_COLORS[cat] }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
