import type {
  Workflow,
  WorkflowScheduled,
  FlowNode,
  FlowEdge,
  ExecutionContext,
  NodeExecutorInput,
  NodeExecutorOutput,
} from "./types";
import { getNodeDefinition } from "./registry";
import {
  getWorkflow,
  createWorkflowRun,
  updateWorkflowRun,
  createWorkflowRunLog,
  updateWorkflowScheduled,
} from "@/lib/db";

export interface ExecutorResult {
  runId: string | null;
  status: "completed" | "failed" | "scheduled";
  error?: string;
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

function buildAdjacency(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const map = new Map<string, FlowEdge[]>();
  for (const edge of edges) {
    const list = map.get(edge.source) ?? [];
    list.push(edge);
    map.set(edge.source, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// WorkflowExecutor
// ---------------------------------------------------------------------------

export class WorkflowExecutor {
  async run(workflow: Workflow, payload: unknown): Promise<ExecutorResult> {
    const run = await createWorkflowRun({
      workflowId: workflow.id,
      triggerType: workflow.triggerType,
      triggerPayload: JSON.stringify(payload),
      status: "running",
    });

    try {
      const result = await this.executeGraph(workflow, payload, run.id);

      if (result.status === "scheduled") {
        await updateWorkflowRun(run.id, { status: "scheduled" });
        return { runId: run.id, status: "scheduled" };
      }

      await updateWorkflowRun(run.id, {
        status: result.status,
        completedAt: new Date().toISOString(),
        error: result.error ?? null,
      });

      return { runId: run.id, status: result.status, error: result.error };
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await updateWorkflowRun(run.id, { status: "failed", error: err });
      return { runId: run.id, status: "failed", error: err };
    }
  }

  async runTest(workflow: Workflow, payload: unknown): Promise<ExecutorResult> {
    // Test runs are executed exactly like real runs so the user can inspect
    // logs and behaviour in the test panel. The only difference is semantic:
    // the frontend labels them as "Test".
    return this.run(workflow, payload);
  }

  async resumeFromScheduled(scheduled: WorkflowScheduled): Promise<ExecutorResult> {
    const workflow = await getWorkflow(scheduled.workflowId);
    if (!workflow) {
      return { runId: null, status: "failed", error: "Workflow non trovato" };
    }

    const nodes: FlowNode[] = JSON.parse(workflow.nodes || "[]");
    const edges: FlowEdge[] = JSON.parse(workflow.edges || "[]");
    const adj = buildAdjacency(edges);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    let context: ExecutionContext;
    try {
      context = JSON.parse(scheduled.payload) as ExecutionContext;
    } catch {
      context = {
        trigger: { type: workflow.triggerType, payload: {} },
        variables: {},
      };
    }
    // Always restore the real workflowId so chained delay nodes can re-schedule.
    context.variables.workflowId = workflow.id;

    // Find the node that comes *after* the delay node we just woke up from
    const outgoing = adj.get(scheduled.nodeId) ?? [];
    if (outgoing.length === 0) {
      await updateWorkflowRun(scheduled.runId, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      await updateWorkflowScheduled(scheduled.id, { status: "completed" });
      return { runId: scheduled.runId, status: "completed" };
    }

    const nextNodeId = outgoing[0].target;
    await updateWorkflowScheduled(scheduled.id, { status: "processing" });

    const result = await this.traverse(nextNodeId, nodeMap, adj, context, scheduled.runId);

    await updateWorkflowScheduled(scheduled.id, { status: result.status === "scheduled" ? "pending" : "completed" });
    await updateWorkflowRun(scheduled.runId, {
      status: result.status,
      completedAt: result.status === "scheduled" ? undefined : new Date().toISOString(),
      error: result.error ?? null,
    });

    return { runId: scheduled.runId, status: result.status, error: result.error };
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private async executeGraph(
    workflow: Workflow,
    payload: unknown,
    runId: string,
  ): Promise<{ status: "completed" | "failed" | "scheduled"; error?: string }> {
    const nodes: FlowNode[] = JSON.parse(workflow.nodes || "[]");
    const edges: FlowEdge[] = JSON.parse(workflow.edges || "[]");

    if (nodes.length === 0) {
      return { status: "completed" };
    }

    const adj = buildAdjacency(edges);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const triggerNode = nodes.find((n) => n.type === "trigger");
    if (!triggerNode) {
      return { status: "failed", error: "Nessun nodo trigger trovato nel workflow" };
    }

    const context: ExecutionContext = {
      trigger: { type: workflow.triggerType, payload },
      // Seed the real workflowId so delay nodes persist it into
      // workflow_scheduled. Without it, the worker's resumeFromScheduled would
      // call getWorkflow("") → null → "Workflow non trovato", leaving every
      // delayed workflow stuck forever.
      variables: { workflowId: workflow.id },
    };

    return this.traverse(triggerNode.id, nodeMap, adj, context, runId);
  }

  private async traverse(
    startNodeId: string,
    nodeMap: Map<string, FlowNode>,
    adj: Map<string, FlowEdge[]>,
    context: ExecutionContext,
    runId: string,
  ): Promise<{ status: "completed" | "failed" | "scheduled"; error?: string }> {
    let currentNodeId: string | undefined = startNodeId;
    const visited = new Set<string>();

    while (currentNodeId) {
      if (visited.has(currentNodeId)) {
        return { status: "failed", error: "Ciclo infinito rilevato nel workflow" };
      }
      visited.add(currentNodeId);

      const node = nodeMap.get(currentNodeId);
      if (!node) {
        return { status: "failed", error: `Nodo ${currentNodeId} non trovato` };
      }

      const def = getNodeDefinition(node.data.nodeType);
      if (!def) {
        await this.logExecution(runId, node, {
          status: "failed",
          error: `Tipo nodo sconosciuto: ${node.data.nodeType}`,
        });
        return { status: "failed", error: `Tipo nodo sconosciuto: ${node.data.nodeType}` };
      }

      // Inject runtime variables so handlers can reference workflow/run ids
      context.variables.workflowId = context.variables.workflowId ?? "";
      context.variables.runId = runId;
      context.variables.nodeId = node.id;

      const input: NodeExecutorInput = {
        nodeId: node.id,
        nodeType: node.data.nodeType,
        config: node.data.config,
        context,
      };

      const logInput = JSON.stringify({ config: node.data.config, variables: context.variables });
      let result: NodeExecutorOutput;

      try {
        result = await def.executor(input);
      } catch (e) {
        result = { status: "failed", error: e instanceof Error ? e.message : String(e) };
      }

      // Merge executor output back into context variables
      if (result.output) {
        Object.assign(context.variables, result.output);
      }

      await this.logExecution(runId, node, result, logInput);

      if (result.status === "failed") {
        return { status: "failed", error: result.error };
      }

      // Determine next node
      const outgoing: FlowEdge[] = adj.get(currentNodeId) ?? [];

      if (result.nextNodeId) {
        // Legacy / explicit routing (e.g. hard-coded in node config)
        currentNodeId = result.nextNodeId;
      } else if (def.category === "condition" && outgoing.length > 0) {
        const conditionResult = result.output?.result === true ? "true" : "false";
        // Match the branch by the source handle id ("true"/"false"); fall back to
        // the edge label (also supports the "Sì"/"No" display labels), then the
        // first edge. Keeps routing correct regardless of how the edge is labelled.
        const branchOf = (e: FlowEdge): string | undefined => {
          const v = e.sourceHandle ?? e.label;
          if (v === "true" || v === "Sì" || v === "si") return "true";
          if (v === "false" || v === "No" || v === "no") return "false";
          return undefined;
        };
        const match: FlowEdge =
          outgoing.find((e: FlowEdge) => branchOf(e) === conditionResult) ?? outgoing[0];
        currentNodeId = match.target;
      } else if (outgoing.length > 0) {
        currentNodeId = outgoing[0].target;
      } else {
        currentNodeId = undefined;
      }

      // Delay nodes schedule a future resume — stop traversal now
      if (def.category === "delay" && result.status === "ok") {
        return { status: "scheduled" };
      }
    }

    return { status: "completed" };
  }

  private async logExecution(
    runId: string,
    node: FlowNode,
    result: NodeExecutorOutput,
    input?: string,
  ) {
    try {
      await createWorkflowRunLog({
        runId,
        nodeId: node.id,
        nodeType: node.data.nodeType,
        status: result.status,
        input: input ?? null,
        output: result.output ? JSON.stringify(result.output) : null,
        error: result.error ?? null,
      });
    } catch {
      // Logging must never break the workflow
    }
  }
}
