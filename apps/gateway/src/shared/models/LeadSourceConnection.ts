import mongoose, { Document, Schema, Types } from "mongoose";

export type LeadSourceProvider = "facebook_lead_ads" | "google_forms";
export type LeadSourceConnectionStatus = "active" | "expired" | "error";

export interface ILeadSourceConnection extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  provider: LeadSourceProvider;
  name: string;
  status: LeadSourceConnectionStatus;
  externalAccountId: string;
  credentialsCiphertext: string;
  tokenExpiresAt?: Date | null;
  lastError?: string | null;
  metadata: Record<string, unknown>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const leadSourceConnectionSchema = new Schema<ILeadSourceConnection>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["facebook_lead_ads", "google_forms"],
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    status: {
      type: String,
      enum: ["active", "expired", "error"],
      default: "active",
    },
    externalAccountId: { type: String, required: true, trim: true },
    credentialsCiphertext: { type: String, required: true, select: false },
    tokenExpiresAt: { type: Date, default: null },
    lastError: { type: String, default: null, maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

leadSourceConnectionSchema.index(
  { provider: 1, externalAccountId: 1 },
  { unique: true, name: "unique_lead_source_account" },
);

export const LeadSourceConnection = mongoose.model<ILeadSourceConnection>(
  "LeadSourceConnection",
  leadSourceConnectionSchema,
);
