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

// Tasks
export {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from "./tasks";
export type { Task } from "./tasks";

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
