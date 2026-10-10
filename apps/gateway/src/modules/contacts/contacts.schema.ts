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
  "facebook_lead_ads",
  "google_forms",
  "unknown",
);

export const contactsSchema = {
  listContactsQuery: Joi.object({
    q: Joi.string().trim().max(200).allow(""),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(300),
    lifecycleStage,
    leadStatus,
    acquisitionSource,
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
    content: Joi.string().trim().max(2000),
    pinned: Joi.boolean(),
  }).or("content", "pinned"),

  addTimelineItem: Joi.object({
    type: Joi.string().valid("file", "document").required(),
    title: Joi.string().trim().max(300).required(),
    fileName: Joi.string().trim().max(300).required(),
    fileKey: Joi.string().trim().max(1000).required(),
    mimeType: Joi.string().trim().max(200).allow(""),
    size: Joi.number().integer().min(0),
  }),

  addActivity: Joi.object({
    title: Joi.string().trim().max(300).required(),
    content: Joi.string().allow("").max(20000),
    activityType: Joi.string().valid("call", "meeting", "task", "deadline", "lunch").required(),
    startAt: Joi.date().iso().required(),
    endAt: Joi.date().iso().min(Joi.ref("startAt")).required(),
    priority: Joi.string().valid("none", "low", "medium", "normal", "high").required(),
    status: Joi.string().valid("scheduled", "done").required(),
    location: Joi.string().trim().max(500).allow(""),
    videoCallUrl: Joi.string().uri().max(1000).allow(""),
  }),

  updateActivityStatus: Joi.object({
    status: Joi.string().valid("scheduled", "done").required(),
  }),

  updateActivity: Joi.object({
    title: Joi.string().trim().max(300).required(),
    content: Joi.string().allow("").max(20000),
    activityType: Joi.string().valid("call", "meeting", "task", "deadline", "lunch").required(),
    startAt: Joi.date().iso().required(),
    endAt: Joi.date().iso().min(Joi.ref("startAt")).required(),
    priority: Joi.string().valid("none", "low", "medium", "normal", "high").required(),
    status: Joi.string().valid("scheduled", "done").required(),
    location: Joi.string().trim().max(500).allow(""),
    videoCallUrl: Joi.string().uri().max(1000).allow(""),
  }),

  updateTimelineItem: Joi.object({
    content: Joi.string().allow("").max(20000).required(),
  }),

  updateInsights: Joi.object({
    summary: Joi.string().trim().max(4000).required(),
    sentiment: Joi.string().valid("positive", "neutral", "negative").required(),
    topics: Joi.array().items(Joi.string().trim().max(100)).max(20).required(),
  }),

  sendContactEmail: Joi.object({
    subject: Joi.string().trim().max(300).required(),
    body: Joi.string().trim().max(20000).required(),
    html: Joi.string().max(50000).allow(""),
    from: Joi.string().email().allow(""),
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
