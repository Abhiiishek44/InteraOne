import config from "@shared/infra/config";
import type {
  FacebookForm,
  FacebookLead,
  FacebookPage,
} from "./lead-sources.types";

type GraphErrorPayload = {
  error?: { message?: string; type?: string; code?: number };
};

// Wraps Meta Graph API operations used by the Facebook Lead Ads integration.
export class FacebookLeadAdsAdapter {
  private readonly baseUrl: string;

  // Initializes the adapter with the configured Meta Graph API base URL.
  constructor() {
    this.baseUrl = `https://graph.facebook.com/${config.leadSources.facebook.graphApiVersion}`;
  }

  // Builds the Meta OAuth authorization URL with the required lead permissions.
  getAuthorizationUrl(state: string): string {
    const appId = this.requireConfig("appId");
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: this.callbackUrl,
      state,
      response_type: "code",
      // Ask Meta to show previously declined permissions again. This also lets
      // the user revisit which Pages are shared with the app on reconnect.
      auth_type: "rerequest",
      scope: config.leadSources.facebook.oauthScopes.join(","),
    });
    return `https://www.facebook.com/${config.leadSources.facebook.graphApiVersion}/dialog/oauth?${params}`;
  }

  // Exchanges an OAuth code for a long-lived Meta user access token.
  async exchangeCodeForLongLivedToken(code: string): Promise<{
    accessToken: string;
    expiresIn?: number;
  }> {
    const appId = this.requireConfig("appId");
    const appSecret = this.requireConfig("appSecret");
    const shortToken = await this.graphGet<{
      access_token: string;
      expires_in?: number;
    }>("/oauth/access_token", {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: this.callbackUrl,
      code,
    });

    const longToken = await this.graphGet<{
      access_token: string;
      expires_in?: number;
    }>("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken.access_token,
    });

    return {
      accessToken: longToken.access_token,
      expiresIn: longToken.expires_in,
    };
  }

  // Lists Facebook Pages the authorized user can manage for lead collection.
  async listPages(userAccessToken: string): Promise<FacebookPage[]> {
    type AccountsResponse = {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        tasks?: string[];
      }>;
      paging?: { cursors?: { after?: string }; next?: string };
    };

    const pages: NonNullable<AccountsResponse["data"]> = [];
    let after: string | undefined;
    do {
      const result: AccountsResponse = await this.graphGet<AccountsResponse>(
        "/me/accounts",
        {
          fields: "id,name,access_token,tasks",
          limit: "100",
          access_token: userAccessToken,
          ...(after ? { after } : {}),
        },
      );
      pages.push(...(result.data || []));
      after = result.paging?.next ? result.paging.cursors?.after : undefined;
    } while (after);

    return pages
      .filter((page) => page.id && page.access_token)
      .map((page) => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token,
        tasks: page.tasks,
      }));
  }

  // Reads the grant status of each Meta permission requested by the integration.
  async listPermissionStatuses(
    userAccessToken: string,
  ): Promise<Record<string, string>> {
    const result = await this.graphGet<{
      data?: Array<{ permission?: string; status?: string }>;
    }>("/me/permissions", { access_token: userAccessToken });

    return Object.fromEntries(
      (result.data || [])
        .filter((item) => item.permission && item.status)
        .map((item) => [item.permission!, item.status!]),
    );
  }

  // Subscribes a Facebook Page to lead-generation webhook events.
  async subscribePage(pageId: string, pageAccessToken: string): Promise<void> {
    await this.graphPost(`/${pageId}/subscribed_apps`, pageAccessToken, {
      subscribed_fields: "leadgen",
    });
  }

  // Removes the lead-generation webhook subscription from a Facebook Page.
  async unsubscribePage(
    pageId: string,
    pageAccessToken: string,
  ): Promise<void> {
    await this.graphDelete(`/${pageId}/subscribed_apps`, pageAccessToken);
  }

  // Lists active instant forms owned by a connected Facebook Page.
  async listForms(
    pageId: string,
    pageAccessToken: string,
  ): Promise<FacebookForm[]> {
    const result = await this.graphGet<{ data?: FacebookForm[] }>(
      `/${pageId}/leadgen_forms`,
      {
        fields: "id,name,status",
        limit: "100",
        access_token: pageAccessToken,
      },
    );
    return result.data || [];
  }

  // Retrieves the complete field payload for a Facebook lead submission.
  async fetchLead(
    leadId: string,
    pageAccessToken: string,
  ): Promise<FacebookLead> {
    return this.graphGet<FacebookLead>(`/${leadId}`, {
      fields: [
        "id",
        "created_time",
        "form_id",
        "ad_id",
        "ad_name",
        "adset_id",
        "adset_name",
        "campaign_id",
        "campaign_name",
        "is_organic",
        "platform",
        "field_data",
      ].join(","),
      access_token: pageAccessToken,
    });
  }

  // Resolves the configured Facebook OAuth callback URL with a safe API fallback.
  private get callbackUrl(): string {
    return (
      config.leadSources.facebook.redirectUri ||
      `${config.app.apiUrl}/api/v1/lead-sources/facebook/callback`
    );
  }

  // Returns a required Meta configuration value or throws a setup error.
  private requireConfig(key: "appId" | "appSecret"): string {
    const value = config.leadSources.facebook[key];
    if (!value)
      throw new Error(
        `META_${key === "appId" ? "APP_ID" : "APP_SECRET"} is required`,
      );
    return value;
  }

  private async graphGet<T>(
    path: string,
    query: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(
      `${this.baseUrl}${path}?${new URLSearchParams(query)}`,
    );
    return this.parseResponse<T>(response);
  }

  // Sends an authenticated POST request to the configured Meta Graph API.
  private async graphPost(
    path: string,
    accessToken: string,
    body: Record<string, string>,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...body, access_token: accessToken }),
    });
    await this.parseResponse(response);
  }

  // Sends an authenticated DELETE request to the configured Meta Graph API.
  private async graphDelete(path: string, accessToken: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}${path}?${new URLSearchParams({ access_token: accessToken })}`,
      { method: "DELETE" },
    );
    await this.parseResponse(response);
  }

  private async parseResponse<T = unknown>(response: Response): Promise<T> {
    const payload = (await response.json().catch(() => ({}))) as T &
      GraphErrorPayload;
    if (!response.ok || payload.error) {
      throw new Error(
        payload.error?.message ||
          `Meta Graph API request failed with status ${response.status}`,
      );
    }
    return payload;
  }
}
// Encapsulates all direct communication with Meta’s Facebook Lead Ads APIs.
