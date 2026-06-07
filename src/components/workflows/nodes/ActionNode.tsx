"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
import type { FlowNodeData } from "@/lib/workflows/types";
import { NODE_CATEGORY_COLORS } from "@/lib/workflows/types";

export function ActionNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  return (
    <div
      className="rounded-lg border-2 bg-card px-4 py-2 shadow-sm min-w-[140px] text-card-foreground"
      style={{
        borderColor: NODE_CATEGORY_COLORS.action,
        boxShadow: selected ? `0 0 0 2px ${NODE_CATEGORY_COLORS.action}` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500" />
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4" style={{ color: NODE_CATEGORY_COLORS.action }} />
        <span className="text-xs font-semibold">{data.label || "Azione"}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />
    </div>
  );
}
