import mongoose, { Document, Schema, Types } from "mongoose";

export type OpportunityStage = string;
export type OpportunityColor =
  | "slate"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "cyan"
  | "blue"
  | "violet"
  | "pink"
  | "emerald";

export interface IOpportunityActivity {
  id: string;
  type: "note" | "status" | "planned" | "message";
  content: string;
  category?: "todo" | "email" | "call" | "meeting" | "document";
  dueAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
}

export interface IOpportunity extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  contactId?: Types.ObjectId | null;
  primaryContactId?: Types.ObjectId | null;
  accountId?: Types.ObjectId | null;
  title: string;
  company?: string;
  value: number;
  currency: "USD" | "INR" | "EUR" | "GBP";
  stage: OpportunityStage;
  color: OpportunityColor;
  position: number;
  priority: 1 | 2 | 3;
  ownerId?: Types.ObjectId | null;
  expectedCloseAt?: Date | null;
  nextAction?: string;
  activities: IOpportunityActivity[];
  createdAt: Date;
  updatedAt: Date;
}

const opportunitySchema = new Schema<IOpportunity>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    },
    primaryContactId: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      default: null,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    company: { type: String, trim: true, maxlength: 160 },
    value: { type: Number, min: 0, default: 0 },
    currency: {
      type: String,
      enum: ["USD", "INR", "EUR", "GBP"],
      default: "USD",
    },
    stage: {
      type: String,
      trim: true,
      maxlength: 64,
      default: "qualified",
    },
    color: {
      type: String,
      enum: [
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
      ],
      default: "slate",
    },
    position: { type: Number, min: 0, default: 0 },
    priority: { type: Number, enum: [1, 2, 3], default: 1 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expectedCloseAt: { type: Date, default: null },
    nextAction: { type: String, trim: true, maxlength: 500 },
    activities: {
      type: [
        new Schema<IOpportunityActivity>(
          {
            id: { type: String, required: true },
            type: {
              type: String,
              enum: ["note", "status", "planned", "message"],
              default: "note",
            },
            content: {
              type: String,
              required: true,
              trim: true,
              maxlength: 2000,
            },
            category: {
              type: String,
              enum: ["todo", "email", "call", "meeting", "document"],
              default: "todo",
            },
            dueAt: { type: Date, default: null },
            completedAt: { type: Date, default: null },
            createdAt: { type: Date, required: true, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

opportunitySchema.index({ organizationId: 1, stage: 1, updatedAt: -1 });
opportunitySchema.index({ organizationId: 1, contactId: 1 });
opportunitySchema.index({ organizationId: 1, primaryContactId: 1 });
opportunitySchema.index({ organizationId: 1, accountId: 1 });
opportunitySchema.index({ organizationId: 1, ownerId: 1 });

export const Opportunity = mongoose.model<IOpportunity>(
  "Opportunity",
  opportunitySchema,
);
