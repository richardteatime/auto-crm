// Contacts
export {
  listContacts,
  getContact,
  findContactByEmailOrPhone,
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

// ===========================================================================
// Lead Pipeline Automation MVP
// ===========================================================================

// Leads
export {
  listLeads,
  getLead,
  createLead,
  updateLead,
  findDuplicateLead,
} from "./leads";
export type { CreateLeadInput } from "./leads";

// Pipeline Movements
export {
  listPipelineMovements,
  createPipelineMovement,
} from "./pipeline-movements";

// Automation Rules
export {
  listAutomationRules,
  createAutomationRule,
  updateAutomationRule,
} from "./automation-rules";

// Automation Runs
export {
  listAutomationRuns,
  createAutomationRun,
  updateAutomationRun,
} from "./automation-runs";

// Call Tasks
export {
  listCallTasks,
  getCallTask,
  createCallTask,
  createOpenCallTaskIfMissing,
  openCallTaskId,
  updateCallTask,
  deleteCallTask,
  getOpenCallTaskForLead,
} from "./call-tasks";

// Lead Quotes
export {
  listLeadQuotes,
  getLeadQuote,
  createLeadQuote,
  updateLeadQuote,
} from "./lead-quotes";

// ===========================================================================
// Capture & Conversion Platform (FASE 2)
// ===========================================================================

// Landing Pages
export {
  listLandingPages,
  getLandingPage,
  getLandingPageBySlug,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  landingSlugExists,
  incrementLandingCounter,
} from "./landing-pages";
export type { CreateLandingPageInput } from "./landing-pages";

// Landing Templates
export {
  listLandingTemplates,
  getLandingTemplate,
  createLandingTemplate,
} from "./landing-templates";

// Forms
export {
  listForms,
  getForm,
  createForm,
  updateForm,
  deleteForm,
  incrementFormCounter,
} from "./forms";

// Form Submissions
export {
  listFormSubmissions,
  createFormSubmission,
} from "./form-submissions";

// Booking Links
export {
  listBookingLinks,
  listBookingLinksByAssignee,
  getBookingLink,
  getBookingLinkBySlug,
  createBookingLink,
  updateBookingLink,
  deleteBookingLink,
  bookingSlugExists,
  incrementBookingCount,
} from "./booking-links";

// Booking Appointments
export {
  listBookingAppointments,
  listAppointmentsInRange,
  createBookingAppointment,
  updateBookingAppointment,
} from "./booking-appointments";

// Funnels
export {
  listFunnels,
  getFunnel,
  getFunnelBySlug,
  createFunnel,
  updateFunnel,
  deleteFunnel,
  funnelSlugExists,
  incrementFunnelCounter,
} from "./funnels";

// Funnel Sessions
export {
  getFunnelSession,
  listFunnelSessions,
  createFunnelSession,
  updateFunnelSession,
  getOrCreateFunnelSession,
} from "./funnel-sessions";

// Funnel Events
export {
  listFunnelEvents,
  createFunnelEvent,
} from "./funnel-events";

// Analytics Events
export {
  createAnalyticsEvent,
  listAnalyticsEvents,
} from "./analytics-events";

// ===========================================================================
// Visual Workflow Builder (FASE 3)
// ===========================================================================

// Workflows
export {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  listActiveWorkflowsByTrigger,
} from "./workflows";

// Workflow Runs
export {
  listWorkflowRuns,
  getWorkflowRun,
  createWorkflowRun,
  updateWorkflowRun,
  deleteWorkflowRun,
} from "./workflow-runs";

// Workflow Run Logs
export {
  listWorkflowRunLogs,
  getWorkflowRunLog,
  createWorkflowRunLog,
  updateWorkflowRunLog,
} from "./workflow-run-logs";

// Workflow Scheduled
export {
  listWorkflowScheduled,
  getWorkflowScheduled,
  createWorkflowScheduled,
  updateWorkflowScheduled,
  deleteWorkflowScheduled,
} from "./workflow-scheduled";
