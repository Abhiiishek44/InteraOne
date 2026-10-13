import type { Request, Response } from "express";
import { sendError, sendResponse } from "@shared/core/response";
import type { AuthenticatedRequest } from "@shared/security/middleware/auth";
import { CrmRecordsController } from "@modules/crm-records/crm-records.controller";
import { DealsService } from "./deals.service";

const service = new DealsService();
const records = new CrmRecordsController(service, "Deal", "deals");
const getOrgId = (req: Request) =>
  (req as AuthenticatedRequest).user.activeOrganizationId;

export class DealsController {
  static list = records.list;
  static create = records.create;
  static update = records.update;
  static remove = records.remove;
  static updateStage = records.updateStage;
  static updateColor = records.updateColor;
  static updatePriority = records.updatePriority;
  static updateNextAction = records.updateNextAction;
  static move = records.move;
  static addActivity = records.addActivity;
  static completeActivity = records.completeActivity;
  static updateActivity = records.updateActivity;
  static deleteActivity = records.deleteActivity;

  static async getPipeline(req: Request, res: Response) {
    try {
      const pipeline = await service.getPipeline(getOrgId(req));
      sendResponse(res, 200, true, "Pipeline retrieved", { pipeline });
    } catch (error: unknown) {
      sendError(
        res,
        500,
        error instanceof Error ? error.message : "Failed to retrieve pipeline",
      );
    }
  }

  static async updatePipeline(req: Request, res: Response) {
    try {
      const pipeline = await service.updatePipeline(getOrgId(req), req.body);
      sendResponse(res, 200, true, "Pipeline updated", { pipeline });
    } catch (error: unknown) {
      sendError(
        res,
        400,
        error instanceof Error ? error.message : "Failed to update pipeline",
      );
    }
  }
}
