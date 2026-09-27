import mongoose, { Document, Schema, Types } from "mongoose";

export type CrmFieldEntity =
  | "contacts"
  | "accounts"
  | "opportunities"
  | "activities";
export type CrmFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "single_select"
  | "multi_select"
  | "file"
  | "image"
  | "signature";

export interface ICrmFieldOption {
  id: string;
  label: string;
  order: number;
}

export interface ICrmFieldDefinition extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  entityType: CrmFieldEntity;
  key: string;
  label: string;
  type: CrmFieldType;
  options: ICrmFieldOption[];
  isSystem: boolean;
  protected: boolean;
  required: boolean;
  visible: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  position: number;
  archivedAt?: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const crmFieldDefinitionSchema = new Schema<ICrmFieldDefinition>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ["contacts", "accounts", "opportunities", "activities"],
      required: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
      match: /^[a-z][a-z0-9_]*$/,
    },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    type: {
      type: String,
      enum: [
        "text",
        "number",
        "date",
        "boolean",
        "single_select",
        "multi_select",
        "file",
        "image",
        "signature",
      ],
      required: true,
    },
    options: {
      type: [
        new Schema<ICrmFieldOption>(
          {
            id: { type: String, required: true, trim: true, maxlength: 64 },
            label: { type: String, required: true, trim: true, maxlength: 80 },
            order: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    isSystem: { type: Boolean, default: false },
    protected: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
    defaultValue: { type: Schema.Types.Mixed, default: null },
    placeholder: { type: String, trim: true, maxlength: 120 },
    position: { type: Number, required: true, min: 0 },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

crmFieldDefinitionSchema.index(
  { organizationId: 1, entityType: 1, key: 1 },
  { unique: true },
);
crmFieldDefinitionSchema.index({
  organizationId: 1,
  entityType: 1,
  archivedAt: 1,
  position: 1,
});

export const CrmFieldDefinition = mongoose.model<ICrmFieldDefinition>(
  "CrmFieldDefinition",
  crmFieldDefinitionSchema,
);
