"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import type { FlowNodeData } from "@/lib/workflows/types";
import { NODE_CATEGORY_COLORS } from "@/lib/workflows/types";

// Rectangular, Make-style condition card with two clearly labelled outputs:
// green "Sì" (true) on the left, red "No" (false) on the right.
export function ConditionNode({ data, selected }: NodeProps & { data: FlowNodeData }) {
  return (
    <div
      className="relative min-w-[170px] rounded-lg border-2 bg-white px-4 pt-2 pb-6 shadow-sm"
      style={{
        borderColor: NODE_CATEGORY_COLORS.condition,
        boxShadow: selected ? `0 0 0 2px ${NODE_CATEGORY_COLORS.condition}` : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-yellow-500" />

      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 shrink-0" style={{ color: NODE_CATEGORY_COLORS.condition }} />
        <span className="text-xs font-semibold">{data.label || "Condizione"}</span>
      </div>

      {/* Output: Sì (true) */}
      <span className="pointer-events-none absolute bottom-1.5 left-[24%] -translate-x-1/2 text-[9px] font-bold text-green-600">
        Sì
      </span>
      <Handle type="source" position={Position.Bottom} id="true" className="!bg-green-500" style={{ left: "24%" }} />

      {/* Output: No (false) */}
      <span className="pointer-events-none absolute bottom-1.5 left-[76%] -translate-x-1/2 text-[9px] font-bold text-red-500">
        No
      </span>
      <Handle type="source" position={Position.Bottom} id="false" className="!bg-red-500" style={{ left: "76%" }} />
    </div>
  );
}
