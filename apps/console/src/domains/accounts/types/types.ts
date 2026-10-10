export type AccountLifecycleStage =
  | "prospect"
  | "qualified"
  | "customer"
  | "inactive"
  | "lost";

export interface AccountSummary {
  id: string;
  name: string;
  website: string;
  domain: string;
  industry: string;
  description: string;
  phone: string;
  address: string;
  linkedinProfile: string;
  annualRevenue: number | null;
  numberOfEmployees: number | null;
  labels: string[];
  tags: string[];
  lifecycleStage: AccountLifecycleStage;
  owner: { id: string; name: string; email?: string } | null;
  contactCount: number;
  opportunityCount: number;
  closedDeals: number;
  openDeals: number;
  nextActivityAt: string | null;
  pipelineValue: number;
  lastActivityAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customFields: Record<string, unknown>;
}

export interface AccountDetail {
  account: Omit<
    AccountSummary,
    | "contactCount"
    | "opportunityCount"
    | "closedDeals"
    | "openDeals"
    | "nextActivityAt"
    | "pipelineValue"
    | "lastActivityAt"
  >;
  contacts: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    lifecycleStage: string;
    owner: { id: string; name: string } | null;
    lastActivityAt: string;
  }>;
  opportunities: Array<{
    id: string;
    title: string;
    value: number;
    currency: string;
    stage: string;
    nextAction: string;
    expectedCloseAt: string | null;
    nextActivityAt: string | null;
    primaryContact: { id: string; name: string } | null;
    owner: { id: string; name: string } | null;
    updatedAt: string;
  }>;
  activity: Array<{
    id: string;
    type: string;
    title?: string;
    content: string;
    pinned?: boolean;
    activityType?: "call" | "meeting" | "task" | "deadline" | "lunch";
    startAt?: string;
    endAt?: string;
    priority?: "none" | "low" | "medium" | "high";
    status?: "scheduled" | "done";
    fileName?: string;
    fileKey?: string;
    mimeType?: string;
    size?: number;
    actor?: string;
    createdAt: string;
    contact?: { id: string; name: string };
    opportunity?: { id: string; title: string };
  }>;
}

export interface AccountWritePayload {
  name: string;
  website?: string;
  industry?: string;
  description?: string;
  phone?: string;
  address?: string;
  linkedinProfile?: string;
  annualRevenue?: number | null;
  numberOfEmployees?: number | null;
  labels?: string[];
  ownerId?: string | null;
  tags?: string[];
  lifecycleStage?: AccountLifecycleStage;
  customFields?: Record<string, unknown>;
}

export interface AccountActivityPayload {
  title: string;
  content?: string;
  activityType: "call" | "meeting" | "task" | "deadline" | "lunch";
  startAt: string;
  endAt: string;
  priority: "none" | "low" | "medium" | "high";
  status: "scheduled" | "done";
}
