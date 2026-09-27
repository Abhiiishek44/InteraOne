import { createHash, randomBytes } from "crypto";
import { Types } from "mongoose";
import config from "@shared/infra/config";
import {
  FacebookOAuthState,
  LeadSourceConnection,
  LeadSourceForm,
  LeadSubmission,
  Membership,
} from "@shared/models";
import {
  decryptCredential,
  encryptCredential,
} from "@shared/security/credential-cipher";
import { leadSourceQueue } from "@shared/infra/queue";
import logger from "@shared/core/logger";
import { FacebookLeadAdsAdapter } from "./facebook-lead-ads.adapter";
import {
  GoogleFormsAdapter,
  type GoogleCredentials,
} from "./google-forms.adapter";

type FacebookWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        leadgen_id?: string;
        form_id?: string;
        page_id?: string;
        ad_id?: string;
        adgroup_id?: string;
        created_time?: number;
        [key: string]: unknown;
      };
    }>;
  }>;
};

const hashState = (state: string) =>
  createHash("sha256").update(state).digest("hex");

const serializeConnection = (connection: any) => ({
  id: connection._id.toString(),
  provider: connection.provider,
  name: connection.name,
  status: connection.status,
  externalAccountId: connection.externalAccountId,
  tokenExpiresAt: connection.tokenExpiresAt || null,
  lastError: connection.lastError || null,
  metadata: connection.metadata || {},
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt,
});

const serializeForm = (form: any) => ({
  id: form._id.toString(),
  connectionId: form.connectionId.toString(),
  provider: form.provider,
  externalFormId: form.externalFormId,
  externalFormName: form.externalFormName,
  status: form.status,
  fieldMappings: form.fieldMappings || {},
  defaults: form.defaults,
  createdAt: form.createdAt,
  updatedAt: form.updatedAt,
});

export class LeadSourcesService {
  constructor(
    private readonly facebook = new FacebookLeadAdsAdapter(),
    private readonly google = new GoogleFormsAdapter(),
  ) {}

