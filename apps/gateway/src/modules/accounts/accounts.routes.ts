import { Router } from "express";
import {
  authenticate,
  requireRole,
  resolveOrganization,
  validateRequest,
} from "@shared/security/middleware";
import { AccountsController } from "./accounts.controller";
import { accountsSchema } from "./accounts.schema";

const router = Router();
router.use(authenticate, resolveOrganization, requireRole("agent"));
router.get(
  "/",
  validateRequest(accountsSchema.list, "query"),
  AccountsController.list,
);
router.post(
  "/",
  validateRequest(accountsSchema.create),
  AccountsController.create,
);
router.get("/:id", AccountsController.get);
router.patch(
  "/:id",
  validateRequest(accountsSchema.update),
  AccountsController.update,
);
router.post(
  "/:id/notes",
  validateRequest(accountsSchema.addNote),
  AccountsController.addNote,
);
router.patch(
  "/:id/notes/:noteId",
  validateRequest(accountsSchema.updateNote),
  AccountsController.updateNote,
);
router.delete("/:id/notes/:noteId", AccountsController.deleteNote);
router.post(
  "/:id/activities",
  validateRequest(accountsSchema.addActivity),
  AccountsController.addActivity,
);
router.patch(
  "/:id/activities/:activityId",
  validateRequest(accountsSchema.updateActivity),
  AccountsController.updateActivity,
);
router.patch(
  "/:id/activities/:activityId/status",
  validateRequest(accountsSchema.updateActivityStatus),
  AccountsController.updateActivityStatus,
);
router.delete("/:id/activities/:activityId", AccountsController.deleteActivity);
router.post(
  "/:id/timeline",
  validateRequest(accountsSchema.addTimelineItem),
  AccountsController.addTimelineItem,
);
router.patch(
  "/:id/timeline/:itemId",
  validateRequest(accountsSchema.updateTimelineItem),
  AccountsController.updateTimelineItem,
);
router.delete("/:id/timeline/:itemId", AccountsController.deleteTimelineItem);
router.post("/:id/archive", AccountsController.archive);

export default router;
