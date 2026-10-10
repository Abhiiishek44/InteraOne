export type OpportunityStage = string;
export type PipelineStageType = "open" | "won" | "lost";
export type OpportunityColor =
  | "slate"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "cyan"
  | "blue"
  | "violet"
  | "pink"
  | "emerald";
export type PipelineStageColor =
  | "slate"
  | "blue"
  | "violet"
  | "amber"
  | "orange"
  | "emerald"
  | "rose";

export interface PipelineStage {
  id: string;
  label: string;
  color: PipelineStageColor;
  type: PipelineStageType;
  order: number;
}

export interface SalesPipeline {
  name: string;
  stages: PipelineStage[];
  isDefault: boolean;
}

export interface Opportunity {
  id: string;
  title: string;
  recordType: "lead" | "deal";
  labels: string[];
  sourceOrigin: string;
  sourceChannel: string;
  sourceChannelId: string;
  company?: string;
  account?: {
    id: string;
    name: string;
    website?: string;
    linkedinProfile?: string;
    industry?: string;
    address?: string;
    annualRevenue?: number | null;
    numberOfEmployees?: number | null;
    labels?: string[];
    customFields?: Record<string, unknown>;
  } | null;
  value: number;
  currency: "USD" | "INR" | "EUR" | "GBP";
  stage: OpportunityStage;
  color: OpportunityColor;
  position: number;
  priority: 1 | 2 | 3;
  expectedCloseAt: string | null;
  nextAction: string;
  activities: Array<{
    id: string;
    type: "note" | "status" | "planned" | "message";
    content: string;
    category: "todo" | "email" | "call" | "meeting" | "document";
    dueAt: string | null;
    durationMinutes?: number;
    completedAt: string | null;
    createdAt: string;
    customFields?: Record<string, unknown>;
    googleCalendarEventId?: string | null;
    googleCalendarId?: string | null;
    googleCalendarEventUrl?: string | null;
    googleMeetUrl?: string | null;
    calendarSyncStatus?: "synced" | "failed" | null;
    calendarSyncError?: string | null;
  }>;
  contact: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    phones?: Array<{
      value: string;
      type: "work" | "home" | "mobile" | "other";
    }>;
    emails?: Array<{
      value: string;
      type: "work" | "home" | "mobile" | "other";
    }>;
    company?: string;
  } | null;
  owner: {
    id: string;
    name: string;
    email?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, unknown>;
  archivedAt?: string | null;
}

export interface UpdatePipelinePayload {
  name: string;
  stages: PipelineStage[];
}

export interface CreateOpportunityPayload {
  contactId?: string | null;
  primaryContactId?: string | null;
  accountId?: string | null;
  title: string;
  recordType?: "lead" | "deal";
  labels?: string[];
  sourceOrigin?: string;
  sourceChannel?: string;
  sourceChannelId?: string;
  company?: string;
  value: number;
  currency: Opportunity["currency"];
  stage?: OpportunityStage;
  ownerId?: string | null;
  expectedCloseAt?: string | null;
  nextAction?: string;
  customFields?: Record<string, unknown>;
}

export type UpdateOpportunityPayload = Partial<
  Omit<CreateOpportunityPayload, "contactId" | "stage">
>;
