import Joi from "joi";

const entityType = Joi.string().valid("contacts", "opportunities");

export const crmViewsSchema = {
  list: Joi.object({ entityType: entityType.required() }),
  create: Joi.object({
    entityType: entityType.required(),
    name: Joi.string().trim().min(1).max(60).required(),
    state: Joi.object().max(20).required(),
  }),
  update: Joi.object({
    name: Joi.string().trim().min(1).max(60),
    state: Joi.object().max(20),
  })
    .min(1)
    .options({ stripUnknown: true }),
};
