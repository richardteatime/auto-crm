"use client";

import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
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

// Controlled canvas: il parent (WorkflowEditor) è l'unica fonte di verità per
// nodi/archi. Ogni modifica (drag, drop, connessione, eliminazione) viene
// applicata e ribaltata al parent, così pannello proprietà e salvataggio
// lavorano sempre sugli stessi dati.
interface WorkflowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: (nodes: FlowNode[]) => void;
  onEdgesChange: (edges: FlowEdge[]) => void;
  onNodeSelect?: (node: FlowNode | null) => void;
  readOnly?: boolean;
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeSelect,
  readOnly,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes as unknown as Node[]);
      onNodesChange(next as unknown as FlowNode[]);
    },
    [nodes, onNodesChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const next = applyEdgeChanges(changes, edges as unknown as Edge[]);
      onEdgesChange(next as unknown as FlowEdge[]);
    },
    [edges, onEdgesChange],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      const isCondition = sourceNode?.type === "condition";
      const label = isCondition ? (params.sourceHandle === "true" ? "Sì" : "No") : undefined;
      const next = addEdge({ ...params, label } as Connection, edges as unknown as Edge[]);
      onEdgesChange(next as unknown as FlowEdge[]);
    },
    [nodes, edges, onEdgesChange],
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

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const category = getNodeCategory(type);
      if (!category) return;
      const newNode: FlowNode = {
        id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: category,
        position,
        data: { nodeType: type, label: NODE_TYPE_LABELS[type] ?? type, config: {} },
      };
      onNodesChange([...nodes, newNode]);
    },
    [nodes, onNodesChange],
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

  // Click su una connessione → chiede conferma ed elimina (affordance visibile,
  // oltre al tasto Canc/Backspace sull'elemento selezionato).
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (typeof window !== "undefined" && window.confirm("Eliminare questa connessione?")) {
        onEdgesChange(
          (edges as unknown as Edge[]).filter((e) => e.id !== edge.id) as unknown as FlowEdge[],
        );
      }
    },
    [edges, onEdgesChange],
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes as unknown as Node[]}
        edges={edges as unknown as Edge[]}
        onNodesChange={readOnly ? undefined : handleNodesChange}
        onEdgesChange={readOnly ? undefined : handleEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onInit={onInit}
        onDrop={readOnly ? undefined : onDrop}
        onDragOver={readOnly ? undefined : onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onEdgeClick={readOnly ? undefined : onEdgeClick}
        deleteKeyCode={["Backspace", "Delete"]}
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
