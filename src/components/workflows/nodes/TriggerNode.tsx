"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import type { FlowNodeData } from "@/lib/workflows/types";
import { NODE_CATEGORY_COLORS } from "@/lib/workflows/types";

export function TriggerNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  return (
    <div
      className="rounded-lg border-2 bg-white px-4 py-2 shadow-sm min-w-[140px]"
      style={{
        borderColor: NODE_CATEGORY_COLORS.trigger,
        boxShadow: selected ? `0 0 0 2px ${NODE_CATEGORY_COLORS.trigger}` : undefined,
      }}
    >
      <Handle type="source" position={Position.Bottom} className="!bg-green-500" />
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4" style={{ color: NODE_CATEGORY_COLORS.trigger }} />
        <span className="text-xs font-semibold">{data.label || "Trigger"}</span>
      </div>
    </div>
  );
}
