import mongoose, { Document, Schema, Types } from "mongoose";

export type CrmSavedViewEntity = "contacts" | "opportunities";

export interface ICrmSavedView extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  ownerId: Types.ObjectId;
  entityType: CrmSavedViewEntity;
  name: string;
  state: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const crmSavedViewSchema = new Schema<ICrmSavedView>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    entityType: {
      type: String,
      enum: ["contacts", "opportunities"],
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    state: { type: Schema.Types.Mixed, required: true, default: {} },
  },
  { timestamps: true },
);

crmSavedViewSchema.index(
  { organizationId: 1, ownerId: 1, entityType: 1, name: 1 },
  { unique: true },
);
crmSavedViewSchema.index({ organizationId: 1, ownerId: 1, entityType: 1 });

export const CrmSavedView = mongoose.model<ICrmSavedView>(
  "CrmSavedView",
  crmSavedViewSchema,
);
