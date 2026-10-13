import Joi from "joi";
import { crmRecordsSchema } from "@modules/crm-records";

export const dealsSchema = {
  ...crmRecordsSchema,
  create: crmRecordsSchema.create.keys({ recordType: Joi.forbidden() }),
};
