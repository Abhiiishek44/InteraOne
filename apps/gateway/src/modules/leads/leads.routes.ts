import { Router } from "express";
import {
  authenticate,
  requireRole,
  resolveOrganization,
  validateRequest,
} from "@shared/security/middleware";
import { LeadsController } from "./leads.controller";
import { leadsSchema } from "./leads.schema";

const router = Router();
router.use(authenticate, resolveOrganization, requireRole("agent"));

router.get("/", LeadsController.list);
router.post("/", validateRequest(leadsSchema.create), LeadsController.create);
router.post("/:id/convert-to-deal", LeadsController.convertToDeal);
router.patch(
  "/:id",
  validateRequest(leadsSchema.update),
  LeadsController.update,
);
router.delete("/:id", LeadsController.remove);
router.patch(
  "/:id/stage",
  validateRequest(leadsSchema.updateStage),
  LeadsController.updateStage,
);
router.patch(
  "/:id/color",
  validateRequest(leadsSchema.updateColor),
  LeadsController.updateColor,
);
router.patch(
  "/:id/priority",
  validateRequest(leadsSchema.updatePriority),
  LeadsController.updatePriority,
);
router.patch(
  "/:id/move",
  validateRequest(leadsSchema.move),
  LeadsController.move,
);
router.patch(
  "/:id/next-action",
  validateRequest(leadsSchema.updateNextAction),
  LeadsController.updateNextAction,
);
router.post(
  "/:id/activities",
  validateRequest(leadsSchema.addActivity),
  LeadsController.addActivity,
);
router.patch(
  "/:id/activities/:activityId/complete",
  LeadsController.completeActivity,
);
router.patch(
  "/:id/activities/:activityId",
  validateRequest(leadsSchema.updateActivity),
  LeadsController.updateActivity,
);
router.delete("/:id/activities/:activityId", LeadsController.deleteActivity);

export default router;
