import type { Request, Response } from "express";
import { sendError, sendResponse } from "@shared/core/response";
import type { AuthenticatedRequest } from "@shared/security/middleware/auth";
import { CrmRecordsController } from "@modules/crm-records/crm-records.controller";
import { LeadsService } from "./leads.service";

const service = new LeadsService();
const records = new CrmRecordsController(service, "Lead", "leads");
const getOrgId = (req: Request) =>
  (req as AuthenticatedRequest).user.activeOrganizationId;

export class LeadsController {
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

  static async convertToDeal(req: Request, res: Response) {
    try {
      const deal = await service.convertToDealRecord(
        getOrgId(req),
        req.params.id as string,
      );
      sendResponse(res, 200, true, "Lead converted to deal", { deal });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to convert lead";
      sendError(res, message === "Lead not found" ? 404 : 400, message);
    }
  }
}
