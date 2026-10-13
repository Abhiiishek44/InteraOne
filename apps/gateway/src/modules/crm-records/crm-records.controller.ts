import type { Request, Response } from "express";
import { sendError, sendResponse } from "@shared/core/response";
import type { AuthenticatedRequest } from "@shared/security/middleware/auth";
import type { CrmRecordStage } from "@shared/models";
import type { ScopedCrmRecordsService } from "./scoped-crm-records.service";

const getOrgId = (req: Request) =>
  (req as AuthenticatedRequest).user.activeOrganizationId;

export class CrmRecordsController {
  constructor(
    private readonly service: ScopedCrmRecordsService,
    private readonly singular: "Lead" | "Deal",
    private readonly responseKey: "leads" | "deals",
  ) {}

  private fail(res: Response, error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    const status = /not found$/i.test(message) ? 404 : 400;
    sendError(res, status, message);
  }

  list = async (req: Request, res: Response) => {
    try {
      const records = await this.service.listRecords(getOrgId(req));
      sendResponse(res, 200, true, `${this.responseKey} retrieved`, {
        [this.responseKey]: records,
      });
    } catch (error: unknown) {
      this.fail(res, error, `Failed to list ${this.responseKey}`);
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const record = await this.service.createRecord(getOrgId(req), req.body);
      sendResponse(res, 201, true, `${this.singular} created`, {
        [this.singular.toLowerCase()]: record,
      });
    } catch (error: unknown) {
      this.fail(res, error, `Failed to create ${this.singular.toLowerCase()}`);
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const record = await this.service.updateRecord(
        getOrgId(req),
        req.params.id as string,
        req.body,
      );
      sendResponse(res, 200, true, `${this.singular} updated`, {
        [this.singular.toLowerCase()]: record,
      });
    } catch (error: unknown) {
      this.fail(res, error, `Failed to update ${this.singular.toLowerCase()}`);
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      await this.service.removeRecord(getOrgId(req), req.params.id as string);
      sendResponse(res, 200, true, `${this.singular} deleted`);
    } catch (error: unknown) {
      this.fail(res, error, `Failed to delete ${this.singular.toLowerCase()}`);
    }
  };

  updateStage = async (req: Request, res: Response) => {
    try {
      const record = await this.service.updateRecordStage(
        getOrgId(req),
        req.params.id as string,
        req.body.stage as CrmRecordStage,
      );
      sendResponse(res, 200, true, `${this.singular} stage updated`, {
        [this.singular.toLowerCase()]: record,
      });
    } catch (error: unknown) {
      this.fail(
        res,
        error,
        `Failed to update ${this.singular.toLowerCase()} stage`,
      );
    }
  };

  updateColor = async (req: Request, res: Response) => {
    try {
      const record = await this.service.updateRecordColor(
        getOrgId(req),
        req.params.id as string,
        req.body.color,
      );
      sendResponse(res, 200, true, `${this.singular} color updated`, {
        [this.singular.toLowerCase()]: record,
      });
    } catch (error: unknown) {
      this.fail(
        res,
        error,
        `Failed to update ${this.singular.toLowerCase()} color`,
      );
    }
  };

  updatePriority = async (req: Request, res: Response) => {
    try {
      const record = await this.service.updateRecordPriority(
        getOrgId(req),
        req.params.id as string,
        req.body.priority,
      );
      sendResponse(res, 200, true, `${this.singular} priority updated`, {
        [this.singular.toLowerCase()]: record,
      });
    } catch (error: unknown) {
      this.fail(
        res,
        error,
        `Failed to update ${this.singular.toLowerCase()} priority`,
      );
    }
  };

  updateNextAction = async (req: Request, res: Response) => {
    try {
      const record = await this.service.updateRecordNextAction(
        getOrgId(req),
        req.params.id as string,
        req.body.nextAction,
      );
      sendResponse(res, 200, true, "Next action updated", {
        [this.singular.toLowerCase()]: record,
      });
    } catch (error: unknown) {
      this.fail(res, error, "Failed to update next action");
    }
  };

  move = async (req: Request, res: Response) => {
    try {
      const record = await this.service.moveRecord(
        getOrgId(req),
        req.params.id as string,
        req.body.stage,
        req.body.position,
      );
      sendResponse(res, 200, true, `${this.singular} moved`, {
        [this.singular.toLowerCase()]: record,
      });
    } catch (error: unknown) {
      this.fail(res, error, `Failed to move ${this.singular.toLowerCase()}`);
    }
  };

  addActivity = async (req: Request, res: Response) => {
    try {
      const activity = await this.service.addRecordActivity(
        getOrgId(req),
        req.params.id as string,
        req.body.content,
        req.body.dueAt,
        req.body.category,
        req.body.customFields,
        req.body.durationMinutes,
      );
      sendResponse(res, 201, true, "Activity recorded", { activity });
    } catch (error: unknown) {
      this.fail(res, error, "Failed to record activity");
    }
  };

  completeActivity = async (req: Request, res: Response) => {
    try {
      const record = await this.service.completeRecordActivity(
        getOrgId(req),
        req.params.id as string,
        req.params.activityId as string,
      );
      sendResponse(res, 200, true, "Activity completed", {
        [this.singular.toLowerCase()]: record,
      });
    } catch (error: unknown) {
      this.fail(res, error, "Failed to complete activity");
    }
  };

  updateActivity = async (req: Request, res: Response) => {
    try {
      const activity = await this.service.updateRecordActivity(
        getOrgId(req),
        req.params.id as string,
        req.params.activityId as string,
        req.body,
      );
      sendResponse(res, 200, true, "Activity updated", { activity });
    } catch (error: unknown) {
      this.fail(res, error, "Failed to update activity");
    }
  };

  deleteActivity = async (req: Request, res: Response) => {
    try {
      await this.service.deleteRecordActivity(
        getOrgId(req),
        req.params.id as string,
        req.params.activityId as string,
      );
      sendResponse(res, 200, true, "Activity deleted");
    } catch (error: unknown) {
      this.fail(res, error, "Failed to delete activity");
    }
  };
}
