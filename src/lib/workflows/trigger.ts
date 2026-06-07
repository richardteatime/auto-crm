import { listActiveWorkflowsByTrigger } from "@/lib/db";
import { WorkflowExecutor } from "./executor";

// In-memory idempotency store with TTL (5 minutes).
// Prevents duplicate workflow runs when the same trigger is fired rapidly
// (e.g. double form submit, retry, or race condition).
const idempotencyStore = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000;

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const expires = idempotencyStore.get(key);
  if (expires && now < expires) return true;
  idempotencyStore.set(key, now + IDEMPOTENCY_TTL_MS);
  return false;
}

/**
 * Trigger all active workflows matching a trigger type.
 *
 * @param idempotencyKey — optional key to deduplicate triggers within a TTL.
 *   Recommended format: `${triggerType}:${entityId}:${timestampBucket}`
 *   e.g. `form_submitted:leadId:2024-06-06T10:00`.
 * @returns number of workflows triggered (0 if deduplicated or none found).
 */
export async function triggerWorkflows(
  triggerType: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<{ triggered: number }> {
  if (idempotencyKey && isDuplicate(idempotencyKey)) {
    console.warn(
      `[triggerWorkflows] Duplicate idempotency key skipped: ${idempotencyKey}`,
    );
    return { triggered: 0 };
  }

  try {
    const workflows = await listActiveWorkflowsByTrigger(triggerType);
    if (workflows.length === 0) return { triggered: 0 };

    const executor = new WorkflowExecutor();
    const results = await Promise.allSettled(
      workflows.map((wf) => executor.run(wf, payload)),
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(
        `[triggerWorkflows] ${failures.length}/${results.length} workflows failed`,
        failures.map((f) => (f as PromiseRejectedResult).reason),
      );
    }

    return { triggered: results.length };
  } catch (error) {
    console.error("[triggerWorkflows] Failed to list workflows", error);
    return { triggered: 0 };
  }
}
