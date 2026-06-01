"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import type { FlowNodeData } from "@/lib/workflows/types";
import { NODE_CATEGORY_COLORS } from "@/lib/workflows/types";

export function ConditionNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  return (
    <div
      className="rounded-lg border-2 bg-white px-4 py-2 shadow-sm min-w-[140px] rotate-0"
      style={{
        borderColor: NODE_CATEGORY_COLORS.condition,
        boxShadow: selected ? `0 0 0 2px ${NODE_CATEGORY_COLORS.condition}` : undefined,
        clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        minHeight: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-500" />
      <div className="flex flex-col items-center gap-1">
        <GitBranch className="h-4 w-4" style={{ color: NODE_CATEGORY_COLORS.condition }} />
        <span className="text-[10px] font-semibold text-center leading-tight">{data.label || "Condizione"}</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" className="!bg-yellow-500" style={{ left: "30%" }} />
      <Handle type="source" position={Position.Bottom} id="false" className="!bg-yellow-500" style={{ left: "70%" }} />
    </div>
  );
}
