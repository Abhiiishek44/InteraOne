import { Router } from "express";
import {
  authenticate,
  requireRole,
  resolveOrganization,
  validateRequest,
} from "@shared/security/middleware";
import { OpportunitiesController } from "./opportunities.controller";
import { opportunitiesSchema } from "./opportunities.schema";

const router = Router();
router.use(authenticate, resolveOrganization, requireRole("agent"));

router.get("/pipeline", OpportunitiesController.getPipeline);
router.put(
  "/pipeline",
  requireRole("admin"),
  validateRequest(opportunitiesSchema.updatePipeline),
  OpportunitiesController.updatePipeline,
);
router.get("/", OpportunitiesController.list);
router.post(
  "/",
  validateRequest(opportunitiesSchema.create),
  OpportunitiesController.create,
);
router.patch(
  "/:id",
  validateRequest(opportunitiesSchema.update),
  OpportunitiesController.update,
);
router.delete("/:id", OpportunitiesController.remove);
router.patch(
  "/:id/priority",
  validateRequest(opportunitiesSchema.updatePriority),
  OpportunitiesController.updatePriority,
);
router.patch(
  "/:id/activities/:activityId/complete",
  OpportunitiesController.completeActivity,
);
router.patch(
  "/:id/activities/:activityId",
  validateRequest(opportunitiesSchema.updateNote),
  OpportunitiesController.updateNote,
);
router.delete(
  "/:id/activities/:activityId",
  OpportunitiesController.deleteNote,
);
router.patch(
  "/:id/stage",
  validateRequest(opportunitiesSchema.updateStage),
  OpportunitiesController.updateStage,
);
router.patch(
  "/:id/color",
  validateRequest(opportunitiesSchema.updateColor),
  OpportunitiesController.updateColor,
);
router.patch(
  "/:id/move",
  validateRequest(opportunitiesSchema.move),
  OpportunitiesController.move,
);
router.patch(
  "/:id/next-action",
  validateRequest(opportunitiesSchema.updateNextAction),
  OpportunitiesController.updateNextAction,
);
router.post(
  "/:id/activities",
  validateRequest(opportunitiesSchema.addActivity),
  OpportunitiesController.addActivity,
);

export default router;
