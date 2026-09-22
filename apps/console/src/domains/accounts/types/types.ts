export type AccountLifecycleStage = "prospect" | "qualified" | "customer" | "inactive" | "lost";

export interface AccountSummary {
  id: string;
  name: string;
  website: string;
  domain: string;
  industry: string;
  description: string;
  phone: string;
  tags: string[];
  lifecycleStage: AccountLifecycleStage;
  owner: { id: string; name: string; email?: string } | null;
  contactCount: number;
  opportunityCount: number;
  pipelineValue: number;
  lastActivityAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetail {
  account: Omit<AccountSummary, "contactCount" | "opportunityCount" | "pipelineValue" | "lastActivityAt">;
  contacts: Array<{
    id: string; name: string; email: string; phone: string; lifecycleStage: string;
    owner: { id: string; name: string } | null; lastActivityAt: string;
  }>;
  opportunities: Array<{
    id: string; title: string; value: number; currency: string; stage: string; nextAction: string;
    primaryContact: { id: string; name: string } | null;
    owner: { id: string; name: string } | null; updatedAt: string;
  }>;
  activity: Array<{
    id: string; type: string; content: string; actor?: string; createdAt: string;
    contact?: { id: string; name: string }; opportunity?: { id: string; title: string };
  }>;
}

export interface AccountWritePayload {
  name: string;
  website?: string;
  industry?: string;
  description?: string;
  phone?: string;
  ownerId?: string | null;
  tags?: string[];
  lifecycleStage?: AccountLifecycleStage;
}
