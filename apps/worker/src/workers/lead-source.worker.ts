import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { ConnectionOptions, Queue, Worker } from "bullmq";
import mongoose, { Schema, Types } from "mongoose";
import config from "../config";
import logger from "../utils/logger";

export const LEAD_SOURCE_QUEUE = "lead-source-ingestion";

interface LeadSourceJobData {
  provider: "facebook_lead_ads" | "google_forms";
  submissionId: string;
}

interface FacebookFieldData {
  name: string;
  values: string[];
}

interface FacebookLead {
  id: string;
  created_time?: string;
  form_id?: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  is_organic?: boolean;
  platform?: string;
  field_data?: FacebookFieldData[];
}

interface NormalizedLead {
  provider: "facebook_lead_ads" | "google_forms";
  externalSubmissionId: string;
  externalFormId: string;
  submittedAt: Date;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  customFields: Record<string, unknown>;
  answers: Record<string, string | string[]>;
  attribution: Record<string, unknown>;
}

const DEFAULT_FIELD_MAPPINGS: Record<string, string> = {
  name: "name",
  your_name: "name",
  full_name: "name",
  first_name: "firstName",
  last_name: "lastName",
  email: "email",
  email_address: "email",
  phone_number: "phone",
  phone: "phone",
  company_name: "company",
  company: "company",
};

interface GoogleCredentials {
  accessToken: string;
  refreshToken?: string;
}

interface GoogleFormResponse {
  responseId: string;
  createTime?: string;
  lastSubmittedTime?: string;
  answers?: Record<
    string,
    {
      textAnswers?: { answers?: Array<{ value?: string }> };
    }
  >;
}

const DEFAULT_OPPORTUNITY_STAGE = "qualified";

function getModels() {
  const model = (name: string, definition: any) =>
    mongoose.models[name] ||
    mongoose.model(
      name,
      new Schema(definition, { timestamps: true, strict: false }),
    );

  const LeadSourceConnection = model("LeadSourceConnection", {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    status: String,
    credentialsCiphertext: { type: String, select: false },
  });
  const LeadSourceForm = model("LeadSourceForm", {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    connectionId: { type: Schema.Types.ObjectId, required: true },
    provider: String,
    externalFormId: String,
    externalFormName: String,
    status: { type: String, default: "active" },
    fieldMappings: { type: Schema.Types.Mixed, default: {} },
    defaults: {
      ownerId: { type: Schema.Types.ObjectId, default: null },
      tags: { type: [String], default: ["facebook-lead"] },
      lifecycleStage: { type: String, default: "new" },
      leadStatus: { type: String, default: "needs_review" },
      createOpportunity: { type: Boolean, default: false },
      opportunityStage: String,
      opportunityTitle: String,
    },
  });
  const LeadSubmission = model("LeadSubmission", {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    connectionId: { type: Schema.Types.ObjectId, required: true },
    formId: { type: Schema.Types.ObjectId, default: null },
    provider: String,
    externalSubmissionId: String,
    externalFormId: String,
    submittedAt: Date,
    rawPayload: Schema.Types.Mixed,
    normalizedPayload: Schema.Types.Mixed,
    status: String,
    contactId: { type: Schema.Types.ObjectId, default: null },
    opportunityId: { type: Schema.Types.ObjectId, default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    processedAt: { type: Date, default: null },
  });
  const Contact = model("Contact", {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    sessionId: String,
    accountId: { type: Schema.Types.ObjectId, default: null },
    name: String,
    email: String,
    phone: String,
    company: String,
    tags: [String],
    source: String,
    lifecycleStage: String,
    leadStatus: String,
    ownerId: { type: Schema.Types.ObjectId, default: null },
    acquisitionSource: String,
    preferredChannel: String,
    lastActivityAt: Date,
    metadata: { type: Schema.Types.Mixed, default: {} },
    customFields: { type: Map, of: Schema.Types.Mixed, default: {} },
  });
  const Opportunity = model("Opportunity", {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    contactId: { type: Schema.Types.ObjectId, default: null },
    primaryContactId: { type: Schema.Types.ObjectId, default: null },
    title: String,
    company: String,
    value: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    stage: String,
    position: { type: Number, default: 0 },
    ownerId: { type: Schema.Types.ObjectId, default: null },
    customFields: { type: Map, of: Schema.Types.Mixed, default: {} },
    sourceSubmissionId: { type: Schema.Types.ObjectId, default: null },
  });
  const CrmFieldDefinition = model("CrmFieldDefinition", {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    entityType: String,
    key: String,
    label: String,
    type: String,
    options: [Schema.Types.Mixed],
    isSystem: Boolean,
    required: Boolean,
    defaultValue: Schema.Types.Mixed,
    archivedAt: Date,
  });
  const SalesPipeline = model("SalesPipeline", {
    organizationId: { type: Schema.Types.ObjectId, required: true },
    stages: [Schema.Types.Mixed],
  });

  return {
    LeadSourceConnection,
    LeadSourceForm,
    LeadSubmission,
    Contact,
    Opportunity,
    CrmFieldDefinition,
    SalesPipeline,
  };
}

async function connectDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(config.database.mongoUri);
}

