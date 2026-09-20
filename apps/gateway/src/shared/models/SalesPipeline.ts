import mongoose, { Document, Schema, Types } from "mongoose";

export type PipelineStageType = "open" | "won" | "lost";
export type PipelineStageColor =
  | "slate"
  | "blue"
  | "violet"
  | "amber"
  | "orange"
  | "emerald"
  | "rose";

export interface IPipelineStage {
  id: string;
  label: string;
  color: PipelineStageColor;
  type: PipelineStageType;
  order: number;
}

export interface ISalesPipeline extends Document {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  stages: IPipelineStage[];
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_PIPELINE_STAGES: IPipelineStage[] = [
  {
    id: "qualified",
    label: "Qualified",
    color: "slate",
    type: "open",
    order: 0,
  },
  {
    id: "discovery",
    label: "Discovery",
    color: "blue",
    type: "open",
    order: 1,
  },
  { id: "demo", label: "Demo", color: "violet", type: "open", order: 2 },
  { id: "proposal", label: "Proposal", color: "amber", type: "open", order: 3 },
  {
    id: "negotiation",
    label: "Negotiation",
    color: "orange",
    type: "open",
    order: 4,
  },
  { id: "won", label: "Won", color: "emerald", type: "won", order: 5 },
  { id: "lost", label: "Lost", color: "rose", type: "lost", order: 6 },
];

const pipelineStageSchema = new Schema<IPipelineStage>(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      match: /^[a-z0-9][a-z0-9-]*$/,
    },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    color: {
      type: String,
      enum: ["slate", "blue", "violet", "amber", "orange", "emerald", "rose"],
      required: true,
    },
    type: { type: String, enum: ["open", "won", "lost"], required: true },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const salesPipelineSchema = new Schema<ISalesPipeline>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      default: "Sales pipeline",
    },
    stages: { type: [pipelineStageSchema], required: true },
  },
  { timestamps: true },
);

export const SalesPipeline = mongoose.model<ISalesPipeline>(
  "SalesPipeline",
  salesPipelineSchema,
);
