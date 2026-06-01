"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { toast } from "sonner";
import type { Workflow, FlowNode, FlowEdge } from "@/lib/workflows/types";
import { WorkflowToolbar } from "./WorkflowToolbar";
import { NodeSidebar } from "./NodeSidebar";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { NodePropertiesPanel } from "./NodePropertiesPanel";
import { WorkflowRunsPanel } from "./WorkflowRunsPanel";
import { cn } from "@/lib/utils";

interface WorkflowEditorProps {
  workflow: Workflow;
}

type EditorTab = "editor" | "runs";

export function WorkflowEditor({ workflow }: WorkflowEditorProps) {
  const router = useRouter();
  const [tab, setTab] = useState<EditorTab>("editor");
  const [nodes, setNodes] = useState<FlowNode[]>(() => {
    try {
      return JSON.parse(workflow.nodes) as FlowNode[];
    } catch {
      return [];
    }
  });
  const [edges, setEdges] = useState<FlowEdge[]>(() => {
    try {
      return JSON.parse(workflow.edges) as FlowEdge[];
    } catch {
      return [];
    }
  });
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const triggerNode = nodes.find((n) => n.type === "trigger");
      const triggerType = triggerNode?.data.nodeType ?? workflow.triggerType;
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: JSON.stringify(nodes),
          edges: JSON.stringify(edges),
          triggerType,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Workflow salvato");
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: {} }),
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      toast.success(`Test completato: ${result.status}`);
    } catch {
      toast.error("Errore nel test");
    } finally {
      setTesting(false);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = workflow.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Workflow ${nextStatus === "active" ? "attivato" : "messo in pausa"}`);
      router.refresh();
    } catch {
      toast.error("Errore nel cambio stato");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <WorkflowToolbar
        name={workflow.name}
        status={workflow.status}
        onSave={handleSave}
        onTest={handleTest}
        onToggleStatus={handleToggleStatus}
        onBack={() => router.push("/workflows")}
        saving={saving}
        testing={testing}
      />
      <div className="flex items-center gap-1 px-4 py-1.5 border-b bg-muted/30">
        <button
          onClick={() => setTab("editor")}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
            tab === "editor" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Editor
        </button>
        <button
          onClick={() => setTab("runs")}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer",
            tab === "runs" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Esecuzioni
        </button>
      </div>
      {tab === "editor" ? (
        <div className="flex flex-1 overflow-hidden">
          <NodeSidebar />
          <div className="relative flex-1 h-full">
            <ReactFlowProvider>
              <WorkflowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={setNodes}
                onEdgesChange={setEdges}
                onNodeSelect={setSelectedNode}
              />
            </ReactFlowProvider>
            {nodes.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-md space-y-3 rounded-xl border bg-card/95 p-6 text-center shadow-lg backdrop-blur">
                  <h3 className="text-base font-semibold">Costruisci il tuo primo workflow</h3>
                  <p className="text-sm text-muted-foreground">Un&apos;automazione segue sempre questo schema:</p>
                  <ol className="space-y-1.5 text-left text-sm">
                    <li><span className="font-semibold">1. Trigger</span> — il «quando»: cosa avvia il workflow (es. arriva un lead).</li>
                    <li><span className="font-semibold">2. Condizione</span> <span className="text-muted-foreground">(opz.)</span> — il «se»: un bivio in base ai dati.</li>
                    <li><span className="font-semibold">3. Azione</span> — il «cosa fare»: invia email, crea task, sposta in pipeline…</li>
                    <li><span className="font-semibold">4. Attesa</span> <span className="text-muted-foreground">(opz.)</span> — una pausa prima del passo dopo.</li>
                  </ol>
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    Trascina un nodo dalla barra a sinistra fin qui, collega i nodi trascinando dai pallini, poi premi <span className="font-semibold">Salva</span> e <span className="font-semibold">Attiva</span>.
                  </p>
                </div>
              </div>
            )}
          </div>
          <NodePropertiesPanel
            node={selectedNode}
            onChange={(node) => {
              setNodes((prev) => prev.map((n) => (n.id === node.id ? node : n)));
              setSelectedNode(node);
            }}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <WorkflowRunsPanel workflowId={workflow.id} />
        </div>
      )}
    </div>
  );
}