function decryptCredential(value: string): string {
  if (!config.leadSources.encryptionKey) {
    throw new Error(
      "LEAD_SOURCE_ENCRYPTION_KEY is required to process lead sources",
    );
  }
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Unsupported encrypted credential format");
  }
  const key = createHash("sha256")
    .update(config.leadSources.encryptionKey, "utf8")
    .digest();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptCredential(value: string): string {
  if (!config.leadSources.encryptionKey) {
    throw new Error(
      "LEAD_SOURCE_ENCRYPTION_KEY is required to process lead sources",
    );
  }
  const key = createHash("sha256")
    .update(config.leadSources.encryptionKey, "utf8")
    .digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

async function fetchFacebookLead(
  leadId: string,
  accessToken: string,
): Promise<FacebookLead> {
  const fields = [
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
  ].join(",");
  const query = new URLSearchParams({ fields, access_token: accessToken });
  const response = await fetch(
    `https://graph.facebook.com/${config.leadSources.facebook.graphApiVersion}/${leadId}?${query}`,
  );
  const payload = (await response.json().catch(() => ({}))) as FacebookLead & {
    error?: { message?: string };
  };
  if (!response.ok || payload.error) {
    throw new Error(
      payload.error?.message ||
        `Meta Graph API request failed with status ${response.status}`,
    );
  }
  return payload;
}

async function refreshGoogleCredentials(
  stored: GoogleCredentials,
): Promise<GoogleCredentials> {
  if (!stored.refreshToken) return stored;
  if (
    !config.leadSources.google.clientId ||
    !config.leadSources.google.clientSecret
  ) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required to ingest Google Forms",
    );
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: stored.refreshToken,
      client_id: config.leadSources.google.clientId,
      client_secret: config.leadSources.google.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || "Could not refresh Google access",
    );
  }
  return { ...stored, accessToken: payload.access_token };
}

