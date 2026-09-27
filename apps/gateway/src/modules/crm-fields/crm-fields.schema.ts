import Joi from "joi";

const entityType = Joi.string().valid(
  "contacts",
  "accounts",
  "opportunities",
  "activities",
);
const fieldType = Joi.string().valid(
  "text",
  "number",
  "date",
  "boolean",
  "single_select",
  "multi_select",
  "file",
  "image",
  "signature",
);
const option = Joi.object({
  id: Joi.string().trim().max(64),
  label: Joi.string().trim().min(1).max(80).required(),
});

export const crmFieldsSchema = {
  list: Joi.object({ entityType: entityType.required() }),
  create: Joi.object({
    entityType: entityType.required(),
    label: Joi.string().trim().min(1).max(80).required(),
    type: fieldType.required(),
    required: Joi.boolean().default(false),
    visible: Joi.boolean().default(true),
    defaultValue: Joi.any().allow(null),
    placeholder: Joi.string().trim().max(120).allow(""),
    position: Joi.number().integer().min(0),
    options: Joi.array().items(option).max(100).default([]),
  }),
  update: Joi.object({
    label: Joi.string().trim().min(1).max(80),
    type: fieldType,
    required: Joi.boolean(),
    visible: Joi.boolean(),
    defaultValue: Joi.any().allow(null),
    placeholder: Joi.string().trim().max(120).allow(""),
    options: Joi.array().items(option).max(100),
  }).min(1),
  reorder: Joi.object({
    entityType: entityType.required(),
    fieldIds: Joi.array()
      .items(Joi.string().hex().length(24))
      .max(100)
      .required(),
  }),
};
