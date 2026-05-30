// ---------------------------------------------------------------------------
// Orchestrator core types
// ---------------------------------------------------------------------------

export type SenderRole =
  | "founder_admin"
  | "team_member"
  | "developer"
  | "sales"
  | "customer"
  | "unknown";

export type RunStatus =
  | "pending"
  | "running"
  | "waiting_for_data"
  | "pending_dispatch"
  | "dispatched"
  | "completed"
  | "failed"
  | "cancelled"
  | "unauthorized";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface OrchestratorRun {
  id: string;
  source: string;
  senderPhone: string | null;
  senderRole: SenderRole;
  contactId: string | null;
  dealId: string | null;
  projectId: string | null;
  intent: string;
  workflow: string | null;
  status: RunStatus;
  commandText: string;
  resultSummary: string | null;
  riskLevel: RiskLevel;
  autodeploy: boolean;
  currentStep: string | null;
  finalUrl: string | null;
  repoUrl: string | null;
  conversationId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowEvent {
  id: string;
  runId: string | null;
  eventType: WorkflowEventType;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export type WorkflowEventType =
  | "message_received"
  | "permission_checked"
  | "intent_classified"
  | "query_executed"
  | "command_executed"
  | "project_created"
  | "deal_created"
  | "task_created"
  | "workflow_started"
  | "gitagent_dispatched"
  | "gitagent_callback_received"
  | "deploy_callback_received"
  | "final_url_saved"
  | "reply_sent"
  | "unauthorized"
  | "error";

export type Intent =
  | "project_status_query"
  | "revenue_today_query"
  | "lead_summary_query"
  | "blocked_projects_query"
  | "agent_status_query"
  | "deployment_status_query"
  | "tasks_query"
  | "create_project_command"
  | "create_deal_command"
  | "create_task_command"
  | "start_static_site_workflow"
  | "generate_app_for_client"
  | "unknown";

export interface AgentTask {
  id: string;
  runId: string;
  agentName: string;
  taskType: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  input: string;
  output: string | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ArtifactType =
  | "repo"
  | "branch"
  | "qa_report"
  | "build_log"
  | "deploy_package"
  | "preview_url"
  | "final_url"
  | "handover_doc";

export interface ProjectArtifact {
  id: string;
  runId: string;
  projectId: string | null;
  artifactType: ArtifactType;
  name: string;
  url: string | null;
  content: string | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentResult {
  id: string;
  runId: string;
  projectId: string | null;
  environment: "preview" | "staging" | "production";
  status: string;
  url: string | null;
  provider: string;
  healthcheckStatus: string | null;
  rollbackAvailable: boolean;
  logs: string | null;
  createdAt: Date;
  updatedAt: Date;
}
