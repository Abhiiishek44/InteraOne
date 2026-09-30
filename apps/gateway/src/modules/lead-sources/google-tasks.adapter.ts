// Encapsulates Google Tasks OAuth, account lookup, token refresh, and discovery.
import config from "@shared/infra/config";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export type GoogleTasksCredentials = {
  accessToken: string;
  refreshToken?: string;
};

export type GoogleTaskListSummary = {
  id: string;
  title: string;
  updated?: string;
};

// Wraps Google OAuth and TaskLists operations for Google Tasks connections.
export class GoogleTasksAdapter {
  // Builds the Google Tasks OAuth URL with offline and incremental authorization.
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.requireConfig("clientId"),
      redirect_uri: this.callbackUrl,
      response_type: "code",
      state,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: config.leadSources.googleTasks.oauthScopes.join(" "),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // Exchanges a Google authorization code for Tasks OAuth credentials.
  async exchangeCode(code: string) {
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
    const payload = (await response.json()) as TokenResponse;
    if (!response.ok || !payload.access_token) {
      throw new Error(
        payload.error_description ||
          payload.error ||
          "Google Tasks token exchange failed",
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

  // Loads the stable Google account ID and email for a Tasks connection.
  async getProfile(accessToken: string) {
    const response = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } },
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

  // Lists every task list available to the connected Google account.
  async listTaskLists(accessToken: string): Promise<GoogleTaskListSummary[]> {
    const taskLists: GoogleTaskListSummary[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({
        maxResults: "1000",
        ...(pageToken ? { pageToken } : {}),
      });
      const response = await fetch(
        `https://tasks.googleapis.com/tasks/v1/users/@me/lists?${query}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        items?: GoogleTaskListSummary[];
        nextPageToken?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.message || "Could not list Google Task lists",
        );
      }
      taskLists.push(...(payload.items || []));
      pageToken = payload.nextPageToken;
    } while (pageToken);
    return taskLists;
  }

  // Refreshes Google Tasks access credentials for background synchronization.
  async refresh(
    credentials: GoogleTasksCredentials,
  ): Promise<GoogleTasksCredentials> {
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
    const payload = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok || !payload.access_token) {
      throw new Error(
        payload.error_description || "Could not refresh Google Tasks access",
      );
    }
    return { ...credentials, accessToken: payload.access_token };
  }

  // Resolves the configured Google Tasks callback URL with a safe API fallback.
  private get callbackUrl() {
    return (
      config.leadSources.googleTasks.redirectUri ||
      `${config.app.apiUrl}/api/v1/lead-sources/google-tasks/callback`
    );
  }

  // Returns a required Google Tasks OAuth setting or throws a setup error.
  private requireConfig(key: "clientId" | "clientSecret") {
    const value = config.leadSources.googleTasks[key];
    if (!value) {
      throw new Error(
        `GOOGLE_${key === "clientId" ? "CLIENT_ID" : "CLIENT_SECRET"} is required`,
      );
    }
    return value;
  }
}
