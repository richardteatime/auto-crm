export type Temperature = "cold" | "warm" | "hot";

export type ActivityType = "call" | "email" | "meeting" | "note" | "follow_up";

export type LeadSource =
  | "website"
  | "whatsapp"
  | "referido"
  | "redes_sociales"
  | "llamada_fria"
  | "email"
  | "formulario"
  | "evento"
  | "import"
  | "webhook"
  | "otro";

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  vatNumber: string | null;
  address: string | null;
  source: LeadSource;
  temperature: Temperature;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  title: string;
  value: number; // in cents
  stageId: string;
  contactId: string;
  expectedClose: Date | null;
  probability: number; // 0-100
  notes: string | null;
  attachments?: string | null;
  isRecurring?: boolean;
  recurringMonths?: number | null;
  recurringStartDate?: Date | null;
  wonAt?: Date | null;
  isPaid?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: number; // in cents
  date: Date | number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinanceSummary {
  periodStart: string;
  periodEnd: string;
  oneTimeRevenue: number;
  recurringRevenue: number;
  totalRevenue: number;
  mrr: number;
  totalExpenses: number;
  cashFlow: number;
  expenseByCategory: Record<string, number>;
  monthly: Array<{ month: string; oneTime: number; recurring: number; expenses: number }>;
}

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  contactId: string;
  dealId: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
  notes?: string | null;
  attachments?: string | null;
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export type OpportunityStatus = "aperta" | "trasformata";

export interface Opportunity {
  id: string;
  contactId: string;
  title: string;
  description: string | null;
  notes: string | null;
  attachments: string | null; // JSON: [{name, url}]
  status: OpportunityStatus;
  value: number | null; // cents
  dealId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmConfig {
  business: {
    type: string;
    industry: string;
    teamSize: string;
  };
  pipeline: {
    stages: Array<{
      name: string;
      order: number;
      color: string;
      isWon: boolean;
      isLost: boolean;
    }>;
  };
  leadSources: string[];
  preferences: {
    language: "es" | "en";
    theme: "light" | "dark" | "auto";
  };
}

// API response types
export interface DealWithContact extends Deal {
  contact?: Contact;
  stage?: PipelineStage;
  contactName?: string | null;
  contactTemperature?: string | null;
}

export interface ContactWithDeals extends Contact {
  deals?: Deal[];
  activities?: Activity[];
}

export interface PipelineColumn extends PipelineStage {
  deals: DealWithContact[];
}

export interface DashboardStats {
  totalContacts: number;
  activeDeals: number;
  totalPipelineValue: number;
  wonDealsValue: number;
  conversionRate: number;
  hotLeads: number;
}
