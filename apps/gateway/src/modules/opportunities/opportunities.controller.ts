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

  static async update(req: Request, res: Response) {
    try {
      const opportunity = await service.update(
        getOrgId(req),
        req.params.id as string,
        req.body,
      );
      sendResponse(res, 200, true, "Opportunity updated", { opportunity });
    } catch (error: any) {
      const status = error.message === "Opportunity not found" ? 404 : 400;
      sendError(res, status, error.message || "Failed to update opportunity");
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      await service.remove(getOrgId(req), req.params.id as string);
      sendResponse(res, 200, true, "Opportunity deleted");
    } catch (error: any) {
      const status = error.message === "Opportunity not found" ? 404 : 400;
      sendError(res, status, error.message || "Failed to delete opportunity");
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

  static async move(req: Request, res: Response) {
    try {
      const opportunity = await service.move(
        getOrgId(req),
        req.params.id as string,
        req.body.stage,
        req.body.position,
      );
      sendResponse(res, 200, true, "Opportunity moved", { opportunity });
    } catch (error: any) {
      const status = error.message === "Opportunity not found" ? 404 : 400;
      sendError(res, status, error.message || "Failed to move opportunity");
    }
  }

  static async updateNextAction(req: Request, res: Response) {
    try {
      const opportunity = await service.updateNextAction(
        getOrgId(req),
        req.params.id as string,
        req.body.nextAction,
      );
      sendResponse(res, 200, true, "Next action updated", { opportunity });
    } catch (error: any) {
      const status = error.message === "Opportunity not found" ? 404 : 400;
      sendError(res, status, error.message || "Failed to update next action");
    }
  }

  static async addActivity(req: Request, res: Response) {
    try {
      const activity = await service.addActivity(
        getOrgId(req),
        req.params.id as string,
        req.body.content,
        req.body.dueAt,
        req.body.category,
      );
      sendResponse(res, 201, true, "Activity recorded", { activity });
    } catch (error: any) {
      const status = error.message === "Opportunity not found" ? 404 : 400;
      sendError(res, status, error.message || "Failed to record activity");
    }
  }

  static async updatePriority(req: Request, res: Response) {
    try {
      const opportunity = await service.updatePriority(
        getOrgId(req),
        req.params.id as string,
        req.body.priority,
      );
      sendResponse(res, 200, true, "Priority updated", { opportunity });
    } catch (error: any) {
      const status = error.message === "Opportunity not found" ? 404 : 400;
      sendError(res, status, error.message || "Failed to update priority");
    }
  }

  static async completeActivity(req: Request, res: Response) {
    try {
      const opportunity = await service.completeActivity(
        getOrgId(req),
        req.params.id as string,
        req.params.activityId as string,
      );
      sendResponse(res, 200, true, "Activity completed", { opportunity });
    } catch (error: any) {
      const status = error.message === "Activity not found" ? 404 : 400;
      sendError(res, status, error.message || "Failed to complete activity");
    }
  }

  static async updateNote(req: Request, res: Response) {
    try {
      const activity = await service.updateNote(
        getOrgId(req),
        req.params.id as string,
        req.params.activityId as string,
        req.body.content,
      );
      sendResponse(res, 200, true, "Opportunity note updated", { activity });
    } catch (error: any) {
      const status = error.message === "Opportunity note not found" ? 404 : 400;
      sendError(
        res,
        status,
        error.message || "Failed to update opportunity note",
      );
    }
  }

  static async deleteNote(req: Request, res: Response) {
    try {
      await service.deleteNote(
        getOrgId(req),
        req.params.id as string,
        req.params.activityId as string,
      );
      sendResponse(res, 200, true, "Opportunity note deleted");
    } catch (error: any) {
      const status = error.message === "Opportunity note not found" ? 404 : 400;
      sendError(
        res,
        status,
        error.message || "Failed to delete opportunity note",
      );
    }
  }
}
