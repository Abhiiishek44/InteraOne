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
  pinned?: boolean;
  createdAt: Date;
}

export interface IAccountTimelineItem {
  id: string;
  type: "activity" | "file" | "document";
  title: string;
  content?: string;
  activityType?: "call" | "meeting" | "task" | "deadline" | "lunch";
  startAt?: Date;
  endAt?: Date;
  priority?: "none" | "low" | "medium" | "high";
  status?: "scheduled" | "done";
  fileName?: string;
  fileKey?: string;
  mimeType?: string;
  size?: number;
  author: string;
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
  address?: string;
  linkedinProfile?: string;
  annualRevenue?: number | null;
  numberOfEmployees?: number | null;
  labels: string[];
  ownerId?: Types.ObjectId | null;
  tags: string[];
  lifecycleStage: AccountLifecycleStage;
  notes: IAccountNote[];
  timelineItems: IAccountTimelineItem[];
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
    address: { type: String, trim: true, maxlength: 500 },
    linkedinProfile: { type: String, trim: true, maxlength: 500 },
    annualRevenue: { type: Number, min: 0, default: null },
    numberOfEmployees: { type: Number, min: 0, default: null },
    labels: [{ type: String, trim: true, maxlength: 40 }],
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
            pinned: { type: Boolean, default: false },
            createdAt: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    timelineItems: {
      type: [
        new Schema<IAccountTimelineItem>(
          {
            id: { type: String, required: true },
            type: {
              type: String,
              enum: ["activity", "file", "document"],
              required: true,
            },
            title: { type: String, required: true, trim: true, maxlength: 300 },
            content: { type: String, maxlength: 20000, default: "" },
            activityType: {
              type: String,
              enum: ["call", "meeting", "task", "deadline", "lunch"],
            },
            startAt: { type: Date },
            endAt: { type: Date },
            priority: {
              type: String,
              enum: ["none", "low", "medium", "high"],
              default: "none",
            },
            status: {
              type: String,
              enum: ["scheduled", "done"],
              default: "scheduled",
            },
            fileName: { type: String, trim: true, maxlength: 300 },
            fileKey: { type: String, trim: true, maxlength: 1000 },
            mimeType: { type: String, trim: true, maxlength: 200 },
            size: { type: Number, min: 0 },
            author: { type: String, required: true, trim: true },
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
