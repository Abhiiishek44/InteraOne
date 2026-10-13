import { Request, Response } from "express";
import { sendError, sendResponse } from "@shared/core/response";
import { AuthenticatedRequest } from "@shared/security/middleware/auth";
import { AccountsService } from "./accounts.service";

const service = new AccountsService();
const auth = (req: Request) => (req as AuthenticatedRequest).user;

export class AccountsController {
  static async list(req: Request, res: Response) {
    try {
      const result = await service.list(auth(req).activeOrganizationId, {
        search: String(req.query.q || ""),
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
        lifecycleStage: req.query.lifecycleStage as string | undefined,
        ownerId: req.query.ownerId as string | undefined,
        includeArchived: req.query.includeArchived === "true",
      });
      sendResponse(res, 200, true, "Organizations retrieved", result);
    } catch (error: any) {
      sendError(res, 500, error.message || "Failed to list organizations");
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const result = await service.get(
        auth(req).activeOrganizationId,
        String(req.params.id),
      );
      sendResponse(res, 200, true, "Organization retrieved", result);
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization not found" ? 404 : 500,
        error.message,
      );
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const user = auth(req);
      const account = await service.create(
        user.activeOrganizationId,
        user.userId,
        req.body,
      );
      sendResponse(res, 201, true, "Organization created", { account });
    } catch (error: any) {
      sendError(res, 400, error.message || "Failed to create organization");
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const account = await service.update(
        auth(req).activeOrganizationId,
        String(req.params.id),
        req.body,
      );
      sendResponse(res, 200, true, "Organization updated", { account });
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization not found" ? 404 : 400,
        error.message,
      );
    }
  }

  static async addNote(req: Request, res: Response) {
    try {
      const user = auth(req);
      const note = await service.addNote(
        user.activeOrganizationId,
        String(req.params.id),
        user,
        req.body.content,
      );
      sendResponse(res, 201, true, "Organization note added", { note });
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization not found" ? 404 : 400,
        error.message,
      );
    }
  }

  static async updateNote(req: Request, res: Response) {
    try {
      const note = await service.updateNote(
        auth(req).activeOrganizationId,
        String(req.params.id),
        String(req.params.noteId),
        req.body,
      );
      sendResponse(res, 200, true, "Organization note updated", { note });
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization note not found" ? 404 : 400,
        error.message,
      );
    }
  }

  static async deleteNote(req: Request, res: Response) {
    try {
      await service.deleteNote(
        auth(req).activeOrganizationId,
        String(req.params.id),
        String(req.params.noteId),
      );
      sendResponse(res, 200, true, "Organization note deleted");
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization note not found" ? 404 : 400,
        error.message,
      );
    }
  }

  static async addActivity(req: Request, res: Response) {
    try {
      const user = auth(req);
      const item = await service.addActivity(
        user.activeOrganizationId,
        String(req.params.id),
        user.email || "Agent",
        req.body,
      );
      sendResponse(res, 201, true, "Organization activity scheduled", { item });
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization not found" ? 404 : 400,
        error.message || "Failed to schedule activity",
      );
    }
  }

  static async updateActivityStatus(req: Request, res: Response) {
    try {
      const item = await service.updateActivityStatus(
        auth(req).activeOrganizationId,
        String(req.params.id),
        String(req.params.activityId),
        req.body.status,
      );
      sendResponse(res, 200, true, "Organization activity updated", { item });
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization activity not found" ? 404 : 400,
        error.message || "Failed to update activity",
      );
    }
  }

  static async updateActivity(req: Request, res: Response) {
    try {
      const item = await service.updateActivity(
        auth(req).activeOrganizationId,
        String(req.params.id),
        String(req.params.activityId),
        req.body,
      );
      sendResponse(res, 200, true, "Organization activity updated", { item });
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization activity not found" ? 404 : 400,
        error.message,
      );
    }
  }

  static async deleteActivity(req: Request, res: Response) {
    try {
      await service.deleteActivity(
        auth(req).activeOrganizationId,
        String(req.params.id),
        String(req.params.activityId),
      );
      sendResponse(res, 200, true, "Organization activity deleted");
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization activity not found" ? 404 : 400,
        error.message,
      );
    }
  }

  static async addTimelineItem(req: Request, res: Response) {
    try {
      const user = auth(req);
      const item = await service.addTimelineItem(
        user.activeOrganizationId,
        String(req.params.id),
        user.email || "Agent",
        req.body,
      );
      sendResponse(res, 201, true, "Organization file added", { item });
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization not found" ? 404 : 400,
        error.message || "Failed to add file",
      );
    }
  }

  static async updateTimelineItem(req: Request, res: Response) {
    try {
      const item = await service.updateTimelineItem(
        auth(req).activeOrganizationId,
        String(req.params.id),
        String(req.params.itemId),
        req.body.content,
      );
      sendResponse(res, 200, true, "Organization file updated", { item });
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization timeline item not found" ? 404 : 400,
        error.message,
      );
    }
  }

  static async deleteTimelineItem(req: Request, res: Response) {
    try {
      await service.deleteTimelineItem(
        auth(req).activeOrganizationId,
        String(req.params.id),
        String(req.params.itemId),
      );
      sendResponse(res, 200, true, "Organization file deleted");
    } catch (error: any) {
      sendError(
        res,
        error.message === "Organization timeline item not found" ? 404 : 400,
        error.message,
      );
    }
  }
}
