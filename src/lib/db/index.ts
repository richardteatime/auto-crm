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
  isClosingMove,
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
} from "./opportunities";
export type { } from "./opportunities";

// Closing (deals and opportunities are never deleted, only closed with a reason)
export { closeDeal, closeOpportunity, reopenOpportunity, CloseError } from "./closing";

// Links between opportunity, deal and quote
export { opportunitiesWithLinks, buildContactQuotes } from "./links";

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
