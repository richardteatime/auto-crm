"use client";

import { Zap, Play, GitBranch, Clock } from "lucide-react";
import { NODE_CATEGORY_LABELS, NODE_CATEGORY_COLORS } from "@/lib/workflows/types";

interface SidebarItem {
  type: string;
  label: string;
  category: "trigger" | "action" | "condition" | "delay";
}

const ITEMS: SidebarItem[] = [
  { type: "trigger", label: "Trigger", category: "trigger" },
  { type: "action", label: "Azione", category: "action" },
  { type: "condition", label: "Condizione", category: "condition" },
  { type: "delay", label: "Attesa", category: "delay" },
];

const ICONS: Record<string, React.ReactNode> = {
  trigger: <Zap className="h-4 w-4" />,
  action: <Play className="h-4 w-4" />,
  condition: <GitBranch className="h-4 w-4" />,
  delay: <Clock className="h-4 w-4" />,
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
        {(Object.keys(NODE_CATEGORY_LABELS) as Array<keyof typeof NODE_CATEGORY_LABELS>).map((cat) => (
          <div key={cat}>
            <p className="px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              {NODE_CATEGORY_LABELS[cat]}
            </p>
            <div className="space-y-1">
              {ITEMS.filter((i) => i.category === cat).map((item) => (
                <div
                  key={item.type}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium bg-muted/50 hover:bg-muted cursor-grab active:cursor-grabbing transition-colors"
                  draggable
                  onDragStart={(e) => onDragStart(e, item.type)}
                >
                  <span style={{ color: NODE_CATEGORY_COLORS[cat] }}>{ICONS[item.type]}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
