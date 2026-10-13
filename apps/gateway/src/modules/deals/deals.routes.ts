import { Router } from "express";
import {
  authenticate,
  requireRole,
  resolveOrganization,
  validateRequest,
} from "@shared/security/middleware";
import { DealsController } from "./deals.controller";
import { dealsSchema } from "./deals.schema";

const router = Router();
router.use(authenticate, resolveOrganization, requireRole("agent"));

router.get("/pipeline", DealsController.getPipeline);
router.put(
  "/pipeline",
  requireRole("admin"),
  validateRequest(dealsSchema.updatePipeline),
  DealsController.updatePipeline,
);
router.get("/", DealsController.list);
router.post("/", validateRequest(dealsSchema.create), DealsController.create);
router.patch(
  "/:id",
  validateRequest(dealsSchema.update),
  DealsController.update,
);
router.delete("/:id", DealsController.remove);
router.patch(
  "/:id/stage",
  validateRequest(dealsSchema.updateStage),
  DealsController.updateStage,
);
router.patch(
  "/:id/color",
  validateRequest(dealsSchema.updateColor),
  DealsController.updateColor,
);
router.patch(
  "/:id/priority",
  validateRequest(dealsSchema.updatePriority),
  DealsController.updatePriority,
);
router.patch(
  "/:id/move",
  validateRequest(dealsSchema.move),
  DealsController.move,
);
router.patch(
  "/:id/next-action",
  validateRequest(dealsSchema.updateNextAction),
  DealsController.updateNextAction,
);
router.post(
  "/:id/activities",
  validateRequest(dealsSchema.addActivity),
  DealsController.addActivity,
);
router.patch(
  "/:id/activities/:activityId/complete",
  DealsController.completeActivity,
);
router.patch(
  "/:id/activities/:activityId",
  validateRequest(dealsSchema.updateActivity),
  DealsController.updateActivity,
);
router.delete("/:id/activities/:activityId", DealsController.deleteActivity);

export default router;
