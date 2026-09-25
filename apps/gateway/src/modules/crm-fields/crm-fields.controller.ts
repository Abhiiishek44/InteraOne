import { Request, Response } from "express";
import { sendError, sendResponse } from "@shared/core/response";
import { AuthenticatedRequest } from "@shared/security/middleware";
import { CrmFieldEntity } from "@shared/models";
import { CrmFieldsService } from "./crm-fields.service";

const service = new CrmFieldsService();
const context = (req: Request) => (req as AuthenticatedRequest).user;
const fail = (res: Response, error: any) =>
  sendError(
    res,
    error?.code === 11000
      ? 409
      : error?.message === "CRM field not found"
        ? 404
        : 400,
    error.message || "CRM field operation failed",
  );

export class CrmFieldsController {
  static async list(req: Request, res: Response) {
    try {
      const fields = await service.list(
        context(req).activeOrganizationId,
        req.query.entityType as CrmFieldEntity,
      );
      sendResponse(res, 200, true, "CRM fields retrieved", { fields });
    } catch (error) {
      fail(res, error);
    }
  }
  static async create(req: Request, res: Response) {
    try {
      const user = context(req);
      const field = await service.create(
        user.activeOrganizationId,
        user.userId,
        req.body,
      );
      sendResponse(res, 201, true, "CRM field created", { field });
    } catch (error) {
      fail(res, error);
    }
  }
  static async update(req: Request, res: Response) {
    try {
      const field = await service.update(
        context(req).activeOrganizationId,
        String(req.params.id),
        req.body,
      );
      sendResponse(res, 200, true, "CRM field updated", { field });
    } catch (error) {
      fail(res, error);
    }
  }
  static async archive(req: Request, res: Response) {
    try {
      await service.archive(
        context(req).activeOrganizationId,
        String(req.params.id),
      );
      sendResponse(res, 200, true, "CRM field archived");
    } catch (error) {
      fail(res, error);
    }
  }
  static async reorder(req: Request, res: Response) {
    try {
      const fields = await service.reorder(
        context(req).activeOrganizationId,
        req.body.entityType,
        req.body.fieldIds,
      );
      sendResponse(res, 200, true, "CRM fields reordered", { fields });
    } catch (error) {
      fail(res, error);
    }
  }
}
