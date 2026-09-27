import { apiClient } from "@/shared/lib/api-client";
import type {
  ChannelListResponse,
  ChannelResponse,
  LeadSourcesResponse,
  VerifyChannelResponse,
} from "../types/types";

export interface CreateEmailChannelPayload {
  name: string;
  email?: string;
  domain: string;
}

export interface CreateWhatsAppChannelPayload {
  name: string;
  phoneNumber: string;
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
}

export interface CreateTelegramChannelPayload {
  name: string;
  botToken: string;
}

export const channelsApi = {
  /** List all channels for the active org */
  listChannels: () => apiClient.get<ChannelListResponse>("/channels"),

  /** Create + provision the email channel */
  createEmailChannel: (payload: CreateEmailChannelPayload) =>
    apiClient.post<ChannelResponse>("/channels/email", payload),

  /** Create + provision the WhatsApp channel (BYOK) */
  createWhatsAppChannel: (payload: CreateWhatsAppChannelPayload) =>
    apiClient.post<ChannelResponse>("/channels/whatsapp", payload),

  /** Create + provision the Telegram channel */
  createTelegramChannel: (payload: CreateTelegramChannelPayload) =>
    apiClient.post<ChannelResponse>("/channels/telegram", payload),

  /** Re-trigger Resend/SES domain verification */
  verifyChannel: (channelId: string) =>
    apiClient.post<VerifyChannelResponse>(`/channels/${channelId}/verify`),

  /** Update email channel addresses */
  updateEmailChannelAddresses: (channelId: string, emails: string[]) =>
    apiClient.patch<ChannelResponse>(`/channels/${channelId}/email/addresses`, {
      emails,
    }),

  /** Delete a channel */
  deleteChannel: (channelId: string) =>
    apiClient.delete<{ success: boolean }>(`/channels/${channelId}`),

  listLeadSources: () => apiClient.get<LeadSourcesResponse>("/lead-sources"),

  beginFacebookLeadAdsOAuth: () =>
    apiClient.get<{
      success: boolean;
      data: { authorizationUrl: string };
    }>("/lead-sources/facebook/connect"),

  beginGoogleFormsOAuth: () =>
    apiClient.get<{
      success: boolean;
      data: { authorizationUrl: string };
    }>("/lead-sources/google/connect"),

  beginGoogleCalendarOAuth: () =>
    apiClient.get<{
      success: boolean;
      data: { authorizationUrl: string };
    }>("/lead-sources/google-calendar/connect"),

  syncGoogleCalendars: (connectionId: string) =>
    apiClient.post<{ success: boolean }>(
      `/lead-sources/${connectionId}/calendars/sync`,
    ),

  beginGoogleTasksOAuth: () =>
    apiClient.get<{
      success: boolean;
      data: { authorizationUrl: string };
    }>("/lead-sources/google-tasks/connect"),

  syncGoogleTaskLists: (connectionId: string) =>
    apiClient.post<{ success: boolean }>(
      `/lead-sources/${connectionId}/task-lists/sync`,
    ),

  syncFacebookLeadForms: (connectionId: string) =>
    apiClient.post<{ success: boolean }>(
      `/lead-sources/${connectionId}/forms/sync`,
    ),

  updateLeadSourceForm: (
    formId: string,
    payload: {
      status?: "active" | "paused";
      defaults?: { createOpportunity?: boolean };
    },
  ) =>
    apiClient.patch<{ success: boolean }>(
      `/lead-sources/forms/${formId}`,
      payload,
    ),

  deleteLeadSource: (connectionId: string) =>
    apiClient.delete<{ success: boolean }>(`/lead-sources/${connectionId}`),
};
