import Joi from "joi";

const crmTarget = Joi.string()
  .pattern(/^(name|email|phone|company|customFields\.[a-zA-Z0-9_-]+|ignore)$/)
  .messages({
    "string.pattern.base":
      "Mapping target must be a supported contact field, customFields.<key>, or ignore",
  });

export const leadSourcesSchema = {
  connectionParams: Joi.object({
    connectionId: Joi.string().hex().length(24).required(),
  }),
  formParams: Joi.object({
    formId: Joi.string().hex().length(24).required(),
  }),
  submissionParams: Joi.object({
    submissionId: Joi.string().hex().length(24).required(),
  }),
  updateForm: Joi.object({
    status: Joi.string().valid("active", "paused"),
    fieldMappings: Joi.object()
      .pattern(Joi.string().max(160), crmTarget)
      .max(100),
    defaults: Joi.object({
      ownerId: Joi.string().hex().length(24).allow(null, ""),
      tags: Joi.array().items(Joi.string().trim().max(40)).max(20),
      lifecycleStage: Joi.string().valid("new", "qualified"),
      leadStatus: Joi.string().valid("needs_review", "contacted", "follow_up"),
      createOpportunity: Joi.boolean(),
      opportunityStage: Joi.string().trim().max(64).allow(""),
      opportunityTitle: Joi.string().trim().max(160).allow(""),
    }),
  }).min(1),
  listSubmissions: Joi.object({
    status: Joi.string().valid("received", "processing", "completed", "failed"),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(25),
  }),
};
// Defines request-validation schemas for lead-source routes and mutations.
