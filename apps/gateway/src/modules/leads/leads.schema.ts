import Joi from "joi";
import { crmRecordsSchema } from "@modules/crm-records";

export const leadsSchema = {
  ...crmRecordsSchema,
  create: crmRecordsSchema.create.keys({ recordType: Joi.forbidden() }),
};
