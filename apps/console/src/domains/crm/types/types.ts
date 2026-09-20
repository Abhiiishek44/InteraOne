export type OpportunityStage = string;
export type PipelineStageType = "open" | "won" | "lost";
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
export type PipelineStageColor =
  | "slate"
  | "blue"
  | "violet"
  | "amber"
  | "orange"
  | "emerald"
  | "rose";

export interface PipelineStage {
  id: string;
  label: string;
  color: PipelineStageColor;
  type: PipelineStageType;
  order: number;
}

export interface SalesPipeline {
  name: string;
  stages: PipelineStage[];
  isDefault: boolean;
}

export interface Opportunity {
  id: string;
  title: string;
  company?: string;
  value: number;
  currency: "USD" | "INR" | "EUR" | "GBP";
  stage: OpportunityStage;
  color: OpportunityColor;
  expectedCloseAt: string | null;
  nextAction: string;
  contact: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
  } | null;
  owner: {
    id: string;
    name: string;
    email?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePipelinePayload {
  name: string;
  stages: PipelineStage[];
}

export interface CreateOpportunityPayload {
  contactId: string;
  title: string;
  company?: string;
  value: number;
  currency: Opportunity["currency"];
  stage: OpportunityStage;
  ownerId?: string | null;
  expectedCloseAt?: string | null;
  nextAction?: string;
}
