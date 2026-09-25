import mongoose, { Document, Schema, Types } from "mongoose";

export type AccountLifecycleStage =
  | "prospect"
  | "qualified"
  | "customer"
  | "inactive"
  | "lost";

export interface IAccountNote {
  id: string;
  authorId?: Types.ObjectId | null;
  authorName: string;
  content: string;
  createdAt: Date;
}

export interface IAccount extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  normalizedName: string;
  website?: string;
  domain?: string;
  industry?: string;
  description?: string;
  phone?: string;
  ownerId?: Types.ObjectId | null;
  tags: string[];
  lifecycleStage: AccountLifecycleStage;
  notes: IAccountNote[];
  metadata: Record<string, unknown>;
  customFields: Record<string, unknown>;
  lastActivityAt: Date;
  archivedAt?: Date | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    website: { type: String, trim: true, maxlength: 500 },
    domain: { type: String, trim: true, lowercase: true, maxlength: 255 },
    industry: { type: String, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 4000 },
    phone: { type: String, trim: true, maxlength: 40 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    lifecycleStage: {
      type: String,
      enum: ["prospect", "qualified", "customer", "inactive", "lost"],
      default: "prospect",
    },
    notes: {
      type: [
        new Schema<IAccountNote>(
          {
            id: { type: String, required: true },
            authorId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              default: null,
            },
            authorName: { type: String, required: true, trim: true },
            content: {
              type: String,
              required: true,
              trim: true,
              maxlength: 2000,
            },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    customFields: { type: Map, of: Schema.Types.Mixed, default: {} },
    lastActivityAt: { type: Date, default: Date.now },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

accountSchema.index({ organizationId: 1, normalizedName: 1 });
accountSchema.index({ organizationId: 1, domain: 1 });
accountSchema.index({ organizationId: 1, ownerId: 1 });
accountSchema.index({ organizationId: 1, tags: 1 });
accountSchema.index({ organizationId: 1, archivedAt: 1, lastActivityAt: -1 });

export const Account = mongoose.model<IAccount>("Account", accountSchema);
