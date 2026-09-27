export type ChannelType = "email" | "whatsapp" | "telegram";
export type ChannelVerificationStatus = "pending" | "verified" | "failed";

export interface DnsRecord {
  type: "MX" | "TXT" | "CNAME";
  name: string;
  value: string;
  priority?: number;
  ttl?: number | string;
}

export interface EmailChannelConfig {
  address?: string;
  addresses: string[];
  domain: string;
  providerDomainId?: string;
  verificationStatus: ChannelVerificationStatus;
  dnsRecords: DnsRecord[];
  verifiedAt?: string;
}

export interface WhatsAppChannelConfig {
  phoneNumber: string;
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  verificationStatus: ChannelVerificationStatus;
}

export interface TelegramChannelConfig {
  botToken: string;
  botUsername?: string;
  verificationStatus: ChannelVerificationStatus;
}

export interface Channel {
  _id: string;
  organizationId: string;
  type: ChannelType;
  name: string;
  isActive: boolean;
  config: {
    email?: EmailChannelConfig;
    whatsapp?: WhatsAppChannelConfig;
    telegram?: TelegramChannelConfig;
  };
  createdAt: string;
  updatedAt: string;
}

// API response wrappers
export interface ChannelListResponse {
  success: boolean;
  data: {
    channels: Channel[];
  };
}

export interface ChannelResponse {
  success: boolean;
  data: {
    channel: Channel;
  };
}

export interface VerifyChannelResponse {
  success: boolean;
  message: string;
  data: {
    status: ChannelVerificationStatus;
    dnsRecords: DnsRecord[];
  };
}

export interface LeadSourceForm {
  id: string;
  connectionId: string;
  provider: "facebook_lead_ads" | "google_forms";
  externalFormId: string;
  externalFormName: string;
  status: "active" | "paused";
  fieldMappings: Record<string, string>;
  defaults: {
    ownerId?: string | null;
    tags: string[];
    lifecycleStage: "new" | "qualified";
    leadStatus: "needs_review" | "contacted" | "follow_up";
    createOpportunity: boolean;
    opportunityStage?: string;
    opportunityTitle?: string;
  };
}

export interface LeadSourceConnection {
  id: string;
  provider: "facebook_lead_ads" | "google_forms";
  name: string;
  status: "active" | "expired" | "error";
  externalAccountId: string;
  tokenExpiresAt?: string | null;
  lastError?: string | null;
  forms: LeadSourceForm[];
}

export interface LeadSourcesResponse {
  success: boolean;
  data: { connections: LeadSourceConnection[] };
}
