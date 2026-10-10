import Joi from "joi";

const lifecycleStage = Joi.string().valid(
  "prospect",
  "qualified",
  "customer",
  "inactive",
  "lost",
);

const accountFields = {
  name: Joi.string().trim().max(160),
  website: Joi.string()
    .trim()
    .uri({ scheme: ["http", "https"] })
    .max(500)
    .allow(""),
  industry: Joi.string().trim().max(120).allow(""),
  description: Joi.string().trim().max(4000).allow(""),
  phone: Joi.string().trim().max(40).allow(""),
  address: Joi.string().trim().max(500).allow(""),
  linkedinProfile: Joi.string()
    .trim()
    .uri({ scheme: ["http", "https"] })
    .max(500)
    .allow(""),
  annualRevenue: Joi.number().min(0).allow(null, ""),
  numberOfEmployees: Joi.number().integer().min(0).allow(null, ""),
  labels: Joi.array().items(Joi.string().trim().max(40)).max(30),
  ownerId: Joi.string().hex().length(24).allow(null, ""),
  tags: Joi.array().items(Joi.string().trim().max(40)).max(30),
  lifecycleStage,
  customFields: Joi.object().max(100),
};

export const accountsSchema = {
  list: Joi.object({
    q: Joi.string().trim().max(200).allow(""),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    lifecycleStage,
    ownerId: Joi.string().hex().length(24),
    includeArchived: Joi.boolean(),
  }),
  create: Joi.object({
    ...accountFields,
    name: accountFields.name.required(),
  }),
  update: Joi.object(accountFields).min(1).options({ stripUnknown: true }),
  addNote: Joi.object({
    content: Joi.string().trim().max(2000).required(),
  }),
  updateNote: Joi.object({
    content: Joi.string().trim().max(2000),
    pinned: Joi.boolean(),
  }).min(1),
  addActivity: Joi.object({
    title: Joi.string().trim().max(300).required(),
    content: Joi.string().allow("").max(20000),
    activityType: Joi.string()
      .valid("call", "meeting", "task", "deadline", "lunch")
      .required(),
    startAt: Joi.date().iso().required(),
    endAt: Joi.date().iso().min(Joi.ref("startAt")).required(),
    priority: Joi.string().valid("none", "low", "medium", "high").required(),
    status: Joi.string().valid("scheduled", "done").required(),
  }),
  updateActivityStatus: Joi.object({
    status: Joi.string().valid("scheduled", "done").required(),
  }),
  updateActivity: Joi.object({
    title: Joi.string().trim().max(300),
    content: Joi.string().allow("").max(20000),
    activityType: Joi.string().valid(
      "call",
      "meeting",
      "task",
      "deadline",
      "lunch",
    ),
    startAt: Joi.date().iso(),
    endAt: Joi.date().iso(),
    priority: Joi.string().valid("none", "low", "medium", "high"),
    status: Joi.string().valid("scheduled", "done"),
  }).min(1),
  addTimelineItem: Joi.object({
    type: Joi.string().valid("file", "document").required(),
    title: Joi.string().trim().max(300).required(),
    fileName: Joi.string().trim().max(300).required(),
    fileKey: Joi.string().trim().max(1000).required(),
    mimeType: Joi.string().trim().max(200).allow(""),
    size: Joi.number().integer().min(0),
  }),
  updateTimelineItem: Joi.object({
    content: Joi.string().allow("").max(20000).required(),
  }),
};
