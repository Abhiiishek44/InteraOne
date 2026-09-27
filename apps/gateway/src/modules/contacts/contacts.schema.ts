import Joi from "joi";

const lifecycleStage = Joi.string().valid(
  "new",
  "qualified",
  "opportunity",
  "customer",
  "inactive",
  "lost",
);
const leadStatus = Joi.string().valid(
  "needs_review",
  "contacted",
  "follow_up",
  "converted",
  "unqualified",
);
const contactChannel = Joi.string().valid(
  "widget",
  "email",
  "whatsapp",
  "telegram",
  "phone",
);
const acquisitionSource = Joi.string().valid(
  "widget",
  "email",
  "whatsapp",
  "telegram",
  "phone",
  "qr",
  "manual",
  "unknown",
);

export const contactsSchema = {
  listContactsQuery: Joi.object({
    q: Joi.string().trim().max(200).allow(""),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(300),
    lifecycleStage,
    leadStatus,
    ownerId: Joi.string().hex().length(24),
    followUp: Joi.string().valid("overdue", "upcoming"),
    tags: Joi.string().trim().max(500).allow(""),
    activityRange: Joi.string().valid("24h", "7d", "30d", "90d"),
    conversationRange: Joi.string().valid("1-2", "3-10", "10+"),
    sort: Joi.string().valid("name", "recent", "conversations", "created"),
  }),

  createContact: Joi.object({
    name: Joi.string().trim().max(120).required(),
    email: Joi.string().email().allow(""),
    phone: Joi.string().trim().max(40).allow(""),
    company: Joi.string().trim().max(160).allow(""),
    accountId: Joi.string().hex().length(24).allow(null, ""),
    tags: Joi.array().items(Joi.string().trim().max(40)).max(20),
    lifecycleStage,
    leadStatus,
    ownerId: Joi.string().hex().length(24).allow(null, ""),
    acquisitionSource,
    preferredChannel: contactChannel.allow(null, ""),
    nextFollowUpAt: Joi.date().iso().allow(null, ""),
    lastContactedAt: Joi.date().iso().allow(null, ""),
    customFields: Joi.object().max(100),
  }),

  upsertFromAI: Joi.object({
    organizationId: Joi.string().required(),
    conversationId: Joi.string().required(),
    name: Joi.string().trim().max(120),
    email: Joi.string().email(),
    phone: Joi.string().trim().max(40),
    company: Joi.string().trim().max(120),
    tags: Joi.array().items(Joi.string().trim().max(50)).max(20),
    note: Joi.string().trim().max(2000),
    sentiment: Joi.string().valid("positive", "neutral", "negative"),
    summary: Joi.string().trim().max(4000),
    topics: Joi.array().items(Joi.string().trim().max(80)).max(20),
  }),

  deleteContacts: Joi.object({
    ids: Joi.array().items(Joi.string().required()).min(1).required(),
  }),

  bulkAddTags: Joi.object({
    ids: Joi.array().items(Joi.string().required()).min(1).required(),
    tags: Joi.array()
      .items(Joi.string().trim().max(50).required())
      .min(1)
      .required(),
  }),

  addNote: Joi.object({
    content: Joi.string().trim().max(2000).required(),
  }),

  updateNote: Joi.object({
    content: Joi.string().trim().max(2000).required(),
  }),

  addTag: Joi.object({
    tag: Joi.string().trim().max(50).required(),
  }),

  resolveConflict: Joi.object({
    action: Joi.string().valid("apply", "dismiss").required(),
  }),

  updateContact: Joi.object({
    name: Joi.string().trim().max(120),
    email: Joi.string().email().allow(""),
    phone: Joi.string().trim().max(40).allow(""),
    company: Joi.string().trim().max(160).allow(""),
    accountId: Joi.string().hex().length(24).allow(null, ""),
    tags: Joi.array().items(Joi.string().trim().max(40)).max(20),
    lifecycleStage,
    leadStatus,
    ownerId: Joi.string().hex().length(24).allow(null, ""),
    acquisitionSource,
    preferredChannel: contactChannel.allow(null, ""),
    nextFollowUpAt: Joi.date().iso().allow(null, ""),
    lastContactedAt: Joi.date().iso().allow(null, ""),
    customFields: Joi.object().max(100),
  })
    .min(1)
    .options({ stripUnknown: true }),
};
