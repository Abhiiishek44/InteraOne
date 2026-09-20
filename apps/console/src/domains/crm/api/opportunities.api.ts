import { apiClient } from "@/shared/lib/api-client";
import type {
  CreateOpportunityPayload,
  Opportunity,
  OpportunityColor,
  OpportunityStage,
  SalesPipeline,
  UpdatePipelinePayload,
} from "../types/types";

interface OpportunitiesResponse {
  data: { opportunities: Opportunity[] };
}

interface PipelineResponse {
  data: { pipeline: SalesPipeline };
}

export const opportunitiesApi = {
  async list(): Promise<Opportunity[]> {
    const response =
      await apiClient.get<OpportunitiesResponse>("/opportunities");
    return response.data?.opportunities || [];
  },

  async getPipeline(): Promise<SalesPipeline> {
    const response = await apiClient.get<PipelineResponse>(
      "/opportunities/pipeline",
    );
    return response.data.pipeline;
  },

  async updatePipeline(payload: UpdatePipelinePayload): Promise<SalesPipeline> {
    const response = await apiClient.put<PipelineResponse>(
      "/opportunities/pipeline",
      payload,
    );
    return response.data.pipeline;
  },

  async create(payload: CreateOpportunityPayload): Promise<void> {
    await apiClient.post("/opportunities", payload);
  },

  async updateStage(id: string, stage: OpportunityStage): Promise<void> {
    await apiClient.patch(`/opportunities/${id}/stage`, { stage });
  },

  async updateColor(id: string, color: OpportunityColor): Promise<void> {
    await apiClient.patch(`/opportunities/${id}/color`, { color });
  },
};