async function googleApi<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`https://forms.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `Google Forms API request failed with status ${response.status}`,
    );
  }
  return payload;
}

function normalizeGoogleLead(
  response: GoogleFormResponse,
  formDefinition: any,
  configuredMappings: Record<string, string>,
  externalFormId: string,
): NormalizedLead {
  const questionTitles = new Map<string, string>();
  for (const item of formDefinition.items || []) {
    const questionId = item.questionItem?.question?.questionId;
    if (questionId) questionTitles.set(questionId, item.title || questionId);
  }
  const answers: Record<string, string | string[]> = {};
  const answersById: Record<string, string | string[]> = {};
  for (const [questionId, answer] of Object.entries(response.answers || {})) {
    const values =
      answer.textAnswers?.answers?.map((item) => item.value || "") || [];
    const value = values.length <= 1 ? values[0] || "" : values;
    answers[questionTitles.get(questionId) || questionId] = value;
    answersById[questionId] = value;
  }
  const result: Record<string, any> = { customFields: {} };
  for (const [label, answer] of Object.entries(answers)) {
    const normalizedLabel = label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    const questionId = [...questionTitles.entries()].find(
      ([, title]) => title === label,
    )?.[0];
    const target =
      configuredMappings[questionId || ""] ||
      configuredMappings[label] ||
      configuredMappings[normalizedLabel] ||
      DEFAULT_FIELD_MAPPINGS[normalizedLabel];
    if (!target || target === "ignore") continue;
    if (target.startsWith("customFields.")) {
      result.customFields[target.slice("customFields.".length)] = Array.isArray(
        answer,
      )
        ? answer
        : firstValue(answer);
    } else if (
      ["name", "email", "phone", "company", "firstName", "lastName"].includes(
        target,
      )
    ) {
      result[target] = firstValue(answer);
    }
  }
  result.email = result.email?.trim().toLowerCase();
  if (result.phone) {
    const trimmed = result.phone.trim();
    result.phone =
      `${trimmed.startsWith("+") ? "+" : ""}${trimmed.replace(/\D/g, "")}` ||
      undefined;
  }
  result.name =
    result.name?.trim() ||
    [result.firstName, result.lastName].filter(Boolean).join(" ") ||
    result.email ||
    result.phone ||
    `Google Forms Lead ${response.responseId}`;
  return {
    provider: "google_forms",
    externalSubmissionId: response.responseId,
    externalFormId,
    submittedAt: new Date(
      response.lastSubmittedTime || response.createTime || Date.now(),
    ),
    name: result.name,
    email: result.email,
    phone: result.phone,
    company: result.company,
    customFields: result.customFields,
    answers: { ...answers, ...answersById },
    attribution: {},
  };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim();
}

function normalizeLead(
  lead: FacebookLead,
  configuredMappings: Record<string, string>,
): NormalizedLead {
  const answers = Object.fromEntries(
    (lead.field_data || []).map((field) => [
      field.name,
      field.values.length <= 1 ? field.values[0] || "" : field.values,
    ]),
  );
  const mappings = { ...DEFAULT_FIELD_MAPPINGS, ...configuredMappings };
  const result: Record<string, any> = { customFields: {} };
  for (const [externalField, answer] of Object.entries(answers)) {
    const target = mappings[externalField];
    if (!target || target === "ignore") continue;
    if (target.startsWith("customFields.")) {
      result.customFields[target.slice("customFields.".length)] = Array.isArray(
        answer,
      )
        ? answer
        : firstValue(answer);
    } else if (["name", "email", "phone", "company"].includes(target)) {
      result[target] = firstValue(answer);
    }
  }
  if (!result.name) {
    result.name =
      [firstValue(answers.first_name), firstValue(answers.last_name)]
        .filter(Boolean)
        .join(" ") || undefined;
  }
  result.email = result.email?.trim().toLowerCase();
  if (result.phone) {
    const trimmed = result.phone.trim();
    result.phone =
      `${trimmed.startsWith("+") ? "+" : ""}${trimmed.replace(/\D/g, "")}` ||
      undefined;
  }
  result.name =
    result.name?.trim() ||
    result.email ||
    result.phone ||
    `Facebook Lead ${lead.id}`;
  return {
    provider: "facebook_lead_ads",
    externalSubmissionId: lead.id,
    externalFormId: lead.form_id || "unknown",
    submittedAt: lead.created_time ? new Date(lead.created_time) : new Date(),
    name: result.name,
    email: result.email,
    phone: result.phone,
    company: result.company,
    customFields: result.customFields,
    answers,
    attribution: {
      adId: lead.ad_id,
      adName: lead.ad_name,
      adsetId: lead.adset_id,
      adsetName: lead.adset_name,
      campaignId: lead.campaign_id,
      campaignName: lead.campaign_name,
      isOrganic: lead.is_organic,
      platform: lead.platform,
    },
  };
}

async function validateCustomFields(
  organizationId: Types.ObjectId,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { CrmFieldDefinition } = getModels();
  const fields = (await CrmFieldDefinition.find({
    organizationId,
    entityType: "contacts",
    archivedAt: null,
    isSystem: false,
  }).lean()) as any[];
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const normalized: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.defaultValue !== undefined && field.defaultValue !== null)
      normalized[field.key] = field.defaultValue;
  }
  for (const [key, value] of Object.entries(values)) {
    const field: any = byKey.get(key);
    if (!field) throw new Error(`Unknown or archived CRM field: ${key}`);
    const options = new Set(
      (field.options || []).map((option: any) => option.id),
    );
    if (field.type === "text" && typeof value !== "string")
      throw new Error(`${field.label} must be text`);
    if (
      field.type === "number" &&
      (typeof value !== "number" || !Number.isFinite(value))
    )
      throw new Error(`${field.label} must be a number`);
    if (field.type === "boolean" && typeof value !== "boolean")
      throw new Error(`${field.label} must be true or false`);
    if (
      field.type === "single_select" &&
      (typeof value !== "string" || !options.has(value))
    )
      throw new Error(`${field.label} has an invalid option`);
    if (
      field.type === "multi_select" &&
      (!Array.isArray(value) ||
        value.some((item) => typeof item !== "string" || !options.has(item)))
    )
      throw new Error(`${field.label} has an invalid option`);
    normalized[key] = typeof value === "string" ? value.trim() : value;
  }
  return normalized;
}

async function upsertContact(
  organizationId: Types.ObjectId,
  lead: NormalizedLead,
  form: any,
) {
  const { Contact } = getModels();
  const identities: Record<string, string>[] = [];
  if (lead.email) identities.push({ email: lead.email });
  if (lead.phone) identities.push({ phone: lead.phone });
  const contact = identities.length
    ? await Contact.findOne({ organizationId, $or: identities })
    : null;
  const sourceRecord = {
    provider: lead.provider,
    submissionId: lead.externalSubmissionId,
    formId: lead.externalFormId,
    formName: form.externalFormName,
    receivedAt: new Date(),
    ...lead.attribution,
  };
  const providerTag =
    lead.provider === "google_forms" ? "google-form-lead" : "facebook-lead";
  const tags = [...new Set([...(form.defaults?.tags || []), providerTag])]
    .map((tag: string) => tag.trim().toLowerCase())
    .filter(Boolean);
  if (!contact) {
    return Contact.create({
      organizationId,
      sessionId: `${lead.provider}:${lead.externalSubmissionId}`,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      tags,
      source: "integration",
      lifecycleStage: form.defaults?.lifecycleStage || "new",
      leadStatus: form.defaults?.leadStatus || "needs_review",
      ownerId: form.defaults?.ownerId || null,
      acquisitionSource: lead.provider,
      preferredChannel: lead.email ? "email" : lead.phone ? "phone" : null,
      lastActivityAt: new Date(),
      metadata: { leadSources: [sourceRecord] },
      customFields: lead.customFields,
    });
  }
  const metadata = (contact.metadata || {}) as Record<string, any>;
  const sources = Array.isArray(metadata.leadSources)
    ? metadata.leadSources
    : [];
  contact.set({
    metadata: {
      ...metadata,
      leadSources: [
        ...sources.filter(
          (source: any) => source?.submissionId !== lead.externalSubmissionId,
        ),
        sourceRecord,
      ],
    },
    tags: [...new Set([...(contact.tags || []), ...tags])],
    email: contact.email || lead.email,
    phone: contact.phone || lead.phone,
    company: contact.company || lead.company,
    name:
      !contact.name || contact.name === "Anonymous User"
        ? lead.name
        : contact.name,
    acquisitionSource:
      contact.acquisitionSource === "unknown"
        ? lead.provider
        : contact.acquisitionSource,
    ownerId: contact.ownerId || form.defaults?.ownerId || null,
    customFields: {
      ...(contact.customFields?.toObject?.() || contact.customFields || {}),
      ...lead.customFields,
    },
    lastActivityAt: new Date(),
  });
  await contact.save();
  return contact;
}

async function createOpportunity(
  organizationId: Types.ObjectId,
  contact: any,
  form: any,
  lead: NormalizedLead,
  submissionId: Types.ObjectId,
) {
  const { Opportunity, SalesPipeline } = getModels();
  const existing = await Opportunity.findOne({
    organizationId,
    sourceSubmissionId: submissionId,
  });
  if (existing) return existing;
  const pipeline = (await SalesPipeline.findOne({
    organizationId,
  }).lean()) as any;
  const requestedStage = form.defaults?.opportunityStage;
  const stage = requestedStage
    ? pipeline?.stages?.find((item: any) => item.id === requestedStage)?.id
    : pipeline?.stages?.find((item: any) => item.type === "open")?.id ||
      DEFAULT_OPPORTUNITY_STAGE;
  if (requestedStage && !stage)
    throw new Error("Pipeline stage does not exist");
  const position = await Opportunity.countDocuments({ organizationId, stage });
  return Opportunity.create({
    organizationId,
    contactId: contact._id,
    primaryContactId: contact._id,
    accountId: contact.accountId || null,
    title:
      form.defaults?.opportunityTitle ||
      `${lead.name} – ${form.externalFormName}`,
    company: contact.company,
    value: 0,
    currency: "USD",
    stage,
    position,
    ownerId: form.defaults?.ownerId || contact.ownerId || null,
    customFields: {},
    sourceSubmissionId: submissionId,
  });
}

async function processFacebookSubmission(submissionId: string): Promise<void> {
  await connectDb();
  const { LeadSubmission, LeadSourceConnection, LeadSourceForm } = getModels();
  const staleLock = new Date(Date.now() - 10 * 60 * 1000);
  const submission = await LeadSubmission.findOneAndUpdate(
    {
      _id: submissionId,
      $or: [
        { status: { $in: ["received", "failed"] } },
        { status: "processing", updatedAt: { $lt: staleLock } },
      ],
    },
    { $set: { status: "processing", lastError: null }, $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!submission) {
    const current = (await LeadSubmission.findById(submissionId)
      .select("status")
      .lean()) as any;
    if (current?.status === "completed" || current?.status === "processing")
      return;
    throw new Error("Lead submission not found");
  }
  try {
    const connection = await LeadSourceConnection.findOne({
      _id: submission.connectionId,
      organizationId: submission.organizationId,
      status: "active",
    }).select("+credentialsCiphertext");
    if (!connection)
      throw new Error("Facebook lead source connection is not active");
    const lead = await fetchFacebookLead(
      submission.externalSubmissionId,
      decryptCredential(connection.credentialsCiphertext),
    );
    lead.form_id ||= submission.externalFormId;
    let form = await LeadSourceForm.findOne({
      connectionId: connection._id,
      externalFormId: submission.externalFormId,
    });
    if (!form) {
      form = await LeadSourceForm.create({
        organizationId: submission.organizationId,
        connectionId: connection._id,
        provider: "facebook_lead_ads",
        externalFormId: submission.externalFormId,
        externalFormName: `Facebook form ${submission.externalFormId}`,
      });
    }
    if (form.status !== "active")
      throw new Error("Facebook lead form is paused");
    const normalized = normalizeLead(lead, form.fieldMappings || {});
    normalized.customFields = await validateCustomFields(
      submission.organizationId,
      normalized.customFields,
    );
    const contact = await upsertContact(
      submission.organizationId,
      normalized,
      form,
    );
    const opportunity = form.defaults?.createOpportunity
      ? await createOpportunity(
          submission.organizationId,
          contact,
          form,
          normalized,
          submission._id,
        )
      : null;
    await LeadSubmission.updateOne(
      { _id: submission._id },
      {
        $set: {
          formId: form._id,
          submittedAt: normalized.submittedAt,
          normalizedPayload: normalized,
          status: "completed",
          contactId: contact._id,
          opportunityId: opportunity?._id || null,
          processedAt: new Date(),
          lastError: null,
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ingestion error";
    await LeadSubmission.updateOne(
      { _id: submission._id },
      { $set: { status: "failed", lastError: message } },
    );
    throw error;
  }
}

async function processGoogleSubmission(submissionId: string): Promise<void> {
  await connectDb();
  const { LeadSubmission, LeadSourceConnection, LeadSourceForm } = getModels();
  const staleLock = new Date(Date.now() - 10 * 60 * 1000);
  const submission = await LeadSubmission.findOneAndUpdate(
    {
      _id: submissionId,
      $or: [
        { status: { $in: ["received", "failed"] } },
        { status: "processing", updatedAt: { $lt: staleLock } },
      ],
    },
    { $set: { status: "processing", lastError: null }, $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!submission) {
    const current = (await LeadSubmission.findById(submissionId)
      .select("status")
      .lean()) as any;
    if (current?.status === "completed" || current?.status === "processing")
      return;
    throw new Error("Lead submission not found");
  }
  try {
    const connection = await LeadSourceConnection.findOne({
      _id: submission.connectionId,
      organizationId: submission.organizationId,
      status: "active",
    }).select("+credentialsCiphertext");
    if (!connection) throw new Error("Google Forms connection is not active");
    const stored = JSON.parse(
      decryptCredential(connection.credentialsCiphertext),
    ) as GoogleCredentials;
    const credentials = await refreshGoogleCredentials(stored);
    if (credentials.accessToken !== stored.accessToken) {
      connection.credentialsCiphertext = encryptCredential(
        JSON.stringify(credentials),
      );
      await connection.save();
    }
    const form = await LeadSourceForm.findOne({
      connectionId: connection._id,
      externalFormId: submission.externalFormId,
    });
    if (!form) throw new Error("Google lead form is not configured");
    if (form.status !== "active") throw new Error("Google lead form is paused");
    const formDefinition = await googleApi<any>(
      `forms/${encodeURIComponent(submission.externalFormId)}`,
      credentials.accessToken,
    );
    const normalized = normalizeGoogleLead(
      submission.rawPayload as GoogleFormResponse,
      formDefinition,
      form.fieldMappings || {},
      submission.externalFormId,
    );
    normalized.customFields = await validateCustomFields(
      submission.organizationId,
      normalized.customFields,
    );
    const contact = await upsertContact(
      submission.organizationId,
      normalized,
      form,
    );
    const opportunity = form.defaults?.createOpportunity
      ? await createOpportunity(
          submission.organizationId,
          contact,
          form,
          normalized,
          submission._id,
        )
      : null;
    await LeadSubmission.updateOne(
      { _id: submission._id },
      {
        $set: {
          formId: form._id,
          submittedAt: normalized.submittedAt,
          normalizedPayload: normalized,
          status: "completed",
          contactId: contact._id,
          opportunityId: opportunity?._id || null,
          processedAt: new Date(),
          lastError: null,
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ingestion error";
    await LeadSubmission.updateOne(
      { _id: submission._id },
      { $set: { status: "failed", lastError: message } },
    );
    throw error;
  }
}

async function pollGoogleForms(
  queue: Queue<LeadSourceJobData, void, string>,
): Promise<void> {
  await connectDb();
  const { LeadSubmission, LeadSourceConnection, LeadSourceForm } = getModels();
  const forms = (await LeadSourceForm.find({
    provider: "google_forms",
    status: "active",
  }).lean()) as any[];
  const credentialsByConnection = new Map<string, GoogleCredentials>();
  for (const form of forms) {
    try {
      const connectionId = form.connectionId.toString();
      let credentials = credentialsByConnection.get(connectionId);
      if (!credentials) {
        const connection = await LeadSourceConnection.findOne({
          _id: form.connectionId,
          organizationId: form.organizationId,
          status: "active",
        }).select("+credentialsCiphertext");
        if (!connection) continue;
        const stored = JSON.parse(
          decryptCredential(connection.credentialsCiphertext),
        ) as GoogleCredentials;
        credentials = await refreshGoogleCredentials(stored);
        if (credentials.accessToken !== stored.accessToken) {
          connection.credentialsCiphertext = encryptCredential(
            JSON.stringify(credentials),
          );
          await connection.save();
        }
        credentialsByConnection.set(connectionId, credentials);
      }
      let pageToken: string | undefined;
      do {
        const query = new URLSearchParams({
          pageSize: "500",
          ...(pageToken ? { pageToken } : {}),
        });
        const payload = await googleApi<{
          responses?: GoogleFormResponse[];
          nextPageToken?: string;
        }>(
          `forms/${encodeURIComponent(form.externalFormId)}/responses?${query}`,
          credentials.accessToken,
        );
        for (const response of payload.responses || []) {
          const submission = await LeadSubmission.findOneAndUpdate(
            {
              organizationId: form.organizationId,
              provider: "google_forms",
              externalSubmissionId: response.responseId,
            },
            {
              $setOnInsert: {
                connectionId: form.connectionId,
                formId: form._id,
                externalFormId: form.externalFormId,
                submittedAt:
                  response.lastSubmittedTime || response.createTime
                    ? new Date(
                        response.lastSubmittedTime || response.createTime!,
                      )
                    : null,
                rawPayload: response,
                status: "received",
                attempts: 0,
              },
            },
            {
              upsert: true,
              returnDocument: "after",
              setDefaultsOnInsert: true,
            },
          );
          if (submission.status === "received") {
            await queue.add(
              "google-form-response",
              {
                provider: "google_forms",
                submissionId: submission._id.toString(),
              },
              { jobId: `google-${response.responseId}` },
            );
          }
        }
        pageToken = payload.nextPageToken;
      } while (pageToken);
    } catch (error) {
      logger.error("Google Forms poll failed", {
        formId: form.externalFormId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function startLeadSourceWorker() {
  const connection: ConnectionOptions = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
  };
  const worker = new Worker<LeadSourceJobData, void, string>(
    LEAD_SOURCE_QUEUE,
    async (job) => {
      if (job.data.provider === "facebook_lead_ads") {
        await processFacebookSubmission(job.data.submissionId);
      } else if (job.data.provider === "google_forms") {
        await processGoogleSubmission(job.data.submissionId);
      } else {
        throw new Error(
          `Unsupported lead source provider: ${job.data.provider}`,
        );
      }
    },
    { connection, concurrency: config.worker.concurrency },
  );
  worker.on("completed", (job) =>
    logger.info("Lead source submission processed", {
      jobId: job.id,
      submissionId: job.data.submissionId,
    }),
  );
  worker.on("failed", (job, error) =>
    logger.error("Lead source submission failed", {
      jobId: job?.id,
      submissionId: job?.data.submissionId,
      attemptsMade: job?.attemptsMade,
      error,
    }),
  );
  worker.on("error", (error) =>
    logger.error("Lead source worker error", {
      queue: LEAD_SOURCE_QUEUE,
      error,
    }),
  );
  logger.info("Lead source worker started", {
    queue: LEAD_SOURCE_QUEUE,
    concurrency: config.worker.concurrency,
  });
  return worker;
}

export function startGoogleFormsPoller() {
  const connection: ConnectionOptions = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
  };
  const queue = new Queue<LeadSourceJobData, void, string>(LEAD_SOURCE_QUEUE, {
    connection,
  });
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await pollGoogleForms(queue);
    } catch (error) {
      logger.error("Google Forms polling cycle failed", { error });
    } finally {
      running = false;
    }
  };
  const timer = setInterval(run, config.leadSources.google.pollIntervalMs);
  timer.unref();
  void run();
  logger.info("Google Forms poller started", {
    intervalMs: config.leadSources.google.pollIntervalMs,
  });
  return {
    close: async () => {
      clearInterval(timer);
      await queue.close();
    },
  };
}
