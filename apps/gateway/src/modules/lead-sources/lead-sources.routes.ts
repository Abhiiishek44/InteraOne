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
  "/google-calendar/callback",
  LeadSourcesController.completeGoogleCalendarOAuth,
);
leadSourcesRouter.get(
  "/google-tasks/callback",
  LeadSourcesController.completeGoogleTasksOAuth,
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
leadSourcesRouter.get(
  "/google-calendar/connect",
  requireRole("admin"),
  LeadSourcesController.beginGoogleCalendarOAuth,
);
leadSourcesRouter.get(
  "/google-tasks/connect",
  requireRole("admin"),
  LeadSourcesController.beginGoogleTasksOAuth,
);
leadSourcesRouter.post(
  "/:connectionId/calendars/sync",
  requireRole("admin"),
  validateRequest(leadSourcesSchema.connectionParams, "params"),
  LeadSourcesController.syncGoogleCalendars,
);
leadSourcesRouter.post(
  "/:connectionId/task-lists/sync",
  requireRole("admin"),
  validateRequest(leadSourcesSchema.connectionParams, "params"),
  LeadSourcesController.syncGoogleTaskLists,
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
// Registers public callbacks, protected integration routes, and role requirements.
