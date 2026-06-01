"use client";

import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TriggerNode } from "./nodes/TriggerNode";
import { ActionNode } from "./nodes/ActionNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { DelayNode } from "./nodes/DelayNode";
import type { FlowNode, FlowEdge } from "@/lib/workflows/types";
import { getNodeCategory, NODE_TYPE_LABELS } from "@/lib/workflows/types";

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
};

interface WorkflowCanvasProps {
  initialNodes?: FlowNode[];
  initialEdges?: FlowEdge[];
  onChange?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onNodeSelect?: (node: FlowNode | null) => void;
  readOnly?: boolean;
}

export function WorkflowCanvas({ initialNodes = [], initialEdges = [], onChange, onNodeSelect, readOnly }: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChangeRaw] = useNodesState(initialNodes as unknown as Node[]);
  const [edges, setEdges, onEdgesChangeRaw] = useEdgesState(initialEdges as unknown as Edge[]);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChangeRaw>[0]) => {
      onNodesChangeRaw(changes);
      setTimeout(() => onChange?.(nodes as unknown as FlowNode[], edges as unknown as FlowEdge[]), 0);
    },
    [onNodesChangeRaw, onChange, nodes, edges],
  );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeRaw>[0]) => {
      onEdgesChangeRaw(changes);
      setTimeout(() => onChange?.(nodes as unknown as FlowNode[], edges as unknown as FlowEdge[]), 0);
    },
    [onEdgesChangeRaw, onChange, nodes, edges],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const sourceNode = (nodes as unknown as FlowNode[]).find((n) => n.id === params.source);
        const isCondition = sourceNode?.type === "condition";
        const label = isCondition ? (params.sourceHandle || undefined) : undefined;
        const newEdges = addEdge({ ...params, label } as Connection, eds);
        setTimeout(() => onChange?.(nodes as unknown as FlowNode[], newEdges as unknown as FlowEdge[]), 0);
        return newEdges;
      });
    },
    [setEdges, onChange, nodes],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow");
      if (!type || !reactFlowInstance.current || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const category = getNodeCategory(type);
      if (!category) return;
      const newNode: FlowNode = {
        id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: category,
        position,
        data: { nodeType: type, label: NODE_TYPE_LABELS[type] ?? type, config: {} },
      };

      setNodes((nds) => [...nds, newNode as unknown as Node]);
    },
    [setNodes],
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeSelect?.(node as unknown as FlowNode);
    },
    [onNodeSelect],
  );

  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDrop={readOnly ? undefined : onDrop}
        onDragOver={readOnly ? undefined : onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
