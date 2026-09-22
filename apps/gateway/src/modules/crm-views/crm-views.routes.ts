import { Router } from "express";
import {
  authenticate,
  requireRole,
  resolveOrganization,
  validateRequest,
} from "@shared/security/middleware";
import { CrmViewsController } from "./crm-views.controller";
import { crmViewsSchema } from "./crm-views.schema";

const router = Router();
router.use(authenticate, resolveOrganization, requireRole("agent"));

router.get(
  "/",
  validateRequest(crmViewsSchema.list, "query"),
  CrmViewsController.list,
);
router.post(
  "/",
  validateRequest(crmViewsSchema.create),
  CrmViewsController.create,
);
router.patch(
  "/:id",
  validateRequest(crmViewsSchema.update),
  CrmViewsController.update,
);
router.delete("/:id", CrmViewsController.remove);

export default router;
