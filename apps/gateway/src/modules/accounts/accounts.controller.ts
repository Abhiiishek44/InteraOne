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
      sendResponse(res, 200, true, "Companies retrieved", result);
    } catch (error: any) {
      sendError(res, 500, error.message || "Failed to list companies");
    }
  }

  static async get(req: Request, res: Response) {
    try {
      const result = await service.get(auth(req).activeOrganizationId, String(req.params.id));
      sendResponse(res, 200, true, "Company retrieved", result);
    } catch (error: any) {
      sendError(res, error.message === "Company not found" ? 404 : 500, error.message);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const user = auth(req);
      const account = await service.create(user.activeOrganizationId, user.userId, req.body);
      sendResponse(res, 201, true, "Company created", { account });
    } catch (error: any) {
      sendError(res, 400, error.message || "Failed to create company");
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const account = await service.update(auth(req).activeOrganizationId, String(req.params.id), req.body);
      sendResponse(res, 200, true, "Company updated", { account });
    } catch (error: any) {
      sendError(res, error.message === "Company not found" ? 404 : 400, error.message);
    }
  }

  static async archive(req: Request, res: Response) {
    try {
      await service.archive(auth(req).activeOrganizationId, String(req.params.id));
      sendResponse(res, 200, true, "Company archived");
    } catch (error: any) {
      sendError(res, error.message === "Company not found" ? 404 : 400, error.message);
    }
  }

  static async addNote(req: Request, res: Response) {
    try {
      const user = auth(req);
      const note = await service.addNote(user.activeOrganizationId, String(req.params.id), user, req.body.content);
      sendResponse(res, 201, true, "Company note added", { note });
    } catch (error: any) {
      sendError(res, error.message === "Company not found" ? 404 : 400, error.message);
    }
  }
}
