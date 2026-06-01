"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import type { FlowNodeData } from "@/lib/workflows/types";
import { NODE_CATEGORY_COLORS } from "@/lib/workflows/types";

export function DelayNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  return (
    <div
      className="rounded-lg border-2 bg-white px-4 py-2 shadow-sm min-w-[140px]"
      style={{
        borderColor: NODE_CATEGORY_COLORS.delay,
        boxShadow: selected ? `0 0 0 2px ${NODE_CATEGORY_COLORS.delay}` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" style={{ color: NODE_CATEGORY_COLORS.delay }} />
        <span className="text-xs font-semibold">{data.label || "Attesa"}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500" />
    </div>
  );
}
