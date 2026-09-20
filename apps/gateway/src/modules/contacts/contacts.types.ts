export interface ListContactsOptions {
  search?: string;
  limit?: number;
  lifecycleStage?: string;
  leadStatus?: string;
  ownerId?: string;
  followUp?: "overdue" | "upcoming";
}

export interface ContactWriteInput {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  tags?: string[];
  lifecycleStage?: string;
  leadStatus?: string;
  ownerId?: string | null;
  acquisitionSource?: string;
  preferredChannel?: string | null;
  nextFollowUpAt?: string | null;
  lastContactedAt?: string | null;
}

export interface UpsertFromAIInput {
  organizationId: string;
  conversationId: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  tags?: string[];
  note?: string;
  sentiment?: "positive" | "neutral" | "negative";
  summary?: string;
  topics?: string[];
}
