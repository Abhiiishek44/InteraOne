import { Request, Response } from "express";
import { sendError, sendResponse } from "@shared/core/response";
import { AuthenticatedRequest } from "@shared/security/middleware";
import { CrmSavedViewEntity } from "@shared/models";
import { CrmViewsService } from "./crm-views.service";

const service = new CrmViewsService();
const getContext = (req: Request) => (req as AuthenticatedRequest).user;

const handleError = (res: Response, error: any, fallback: string) => {
  const duplicate = error?.code === 11000;
  const missing = error?.message === "Saved view not found";
  sendError(
    res,
    duplicate ? 409 : missing ? 404 : 400,
    duplicate
      ? "A saved view with this name already exists"
      : error.message || fallback,
  );
};

export class CrmViewsController {
  static async list(req: Request, res: Response) {
    try {
      const { activeOrganizationId, userId } = getContext(req);
      const views = await service.list(
        activeOrganizationId,
        userId,
        req.query.entityType as CrmSavedViewEntity,
      );
      sendResponse(res, 200, true, "Saved views retrieved", { views });
    } catch (error: any) {
      handleError(res, error, "Failed to retrieve saved views");
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { activeOrganizationId, userId } = getContext(req);
      const view = await service.create(activeOrganizationId, userId, req.body);
      sendResponse(res, 201, true, "View saved", { view });
    } catch (error: any) {
      handleError(res, error, "Failed to save view");
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { activeOrganizationId, userId } = getContext(req);
      const view = await service.update(
        activeOrganizationId,
        userId,
        req.params.id as string,
        req.body,
      );
      sendResponse(res, 200, true, "Saved view updated", { view });
    } catch (error: any) {
      handleError(res, error, "Failed to update saved view");
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const { activeOrganizationId, userId } = getContext(req);
      await service.remove(
        activeOrganizationId,
        userId,
        req.params.id as string,
      );
      sendResponse(res, 200, true, "Saved view deleted");
    } catch (error: any) {
      handleError(res, error, "Failed to delete saved view");
    }
  }
}
