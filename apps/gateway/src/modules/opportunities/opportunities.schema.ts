import Joi from "joi";

const stageId = Joi.string()
  .trim()
  .lowercase()
  .max(64)
  .pattern(/^[a-z0-9][a-z0-9-]*$/);

const pipelineStage = Joi.object({
  id: stageId.required(),
  label: Joi.string().trim().max(60).required(),
  color: Joi.string()
    .valid("slate", "blue", "violet", "amber", "orange", "emerald", "rose")
    .required(),
  type: Joi.string().valid("open", "won", "lost").required(),
  order: Joi.number().integer().min(0).required(),
});

export const opportunitiesSchema = {
  create: Joi.object({
    contactId: Joi.string().hex().length(24).required(),
    title: Joi.string().trim().max(160).required(),
    company: Joi.string().trim().max(160).allow(""),
    value: Joi.number().min(0).default(0),
    currency: Joi.string().valid("USD", "INR", "EUR", "GBP").default("USD"),
    stage: stageId,
    ownerId: Joi.string().hex().length(24).allow(null, ""),
    expectedCloseAt: Joi.date().iso().allow(null, ""),
    nextAction: Joi.string().trim().max(500).allow(""),
  }),
  updateStage: Joi.object({
    stage: stageId.required(),
  }),
  updateColor: Joi.object({
    color: Joi.string()
      .valid(
        "slate",
        "red",
        "orange",
        "amber",
        "yellow",
        "cyan",
        "blue",
        "violet",
        "pink",
        "emerald",
      )
      .required(),
  }),
  updatePipeline: Joi.object({
    name: Joi.string().trim().max(80).required(),
    stages: Joi.array()
      .items(pipelineStage)
      .min(3)
      .max(15)
      .unique("id")
      .custom((stages, helpers) => {
        const types = new Set(
          stages.map((stage: { type: string }) => stage.type),
        );
        if (!["open", "won", "lost"].every((type) => types.has(type))) {
          return helpers.error("any.custom", {
            message: "Pipeline requires open, won, and lost stage types",
          });
        }
        const labels = stages.map((stage: { label: string }) =>
          stage.label.trim().toLowerCase(),
        );
        if (new Set(labels).size !== labels.length) {
          return helpers.error("any.custom", {
            message: "Pipeline stage names must be unique",
          });
        }
        return stages;
      })
      .required(),
  }),
};
