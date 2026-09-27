import mongoose, { Document, Schema, Types } from "mongoose";
import type { LeadSourceProvider } from "./LeadSourceConnection";

export type LeadSubmissionStatus =
  | "received"
  | "processing"
  | "completed"
  | "failed";

export interface ILeadSubmission extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  connectionId: Types.ObjectId;
  formId?: Types.ObjectId | null;
  provider: LeadSourceProvider;
  externalSubmissionId: string;
  externalFormId: string;
  submittedAt?: Date | null;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown> | null;
  status: LeadSubmissionStatus;
  contactId?: Types.ObjectId | null;
  opportunityId?: Types.ObjectId | null;
  attempts: number;
  lastError?: string | null;
  processedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const leadSubmissionSchema = new Schema<ILeadSubmission>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    connectionId: {
      type: Schema.Types.ObjectId,
      ref: "LeadSourceConnection",
      required: true,
      index: true,
    },
    formId: {
      type: Schema.Types.ObjectId,
      ref: "LeadSourceForm",
      default: null,
    },
    provider: {
      type: String,
      enum: ["facebook_lead_ads", "google_forms"],
      required: true,
    },
    externalSubmissionId: { type: String, required: true, trim: true },
    externalFormId: { type: String, required: true, trim: true },
    submittedAt: { type: Date, default: null },
    rawPayload: { type: Schema.Types.Mixed, required: true },
    normalizedPayload: { type: Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ["received", "processing", "completed", "failed"],
      default: "received",
      index: true,
    },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact", default: null },
    opportunityId: {
      type: Schema.Types.ObjectId,
      ref: "Opportunity",
      default: null,
    },
    attempts: { type: Number, min: 0, default: 0 },
    lastError: { type: String, default: null, maxlength: 2000 },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

leadSubmissionSchema.index(
  { organizationId: 1, provider: 1, externalSubmissionId: 1 },
  { unique: true, name: "unique_external_lead_submission" },
);
leadSubmissionSchema.index({ organizationId: 1, createdAt: -1 });

export const LeadSubmission = mongoose.model<ILeadSubmission>(
  "LeadSubmission",
  leadSubmissionSchema,
);