  async beginFacebookOAuth(organizationId: string, userId: string) {
    this.assertFacebookConfigured();
    const state = randomBytes(32).toString("base64url");
    const redirectUri = `${config.app.clientUrl}/dashboard/integrations`;
    await FacebookOAuthState.create({
      stateHash: hashState(state),
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(userId),
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    return { authorizationUrl: this.facebook.getAuthorizationUrl(state) };
  }

  async completeFacebookOAuth(code: string, state: string) {
    const oauthState = await FacebookOAuthState.findOneAndDelete({
      stateHash: hashState(state),
      expiresAt: { $gt: new Date() },
    });
    if (!oauthState)
      throw new Error("Facebook OAuth state is invalid or expired");

    const token = await this.facebook.exchangeCodeForLongLivedToken(code);
    const pages = await this.facebook.listPages(token.accessToken);
    if (!pages.length) {
      const statuses = await this.facebook
        .listPermissionStatuses(token.accessToken)
        .catch(() => null);
      const requiredPermissions = [
        "leads_retrieval",
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_metadata",
      ];
      const missingPermissions = statuses
        ? requiredPermissions.filter(
            (permission) => statuses[permission] !== "granted",
          )
        : [];
      if (statuses && missingPermissions.length) {
        throw new Error(
          `Meta did not grant the required permissions: ${missingPermissions.join(", ")}. Grant them during authorization, then reconnect Facebook.`,
        );
      }
      throw new Error(
        "Meta returned no accessible Facebook Pages. Select a Page during authorization and ensure your Facebook user has Full control plus Leads access in Meta Business Suite.",
      );
    }

    const connected: string[] = [];
    const errors: Array<{ pageId: string; message: string }> = [];
    const tokenExpiresAt = token.expiresIn
      ? new Date(Date.now() + token.expiresIn * 1000)
      : null;

    for (const page of pages) {
      try {
        await this.facebook.subscribePage(page.id, page.accessToken);
        const connection = await LeadSourceConnection.findOneAndUpdate(
          {
            organizationId: oauthState.organizationId,
            provider: "facebook_lead_ads",
            externalAccountId: page.id,
          },
          {
            $set: {
              name: page.name,
              status: "active",
              credentialsCiphertext: encryptCredential(page.accessToken),
              tokenExpiresAt,
              lastError: null,
              metadata: { tasks: page.tasks || [] },
            },
            $setOnInsert: { createdBy: oauthState.userId },
          },
          { upsert: true, returnDocument: "after" },
        );
        await this.syncFacebookForms(connection._id.toString());
        connected.push(page.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Connection failed";
        errors.push({ pageId: page.id, message });
        logger.error("[LeadSources] Facebook Page connection failed", {
          pageId: page.id,
          organizationId: oauthState.organizationId.toString(),
          error: message,
        });
      }
    }

    if (!connected.length) {
      throw new Error(
        errors[0]?.message || "No Facebook Pages could be connected",
      );
    }

    return {
      redirectUri: oauthState.redirectUri,
      connected,
      errors,
    };
  }

  async beginGoogleOAuth(organizationId: string, userId: string) {
    this.assertGoogleConfigured();
    const state = randomBytes(32).toString("base64url");
    const redirectUri = `${config.app.clientUrl}/dashboard/integrations`;
    await FacebookOAuthState.create({
      stateHash: hashState(state),
      organizationId: new Types.ObjectId(organizationId),
      userId: new Types.ObjectId(userId),
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    return { authorizationUrl: this.google.getAuthorizationUrl(state) };
  }

  async completeGoogleOAuth(code: string, state: string) {
    const oauthState = await FacebookOAuthState.findOneAndDelete({
      stateHash: hashState(state),
      expiresAt: { $gt: new Date() },
    });
    if (!oauthState) throw new Error("Google OAuth state is invalid or expired");

    const token = await this.google.exchangeCode(code);
    const profile = await this.google.getProfile(token.credentials.accessToken);
    const connection = await LeadSourceConnection.findOneAndUpdate(
      {
        organizationId: oauthState.organizationId,
        provider: "google_forms",
        externalAccountId: profile.id,
      },
      {
        $set: {
          name: profile.email,
          status: "active",
          credentialsCiphertext: encryptCredential(JSON.stringify(token.credentials)),
          tokenExpiresAt: token.expiresIn
            ? new Date(Date.now() + token.expiresIn * 1000)
            : null,
          lastError: null,
          metadata: { email: profile.email },
        },
        $setOnInsert: { createdBy: oauthState.userId },
      },
      { upsert: true, returnDocument: "after" },
    );
    const forms = await this.syncGoogleForms(connection._id.toString());
    return { redirectUri: oauthState.redirectUri, connectionId: connection._id.toString(), forms: forms.length };
  }

  async list(organizationId: string) {
    const connections = await LeadSourceConnection.find({ organizationId })
      .sort({ createdAt: -1 })
      .lean();
    const forms = await LeadSourceForm.find({ organizationId })
      .sort({ externalFormName: 1 })
      .lean();
    const formsByConnection = new Map<string, any[]>();
    for (const form of forms) {
      const key = form.connectionId.toString();
      formsByConnection.set(key, [
        ...(formsByConnection.get(key) || []),
        serializeForm(form),
      ]);
    }
    return connections.map((connection) => ({
      ...serializeConnection(connection),
      forms: formsByConnection.get(connection._id.toString()) || [],
    }));
  }

  async syncFacebookForms(connectionId: string, organizationId?: string) {
    const query: Record<string, unknown> = { _id: connectionId };
    if (organizationId) query.organizationId = organizationId;
    const connection = await LeadSourceConnection.findOne(query).select(
      "+credentialsCiphertext",
    );
    if (!connection)
      throw new Error("Facebook lead source connection not found");
    if (connection.status !== "active")
      throw new Error("Connection is not active");

    const accessToken = decryptCredential(connection.credentialsCiphertext);
    const forms = await this.facebook.listForms(
      connection.externalAccountId,
      accessToken,
    );
    if (forms.length) {
      await LeadSourceForm.bulkWrite(
        forms.map((form) => ({
          updateOne: {
            filter: {
              connectionId: connection._id,
              externalFormId: form.id,
            },
            update: {
              $set: { externalFormName: form.name },
              $setOnInsert: {
                organizationId: connection.organizationId,
                provider: "facebook_lead_ads",
                status: "active",
                fieldMappings: {},
                defaults: {
                  tags: ["facebook-lead"],
                  lifecycleStage: "new",
                  leadStatus: "needs_review",
                  createOpportunity: false,
                },
              },
            },
            upsert: true,
          },
        })),
      );
    }
    return LeadSourceForm.find({ connectionId: connection._id })
      .sort({ externalFormName: 1 })
      .lean()
      .then((items) => items.map(serializeForm));
  }

  async syncForms(connectionId: string, organizationId?: string) {
    const connection = await LeadSourceConnection.findOne({
      _id: connectionId,
      ...(organizationId ? { organizationId } : {}),
    }).select("provider");
    if (!connection) throw new Error("Lead source connection not found");
    return connection.provider === "google_forms"
      ? this.syncGoogleForms(connectionId, organizationId)
      : this.syncFacebookForms(connectionId, organizationId);
  }

  async syncGoogleForms(connectionId: string, organizationId?: string) {
    const connection = await LeadSourceConnection.findOne({
      _id: connectionId,
      ...(organizationId ? { organizationId } : {}),
      provider: "google_forms",
    }).select("+credentialsCiphertext");
    if (!connection) throw new Error("Google Forms connection not found");
    if (connection.status !== "active") throw new Error("Connection is not active");

    const stored = JSON.parse(
      decryptCredential(connection.credentialsCiphertext),
    ) as GoogleCredentials;
    const credentials = await this.google.refresh(stored);
    if (credentials.accessToken !== stored.accessToken) {
      connection.credentialsCiphertext = encryptCredential(JSON.stringify(credentials));
      await connection.save();
    }
    const forms = await this.google.listForms(credentials.accessToken);
    if (forms.length) {
      await LeadSourceForm.bulkWrite(
        forms.map((form) => ({
          updateOne: {
            filter: { connectionId: connection._id, externalFormId: form.id },
            update: {
              $set: { externalFormName: form.name },
              $setOnInsert: {
                organizationId: connection.organizationId,
                provider: "google_forms",
                status: "active",
                fieldMappings: {},
                defaults: {
                  tags: ["google-form-lead"],
                  lifecycleStage: "new",
                  leadStatus: "needs_review",
                  createOpportunity: false,
                },
              },
            },
            upsert: true,
          },
        })),
      );
    }
    return LeadSourceForm.find({ connectionId: connection._id })
      .sort({ externalFormName: 1 })
      .lean()
      .then((items) => items.map(serializeForm));
  }

  async updateForm(
    organizationId: string,
    formId: string,
    input: {
      status?: "active" | "paused";
      fieldMappings?: Record<string, string>;
      defaults?: Record<string, unknown> & { ownerId?: string | null };
    },
  ) {
    if (input.defaults?.ownerId) {
      const membership = await Membership.exists({
        organizationId,
        userId: input.defaults.ownerId,
        inviteStatus: "accepted",
      });
      if (!membership)
        throw new Error("Owner must be an active organization member");
    }

    const update: Record<string, unknown> = {};
    if (input.status) update.status = input.status;
    if (input.fieldMappings) update.fieldMappings = input.fieldMappings;
    if (input.defaults) {
      for (const [key, value] of Object.entries(input.defaults)) {
        update[`defaults.${key}`] = value === "" ? null : value;
      }
    }
    const form = await LeadSourceForm.findOneAndUpdate(
      { _id: formId, organizationId },
      { $set: update },
      { returnDocument: "after", runValidators: true },
    );
    if (!form) throw new Error("Lead source form not found");
    return serializeForm(form);
  }

  async deleteConnection(organizationId: string, connectionId: string) {
    const connection = await LeadSourceConnection.findOne({
      _id: connectionId,
      organizationId,
    }).select("+credentialsCiphertext");
    if (!connection) throw new Error("Lead source connection not found");

    if (connection.provider === "facebook_lead_ads") {
      try {
        await this.facebook.unsubscribePage(
          connection.externalAccountId,
          decryptCredential(connection.credentialsCiphertext),
        );
      } catch (error) {
        logger.warn("[LeadSources] Could not unsubscribe Facebook Page", {
          connectionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await LeadSourceForm.deleteMany({ connectionId: connection._id });
    await connection.deleteOne();
  }

  async receiveFacebookWebhook(payload: FacebookWebhookPayload) {
    if (payload.object !== "page") return { accepted: 0 };
    let accepted = 0;

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (
          change.field !== "leadgen" ||
          !value?.leadgen_id ||
          !value.form_id
        ) {
          continue;
        }
        const pageId = value.page_id || entry.id;
        if (!pageId) continue;
        const connection = await LeadSourceConnection.findOne({
          provider: "facebook_lead_ads",
          externalAccountId: pageId,
          status: "active",
        }).lean();
        if (!connection) {
          logger.warn(
            "[LeadSources] Webhook received for an unknown Facebook Page",
            {
              pageId,
            },
          );
          continue;
        }

        const configuredForm = await LeadSourceForm.findOne({
          connectionId: connection._id,
          externalFormId: value.form_id,
        })
          .select("status")
          .lean();
        if (configuredForm?.status === "paused") continue;

        const submission = await LeadSubmission.findOneAndUpdate(
          {
            organizationId: connection.organizationId,
            provider: "facebook_lead_ads",
            externalSubmissionId: value.leadgen_id,
          },
          {
            $setOnInsert: {
              connectionId: connection._id,
              externalFormId: value.form_id,
              submittedAt: value.created_time
                ? new Date(value.created_time * 1000)
                : null,
              rawPayload: value,
              status: "received",
              attempts: 0,
            },
          },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
        );
        if (!submission) continue;

        await leadSourceQueue.add(
          "facebook-lead",
          {
            provider: "facebook_lead_ads",
            submissionId: submission._id.toString(),
          },
          { jobId: `facebook-${value.leadgen_id}` },
        );
        accepted += 1;
      }
    }
    return { accepted };
  }

  async listSubmissions(
    organizationId: string,
    options: { status?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 25));
    const filter: Record<string, unknown> = { organizationId };
    if (options.status) filter.status = options.status;
    const [submissions, total] = await Promise.all([
      LeadSubmission.find(filter)
        .select("-rawPayload")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LeadSubmission.countDocuments(filter),
    ]);
    return { submissions, total, page, limit };
  }

  async retrySubmission(organizationId: string, submissionId: string) {
    const submission = await LeadSubmission.findOneAndUpdate(
      { _id: submissionId, organizationId, status: "failed" },
      { $set: { status: "received", lastError: null } },
      { returnDocument: "after" },
    );
    if (!submission) throw new Error("Failed lead submission not found");
    await leadSourceQueue.add(
      submission.provider === "google_forms" ? "google-form-response" : "facebook-lead",
      { provider: submission.provider, submissionId },
      { jobId: `${submission.provider}-retry-${submissionId}-${Date.now()}` },
    );
    return submission;
  }

  private assertFacebookConfigured() {
    const missing = [
      ["META_APP_ID", config.leadSources.facebook.appId],
      ["META_APP_SECRET", config.leadSources.facebook.appSecret],
      ["META_WEBHOOK_VERIFY_TOKEN", config.leadSources.facebook.verifyToken],
      ["LEAD_SOURCE_ENCRYPTION_KEY", config.leadSources.encryptionKey],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length) {
      throw new Error(
        `Facebook Lead Ads is not configured: ${missing.join(", ")}`,
      );
    }
  }

  private assertGoogleConfigured() {
    const missing = [
      ["GOOGLE_CLIENT_ID", config.leadSources.google.clientId],
      ["GOOGLE_CLIENT_SECRET", config.leadSources.google.clientSecret],
      ["LEAD_SOURCE_ENCRYPTION_KEY", config.leadSources.encryptionKey],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    if (missing.length) {
      throw new Error(`Google Forms is not configured: ${missing.join(", ")}`);
    }
  }
}
