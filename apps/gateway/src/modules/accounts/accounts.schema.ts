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
};
