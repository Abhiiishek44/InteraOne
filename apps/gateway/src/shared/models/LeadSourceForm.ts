import mongoose, { Document, Schema, Types } from "mongoose";
import type { LeadSourceProvider } from "./LeadSourceConnection";

export interface ILeadSourceFormDefaults {
  ownerId?: Types.ObjectId | null;
  tags: string[];
  lifecycleStage: "new" | "qualified";
  leadStatus: "needs_review" | "contacted" | "follow_up";
  createOpportunity: boolean;
  opportunityStage?: string;
  opportunityTitle?: string;
}

export interface ILeadSourceForm extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  connectionId: Types.ObjectId;
  provider: LeadSourceProvider;
  externalFormId: string;
  externalFormName: string;
  status: "active" | "paused";
  fieldMappings: Record<string, string>;
  defaults: ILeadSourceFormDefaults;
  createdAt: Date;
  updatedAt: Date;
}

const leadSourceFormSchema = new Schema<ILeadSourceForm>(
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
    provider: {
      type: String,
      enum: ["facebook_lead_ads", "google_forms"],
      required: true,
    },
    externalFormId: { type: String, required: true, trim: true },
    externalFormName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "paused"],
      default: "active",
    },
    fieldMappings: { type: Schema.Types.Mixed, default: {} },
    defaults: {
      ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
      tags: { type: [String], default: ["facebook-lead"] },
      lifecycleStage: {
        type: String,
        enum: ["new", "qualified"],
        default: "new",
      },
      leadStatus: {
        type: String,
        enum: ["needs_review", "contacted", "follow_up"],
        default: "needs_review",
      },
      createOpportunity: { type: Boolean, default: false },
      opportunityStage: { type: String, trim: true },
      opportunityTitle: { type: String, trim: true, maxlength: 160 },
    },
  },
  { timestamps: true },
);

leadSourceFormSchema.index(
  { connectionId: 1, externalFormId: 1 },
  { unique: true, name: "unique_external_form_per_connection" },
);

export const LeadSourceForm = mongoose.model<ILeadSourceForm>(
  "LeadSourceForm",
  leadSourceFormSchema,
);
