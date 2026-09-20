export type ContactLifecycleStage =
  | "new"
  | "qualified"
  | "opportunity"
  | "customer"
  | "inactive"
  | "lost";
export type ContactLeadStatus =
  | "needs_review"
  | "contacted"
  | "follow_up"
  | "converted"
  | "unqualified";
export type ContactChannel =
  | "widget"
  | "email"
  | "whatsapp"
  | "telegram"
  | "phone";
export type ContactAcquisitionSource =
  | ContactChannel
  | "qr"
  | "manual"
  | "unknown";

export interface ContactOwner {
  id: string;
  name: string;
  email: string;
}

export interface ContactWritePayload {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  tags?: string[];
  lifecycleStage?: ContactLifecycleStage;
  leadStatus?: ContactLeadStatus;
  ownerId?: string | null;
  acquisitionSource?: ContactAcquisitionSource;
  preferredChannel?: ContactChannel | null;
  nextFollowUpAt?: string | null;
  lastContactedAt?: string | null;
}

export interface ContactNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface ContactConversation {
  id: string;
  status: "open" | "resolved" | "closed";
  lastMessage: string;
  channel: string;
  updatedAt: string;
}

export interface ContactInsight {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  topics: string[];
}

export interface ContactConflict {
  id: string;
  field: "name" | "phone" | "company";
  currentValue: string;
  proposedValue: string;
  conversationId: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  tags: string[];
  lifecycleStage: ContactLifecycleStage;
  leadStatus: ContactLeadStatus;
  owner: ContactOwner | null;
  acquisitionSource: ContactAcquisitionSource;
  preferredChannel: ContactChannel | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  lastActivity: string;
  createdAt: string;
  isOnline: boolean;
  conversationCount: number;
  notes: ContactNote[];
  conversations: ContactConversation[];
  insights: ContactInsight;
  conflicts: ContactConflict[];
}

export interface ContactListItem {
  id: string;
  sessionId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  tags: string[];
  source: "ai" | "widget" | "agent" | "owner" | "admin";
  lifecycleStage: ContactLifecycleStage;
  leadStatus: ContactLeadStatus;
  owner: ContactOwner | null;
  acquisitionSource: ContactAcquisitionSource;
  preferredChannel: ContactChannel | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  notes: Array<{
    id: string;
    author: string;
    content: string;
    createdAt: string;
  }>;
  conversations: Array<{
    id: string;
    status: "open" | "resolved" | "closed";
    lastMessage: string;
    channel: string;
    updatedAt: string;
  }>;
  insights: {
    summary: string;
    sentiment: "positive" | "neutral" | "negative";
    topics: string[];
  };
  conflicts?: Array<{
    id: string;
    field: "name" | "phone" | "company";
    currentValue: string;
    proposedValue: string;
    conversationId: string;
    createdAt: string;
  }>;
  conversationCount: number;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactConflictItem {
  id: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  field: "name" | "phone" | "company";
  currentValue: string;
  proposedValue: string;
  conversationId: string;
  createdAt: string;
}

export const toContactViewModel = (item: ContactListItem): Contact => ({
  id: item.id,
  name: item.name,
  email: item.email,
  phone: item.phone,
  company: item.company,
  tags: item.tags || [],
  lifecycleStage: item.lifecycleStage || "new",
  leadStatus: item.leadStatus || "needs_review",
  owner: item.owner || null,
  acquisitionSource: item.acquisitionSource || "unknown",
  preferredChannel: item.preferredChannel || null,
  nextFollowUpAt: item.nextFollowUpAt || null,
  lastContactedAt: item.lastContactedAt || null,
  lastActivity: item.lastActivity,
  createdAt: item.createdAt,
  isOnline: false,
  conversationCount: item.conversationCount,
  notes: item.notes || [],
  conversations:
    item.conversations && item.conversations.length > 0
      ? item.conversations
      : [
          {
            id: `conv-${item.id}`,
            status: "open",
            lastMessage: "Conversation context is still syncing.",
            channel: "widget",
            updatedAt: item.updatedAt,
          },
        ],
  insights: {
    summary:
      item.insights?.summary ||
      "No insights yet. Continue conversations to generate AI insights.",
    sentiment: item.insights?.sentiment || "neutral",
    topics: item.insights?.topics || [],
  },
  conflicts: item.conflicts || [],
});
