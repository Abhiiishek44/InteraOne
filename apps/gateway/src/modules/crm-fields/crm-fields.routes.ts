import { Router } from "express";
import {
  authenticate,
  requireRole,
  resolveOrganization,
  validateRequest,
} from "@shared/security/middleware";
import { CrmFieldsController } from "./crm-fields.controller";
import { crmFieldsSchema } from "./crm-fields.schema";

const router = Router();
router.use(authenticate, resolveOrganization, requireRole("agent"));
router.get(
  "/",
  validateRequest(crmFieldsSchema.list, "query"),
  CrmFieldsController.list,
);
router.post(
  "/",
  requireRole("admin"),
  validateRequest(crmFieldsSchema.create),
  CrmFieldsController.create,
);
router.patch(
  "/reorder",
  requireRole("admin"),
  validateRequest(crmFieldsSchema.reorder),
  CrmFieldsController.reorder,
);
router.patch(
  "/:id",
  requireRole("admin"),
  validateRequest(crmFieldsSchema.update),
  CrmFieldsController.update,
);
router.delete("/:id", requireRole("admin"), CrmFieldsController.archive);
export default router;
