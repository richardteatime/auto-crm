import type { WorkflowEventType } from "./types";
import { createWorkflowEvent } from "@/lib/db/workflow-events";

/**
 * Log a workflow event.
 *
 * Graceful: if the collection doesn't exist yet,
 * logs to console instead of crashing.
 */
export async function logWorkflowEvent(data: {
  runId?: string;
  eventType: WorkflowEventType;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await createWorkflowEvent({
      runId: data.runId,
      eventType: data.eventType,
      message: data.message,
      metadata: data.metadata,
    });
  } catch (err) {
    console.error(
      "[workflow_event] failed to save:",
      err instanceof Error ? err.message : err,
    );
  }
}
