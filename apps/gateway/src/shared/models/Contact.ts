import mongoose, { Document, Schema, Types } from "mongoose";
import { IOrganization } from "./Organization";

export type ContactSource = "ai" | "widget" | "agent" | "owner" | "admin";
export type ContactSentiment = "positive" | "neutral" | "negative";
export type ContactLifecycleStage =
  | "new"
  | "qualified"
  | "opportunity"
  | "customer"
  | "inactive"
  | "lost";
export type ContactLeadStatus =
  | "needs_review"
  | "contacted"
  | "follow_up"
  | "converted"
  | "unqualified";
export type ContactChannel =
  | "widget"
  | "email"
  | "whatsapp"
  | "telegram"
  | "phone";
export type ContactAcquisitionSource =
  | ContactChannel
  | "qr"
  | "manual"
  | "unknown";

export interface IContactNote {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
}

export interface IContactConversation {
  id: string;
  status: "open" | "resolved" | "closed";
  lastMessage: string;
  updatedAt: Date;
}

export interface IContactInsights {
  summary: string;
  sentiment: ContactSentiment;
  topics: string[];
}

export interface IContact extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId | IOrganization;
  sessionId: string;
  conversationId?: Types.ObjectId | null;
  accountId?: Types.ObjectId | null;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  tags: string[];
  source: ContactSource;
  lifecycleStage: ContactLifecycleStage;
  leadStatus: ContactLeadStatus;
  ownerId?: Types.ObjectId | null;
  acquisitionSource: ContactAcquisitionSource;
  preferredChannel?: ContactChannel | null;
  manualNextFollowUpAt?: Date | null;
  nextFollowUpAt?: Date | null;
  lastContactedAt?: Date | null;
  lastActivityAt: Date;
  notes: IContactNote[];
  conversations: IContactConversation[];
  insights: IContactInsights;
  metadata: Record<string, unknown>;
  customFields: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    sessionId: { type: String, required: true, trim: true },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true, maxlength: 40 },
    company: { type: String, trim: true, maxlength: 160 },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    source: {
      type: String,
      enum: ["ai", "widget", "agent", "owner", "admin"],
      default: "ai",
    },
    lifecycleStage: {
      type: String,
      enum: ["new", "qualified", "opportunity", "customer", "inactive", "lost"],
      default: "new",
    },
    leadStatus: {
      type: String,
      enum: [
        "needs_review",
        "contacted",
        "follow_up",
        "converted",
        "unqualified",
      ],
      default: "needs_review",
    },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    acquisitionSource: {
      type: String,
      enum: [
        "widget",
        "email",
        "whatsapp",
        "telegram",
        "phone",
        "qr",
        "manual",
        "unknown",
      ],
      default: "unknown",
    },
    preferredChannel: {
      type: String,
      enum: ["widget", "email", "whatsapp", "telegram", "phone", null],
      default: null,
    },
    manualNextFollowUpAt: { type: Date, default: null },
    nextFollowUpAt: { type: Date, default: null },
    lastContactedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    notes: [
      {
        id: { type: String, required: true },
        author: { type: String, required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    conversations: [
      {
        id: { type: String, required: true },
        status: {
          type: String,
          enum: ["open", "resolved", "closed"],
          default: "open",
        },
        lastMessage: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    insights: {
      summary: { type: String, default: "No insights yet." },
      sentiment: {
        type: String,
        enum: ["positive", "neutral", "negative"],
        default: "neutral",
      },
      topics: [{ type: String, trim: true, maxlength: 60 }],
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    customFields: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

contactSchema.index({ organizationId: 1, sessionId: 1 }, { unique: true });
contactSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true, sparse: true },
);
contactSchema.index({ organizationId: 1, lastActivityAt: -1 });
contactSchema.index({ organizationId: 1, lifecycleStage: 1, leadStatus: 1 });
contactSchema.index({ organizationId: 1, ownerId: 1, nextFollowUpAt: 1 });
contactSchema.index({ organizationId: 1, accountId: 1 });

export const Contact = mongoose.model<IContact>("Contact", contactSchema);
