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

export interface IOpportunity extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  contactId: Types.ObjectId;
  title: string;
  company?: string;
  value: number;
  currency: "USD" | "INR" | "EUR" | "GBP";
  stage: OpportunityStage;
  color: OpportunityColor;
  ownerId?: Types.ObjectId | null;
  expectedCloseAt?: Date | null;
  nextAction?: string;
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
      required: true,
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
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    expectedCloseAt: { type: Date, default: null },
    nextAction: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

opportunitySchema.index({ organizationId: 1, stage: 1, updatedAt: -1 });
opportunitySchema.index({ organizationId: 1, contactId: 1 });
opportunitySchema.index({ organizationId: 1, ownerId: 1 });

export const Opportunity = mongoose.model<IOpportunity>(
  "Opportunity",
  opportunitySchema,
);
