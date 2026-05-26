// Contacts
export {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  getContactWithRelations,
} from "./contacts";

// Deals
export {
  listDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
} from "./deals";

// Activities
export {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
  getPendingFollowups,
} from "./activities";
export type { ActivityWithContact } from "./activities";

// Pipeline
export {
  getStages,
  getStage,
  replaceStages,
  getFullPipeline,
} from "./pipeline";

// Messages
export {
  listMessages,
  createMessage,
} from "./messages";
export type { Message } from "./messages";

// Expenses
export {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from "./expenses";

// Quotes
export {
  listQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
} from "./quotes";
export type { Quote } from "./quotes";

// Revenues
export {
  listRevenues,
  getRevenue,
  createRevenue,
  updateRevenue,
} from "./revenues";

// Settings
export { getSetting, setSetting } from "./settings";

// Projects / Timeline
export {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listProjectLogs,
  createProjectLog,
} from "./projects";

// Opportunities
export {
  listOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
} from "./opportunities";
export type { } from "./opportunities";

// Notifications
export {
  listNotifications,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "./notifications";
export type { AppNotification, NotificationType } from "./notifications";

// Calendar
export {
  listCalendarEvents,
  getCalendarEvent,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "./calendar";

// Chatwoot Messages
export {
  listChatwootMessages,
  createChatwootMessage,
  markChatwootMessageProcessed,
} from "./chatwoot-messages";

// Tasks
export {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} from "./tasks";

// Orchestrator Runs
export {
  listOrchestratorRuns,
  getOrchestratorRun,
  createOrchestratorRun,
  updateOrchestratorRun,
} from "./orchestrator-runs";

// Agent Tasks
export {
  listAgentTasks,
  getAgentTask,
  createAgentTask,
  updateAgentTask,
  deleteAgentTask,
} from "./agent-tasks";

// Project Artifacts
export {
  listProjectArtifacts,
  getProjectArtifact,
  createProjectArtifact,
  updateProjectArtifact,
  deleteProjectArtifact,
} from "./project-artifacts";

// Deployment Results
export {
  listDeploymentResults,
  getDeploymentResult,
  createDeploymentResult,
  updateDeploymentResult,
  deleteDeploymentResult,
} from "./deployment-results";

// Workflow Events
export {
  listWorkflowEvents,
  createWorkflowEvent,
} from "./workflow-events";
