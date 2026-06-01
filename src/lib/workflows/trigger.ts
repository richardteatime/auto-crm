import { listActiveWorkflowsByTrigger } from "@/lib/db";
import { WorkflowExecutor } from "./executor";

/**
 * Fire-and-forget trigger for all active workflows matching a trigger type.
 * Never blocks the caller — workflows run in the background.
 */
export async function triggerWorkflows(
  triggerType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const workflows = await listActiveWorkflowsByTrigger(triggerType);
    if (workflows.length === 0) return;

    const executor = new WorkflowExecutor();
    // Run all workflows concurrently; we don't await them so the API stays fast.
    Promise.allSettled(
      workflows.map((wf) => executor.run(wf, payload)),
    ).catch(() => {
      // Silent catch — individual workflow errors are already logged inside the executor.
    });
  } catch {
    // If listing workflows fails, we must not break the calling API route.
  }
}
