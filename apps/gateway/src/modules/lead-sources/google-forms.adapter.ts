import config from "@shared/infra/config";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export type GoogleCredentials = {
  accessToken: string;
  refreshToken?: string;
};

export type GoogleFormSummary = { id: string; name: string };

// Wraps Google OAuth, Drive, and Forms operations for Google Forms lead capture.
export class GoogleFormsAdapter {
  // Builds the Google OAuth URL with offline access and Forms-related scopes.
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.requireConfig("clientId"),
      redirect_uri: this.callbackUrl,
      response_type: "code",
      state,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: config.leadSources.google.oauthScopes.join(" "),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // Exchanges a Google authorization code for encrypted-storable OAuth credentials.
  async exchangeCode(code: string): Promise<{
    credentials: GoogleCredentials;
    expiresIn?: number;
  }> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.requireConfig("clientId"),
        client_secret: this.requireConfig("clientSecret"),
        redirect_uri: this.callbackUrl,
        grant_type: "authorization_code",
      }),
    });
    const payload = (await response.json()) as GoogleTokenResponse;
    if (!response.ok || !payload.access_token) {
      throw new Error(
        payload.error_description ||
          payload.error ||
          "Google OAuth token exchange failed",
      );
    }
    return {
      credentials: {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
      },
      expiresIn: payload.expires_in,
    };
  }

  // Loads the stable Google account ID and email for a connected user.
  async getProfile(
    accessToken: string,
  ): Promise<{ id: string; email: string }> {
    const response = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      sub?: string;
      email?: string;
      error?: { message?: string };
    };
    if (!response.ok || !payload.sub || !payload.email) {
      throw new Error(
        payload.error?.message || "Could not read Google account profile",
      );
    }
    return { id: payload.sub, email: payload.email };
  }

  // Discovers all non-deleted Google Forms available through the connected Drive account.
  async listForms(accessToken: string): Promise<GoogleFormSummary[]> {
    const forms: GoogleFormSummary[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({
        q: "mimeType='application/vnd.google-apps.form' and trashed=false",
        fields: "nextPageToken,files(id,name)",
        orderBy: "modifiedTime desc",
        pageSize: "100",
        ...(pageToken ? { pageToken } : {}),
      });
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?${query}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        files?: GoogleFormSummary[];
        nextPageToken?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.message || "Could not list Google Forms",
        );
      }
      forms.push(...(payload.files || []));
      pageToken = payload.nextPageToken;
    } while (pageToken);
    return forms;
  }

  // Refreshes an expired Google access token while preserving its refresh token.
  async refresh(credentials: GoogleCredentials): Promise<GoogleCredentials> {
    if (!credentials.refreshToken) return credentials;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: credentials.refreshToken,
        client_id: this.requireConfig("clientId"),
        client_secret: this.requireConfig("clientSecret"),
        grant_type: "refresh_token",
      }),
    });
    const payload = (await response
      .json()
      .catch(() => ({}))) as GoogleTokenResponse;
    if (!response.ok || !payload.access_token) {
      throw new Error(
        payload.error_description || "Could not refresh Google access",
      );
    }
    return { ...credentials, accessToken: payload.access_token };
  }

  // Resolves the configured Google Forms callback URL with a safe API fallback.
  private get callbackUrl(): string {
    return (
      config.leadSources.google.redirectUri ||
      `${config.app.apiUrl}/api/v1/lead-sources/google/callback`
    );
  }

  // Returns a required Google OAuth configuration value or throws a setup error.
  private requireConfig(key: "clientId" | "clientSecret"): string {
    const value = config.leadSources.google[key];
    if (!value)
      throw new Error(
        `GOOGLE_${key === "clientId" ? "CLIENT_ID" : "CLIENT_SECRET"} is required`,
      );
    return value;
  }
}
// Encapsulates Google Forms OAuth, account lookup, token refresh, and discovery.
