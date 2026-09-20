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
  "/:id/stage",
  validateRequest(opportunitiesSchema.updateStage),
  OpportunitiesController.updateStage,
);
router.patch(
  "/:id/color",
  validateRequest(opportunitiesSchema.updateColor),
  OpportunitiesController.updateColor,
);

export default router;
