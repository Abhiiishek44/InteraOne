import { Router } from "express";
import { authenticate, requireRole, resolveOrganization, validateRequest } from "@shared/security/middleware";
import { AccountsController } from "./accounts.controller";
import { accountsSchema } from "./accounts.schema";

const router = Router();
router.use(authenticate, resolveOrganization, requireRole("agent"));
router.get("/", validateRequest(accountsSchema.list, "query"), AccountsController.list);
router.post("/", validateRequest(accountsSchema.create), AccountsController.create);
router.get("/:id", AccountsController.get);
router.patch("/:id", validateRequest(accountsSchema.update), AccountsController.update);
router.post("/:id/notes", validateRequest(accountsSchema.addNote), AccountsController.addNote);
router.post("/:id/archive", AccountsController.archive);

export default router;
