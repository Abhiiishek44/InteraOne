import { Router } from "express";
import {
  authenticate,
  requireRole,
  resolveOrganization,
  validateRequest,
} from "@shared/security/middleware";
import { LeadSourcesController } from "./lead-sources.controller";
import { leadSourcesSchema } from "./lead-sources.schema";

export const leadSourcesRouter = Router();

leadSourcesRouter.get(
  "/facebook/callback",
  LeadSourcesController.completeFacebookOAuth,
);
leadSourcesRouter.get(
  "/google/callback",
  LeadSourcesController.completeGoogleOAuth,
);
leadSourcesRouter.get(
  "/facebook/webhook",
  LeadSourcesController.verifyFacebookWebhook,
);
leadSourcesRouter.post(
  "/facebook/webhook",
  LeadSourcesController.receiveFacebookWebhook,
);

leadSourcesRouter.use(authenticate, resolveOrganization);
leadSourcesRouter.get("/", requireRole("agent"), LeadSourcesController.list);
leadSourcesRouter.get(
  "/facebook/connect",
  requireRole("admin"),
  LeadSourcesController.beginFacebookOAuth,
);
leadSourcesRouter.get(
  "/google/connect",
  requireRole("admin"),
  LeadSourcesController.beginGoogleOAuth,
);
leadSourcesRouter.post(
  "/:connectionId/forms/sync",
  requireRole("admin"),
  validateRequest(leadSourcesSchema.connectionParams, "params"),
  LeadSourcesController.syncForms,
);
leadSourcesRouter.patch(
  "/forms/:formId",
  requireRole("admin"),
  validateRequest(leadSourcesSchema.formParams, "params"),
  validateRequest(leadSourcesSchema.updateForm),
  LeadSourcesController.updateForm,
);
leadSourcesRouter.delete(
  "/:connectionId",
  requireRole("admin"),
  validateRequest(leadSourcesSchema.connectionParams, "params"),
  LeadSourcesController.deleteConnection,
);
leadSourcesRouter.get(
  "/submissions",
  requireRole("agent"),
  validateRequest(leadSourcesSchema.listSubmissions, "query"),
  LeadSourcesController.listSubmissions,
);
leadSourcesRouter.post(
  "/submissions/:submissionId/retry",
  requireRole("admin"),
  validateRequest(leadSourcesSchema.submissionParams, "params"),
  LeadSourcesController.retrySubmission,
);
