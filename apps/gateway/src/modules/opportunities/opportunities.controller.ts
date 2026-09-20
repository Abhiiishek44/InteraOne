import { Request, Response } from "express";
import { sendError, sendResponse } from "@shared/core/response";
import { AuthenticatedRequest } from "@shared/security/middleware/auth";
import { OpportunitiesService } from "./opportunities.service";
import { OpportunityStage } from "@shared/models";

const service = new OpportunitiesService();
const getOrgId = (req: Request) =>
  (req as AuthenticatedRequest).user.activeOrganizationId;

export class OpportunitiesController {
  static async getPipeline(req: Request, res: Response) {
    try {
      const pipeline = await service.getPipeline(getOrgId(req));
      sendResponse(res, 200, true, "Pipeline retrieved", { pipeline });
    } catch (error: any) {
      sendError(res, 500, error.message || "Failed to retrieve pipeline");
    }
  }

  static async updatePipeline(req: Request, res: Response) {
    try {
      const pipeline = await service.updatePipeline(getOrgId(req), req.body);
      sendResponse(res, 200, true, "Pipeline updated", { pipeline });
    } catch (error: any) {
      sendError(res, 400, error.message || "Failed to update pipeline");
    }
  }

  static async list(req: Request, res: Response) {
    try {
      const opportunities = await service.list(getOrgId(req));
      sendResponse(res, 200, true, "Opportunities retrieved", {
        opportunities,
      });
    } catch (error: any) {
      sendError(res, 500, error.message || "Failed to list opportunities");
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const opportunity = await service.create(getOrgId(req), req.body);
      sendResponse(res, 201, true, "Opportunity created", { opportunity });
    } catch (error: any) {
      sendError(res, 400, error.message || "Failed to create opportunity");
    }
  }

  static async updateStage(req: Request, res: Response) {
    try {
      const opportunity = await service.updateStage(
        getOrgId(req),
        req.params.id as string,
        req.body.stage as OpportunityStage,
      );
      sendResponse(res, 200, true, "Opportunity stage updated", {
        opportunity,
      });
    } catch (error: any) {
      const status = error.message === "Opportunity not found" ? 404 : 400;
      sendError(
        res,
        status,
        error.message || "Failed to update opportunity stage",
      );
    }
  }

  static async updateColor(req: Request, res: Response) {
    try {
      const opportunity = await service.updateColor(
        getOrgId(req),
        req.params.id as string,
        req.body.color,
      );
      sendResponse(res, 200, true, "Opportunity color updated", {
        opportunity,
      });
    } catch (error: any) {
      const status = error.message === "Opportunity not found" ? 404 : 400;
      sendError(res, status, error.message || "Failed to update color");
    }
  }
}
