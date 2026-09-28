import config from "@shared/infra/config";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export type GoogleCalendarCredentials = {
  accessToken: string;
  refreshToken?: string;
};

export type GoogleCalendarSummary = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  backgroundColor?: string;
  timeZone?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  htmlLink?: string;
  hangoutLink?: string;
};

// Wraps Google OAuth and CalendarList operations for calendar connections.
export class GoogleCalendarAdapter {
  // Builds the Google Calendar OAuth URL with offline and incremental authorization.
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.requireConfig("clientId"),
      redirect_uri: this.callbackUrl,
      response_type: "code",
      state,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: config.leadSources.googleCalendar.oauthScopes.join(" "),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // Exchanges a Google authorization code for Calendar OAuth credentials.
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
          "Google Calendar token exchange failed",
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

  // Loads the stable Google account ID and email for a calendar connection.
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

  // Lists every accessible, non-deleted calendar for the connected Google account.
  async listCalendars(accessToken: string): Promise<GoogleCalendarSummary[]> {
    const calendars: GoogleCalendarSummary[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({
        maxResults: "250",
        ...(pageToken ? { pageToken } : {}),
      });
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/users/me/calendarList?${query}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        items?: Array<{
          id: string;
          summary?: string;
          primary?: boolean;
          accessRole?: string;
          backgroundColor?: string;
          timeZone?: string;
          deleted?: boolean;
        }>;
        nextPageToken?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          payload.error?.message || "Could not list Google Calendars",
        );
      }
      calendars.push(
        ...(payload.items || [])
          .filter((calendar) => !calendar.deleted)
          .map((calendar) => ({
            id: calendar.id,
            summary: calendar.summary || calendar.id,
            primary: Boolean(calendar.primary),
            accessRole: calendar.accessRole || "reader",
            backgroundColor: calendar.backgroundColor,
            timeZone: calendar.timeZone,
          })),
      );
      pageToken = payload.nextPageToken;
    } while (pageToken);
    return calendars;
  }

  // Creates a CRM meeting in Google Calendar and requests a Google Meet link.
  async createEvent(
    accessToken: string,
    calendarId: string,
    input: {
      summary: string;
      description?: string;
      start: Date;
      end: Date;
      attendeeEmail?: string;
      requestId: string;
      createConference?: boolean;
    },
  ): Promise<GoogleCalendarEvent> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          start: { dateTime: input.start.toISOString() },
          end: { dateTime: input.end.toISOString() },
          attendees: input.attendeeEmail
            ? [{ email: input.attendeeEmail }]
            : undefined,
          conferenceData: input.createConference
            ? {
                createRequest: {
                  requestId: input.requestId,
                  conferenceSolutionKey: { type: "hangoutsMeet" },
                },
              }
            : undefined,
          extendedProperties: {
            private: { interaOneActivityId: input.requestId },
          },
        }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      error?: {
        message?: string;
        status?: string;
        errors?: Array<{ reason?: string }>;
      };
    };
    if (!response.ok || !payload.id) {
      const insufficientScope =
        response.status === 403 &&
        (payload.error?.status === "PERMISSION_DENIED" ||
          payload.error?.errors?.some((error) =>
            ["insufficientPermissions", "forbidden"].includes(
              error.reason || "",
            ),
          ) ||
          /insufficient authentication scopes/i.test(
            payload.error?.message || "",
          ));
      if (insufficientScope) {
        throw new Error(
          "Google Calendar needs event access. Reconnect Google Calendar in Integrations and approve the requested permissions.",
        );
      }
      throw new Error(
        payload.error?.message || "Could not create Google Calendar event",
      );
    }
    return {
      id: payload.id,
      htmlLink: payload.htmlLink,
      hangoutLink: payload.hangoutLink,
    };
  }

  // Refreshes Google Calendar access credentials for background synchronization.
  async refresh(
    credentials: GoogleCalendarCredentials,
  ): Promise<GoogleCalendarCredentials> {
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
        payload.error_description || "Could not refresh Google Calendar access",
      );
    }
    return { ...credentials, accessToken: payload.access_token };
  }

  // Resolves the configured Google Calendar callback URL with a safe API fallback.
  private get callbackUrl() {
    return (
      config.leadSources.googleCalendar.redirectUri ||
      `${config.app.apiUrl}/api/v1/lead-sources/google-calendar/callback`
    );
  }

  // Returns a required Google Calendar OAuth setting or throws a setup error.
  private requireConfig(key: "clientId" | "clientSecret") {
    const value = config.leadSources.googleCalendar[key];
    if (!value) {
      throw new Error(
        `GOOGLE_${key === "clientId" ? "CLIENT_ID" : "CLIENT_SECRET"} is required`,
      );
    }
    return value;
  }
}
// Encapsulates Google Calendar OAuth, account lookup, token refresh, and discovery.
