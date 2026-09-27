import { createHmac, timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import config from "@shared/infra/config";
import { sendError, sendResponse } from "@shared/core/response";
import logger from "@shared/core/logger";
import { AuthenticatedRequest } from "@shared/security/middleware";
import { LeadSourcesService } from "./lead-sources.service";

const service = new LeadSourcesService();

// Reads the active organization ID established by authentication middleware.
const getOrgId = (req: Request) =>
  (req as AuthenticatedRequest).user.activeOrganizationId;

// Verifies that an incoming Facebook webhook was signed with the configured app secret.
const verifyMetaSignature = (req: Request): boolean => {
  const appSecret = config.leadSources.facebook.appSecret;
  const signature = req.get("x-hub-signature-256");
  const rawBody = (req as Request & { rawBody?: string }).rawBody;
  if (
    !appSecret ||
    !signature ||
    !rawBody ||
    !signature.startsWith("sha256=")
  ) {
    return false;
  }
  const expected = `sha256=${createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
};

// Translates lead-source HTTP requests into service operations and API responses.
export class LeadSourcesController {
  // Starts Google Tasks OAuth for the authenticated organization administrator.
  static async beginGoogleTasksOAuth(req: Request, res: Response) {
    try {
      const auth = (req as AuthenticatedRequest).user;
      const result = await service.beginGoogleTasksOAuth(
        auth.activeOrganizationId,
        auth.userId,
      );
      return sendResponse(
        res,
        200,
        true,
        "Google Tasks authorization URL created",
        result,
      );
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error
          ? error.message
          : "Could not start Google Tasks OAuth",
      );
    }
  }

  // Handles the Tasks OAuth callback and redirects to the integration result page.
  static async completeGoogleTasksOAuth(req: Request, res: Response) {
    const fallback = `${config.app.clientUrl}/dashboard/integrations`;
    try {
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      if (!code || !state) {
        return res.redirect(
          `${fallback}?googleTasks=error&reason=missing_oauth_parameters`,
        );
      }
      const result = await service.completeGoogleTasksOAuth(code, state);
      const redirect = new URL(result.redirectUri);
      redirect.searchParams.set("googleTasks", "connected");
      redirect.searchParams.set("taskLists", String(result.taskLists));
      return res.redirect(redirect.toString());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown Google Tasks OAuth error";
      logger.error("[LeadSources] Google Tasks OAuth callback failed", {
        error: message,
      });
      const redirect = new URL(fallback);
      redirect.searchParams.set("googleTasks", "error");
      redirect.searchParams.set("message", message.slice(0, 240));
      return res.redirect(redirect.toString());
    }
  }

  // Starts Google Calendar OAuth for the authenticated organization administrator.
  static async beginGoogleCalendarOAuth(req: Request, res: Response) {
    try {
      const auth = (req as AuthenticatedRequest).user;
      const result = await service.beginGoogleCalendarOAuth(
        auth.activeOrganizationId,
        auth.userId,
      );
      return sendResponse(
        res,
        200,
        true,
        "Google Calendar authorization URL created",
        result,
      );
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error
          ? error.message
          : "Could not start Google Calendar OAuth",
      );
    }
  }

  // Handles the Calendar OAuth callback and redirects to the integration result page.
  static async completeGoogleCalendarOAuth(req: Request, res: Response) {
    const fallback = `${config.app.clientUrl}/dashboard/integrations`;
    try {
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      if (!code || !state) {
        return res.redirect(
          `${fallback}?googleCalendar=error&reason=missing_oauth_parameters`,
        );
      }
      const result = await service.completeGoogleCalendarOAuth(code, state);
      const redirect = new URL(result.redirectUri);
      redirect.searchParams.set("googleCalendar", "connected");
      redirect.searchParams.set("calendars", String(result.calendars));
      return res.redirect(redirect.toString());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown Google Calendar OAuth error";
      logger.error("[LeadSources] Google Calendar OAuth callback failed", {
        error: message,
      });
      const redirect = new URL(fallback);
      redirect.searchParams.set("googleCalendar", "error");
      redirect.searchParams.set("message", message.slice(0, 240));
      return res.redirect(redirect.toString());
    }
  }

  // Starts Google Forms OAuth for the authenticated organization administrator.
  static async beginGoogleOAuth(req: Request, res: Response) {
    try {
      const auth = (req as AuthenticatedRequest).user;
      const result = await service.beginGoogleOAuth(
        auth.activeOrganizationId,
        auth.userId,
      );
      return sendResponse(
        res,
        200,
        true,
        "Google authorization URL created",
        result,
      );
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : "Could not start Google OAuth",
      );
    }
  }

  // Handles the Google Forms OAuth callback and redirects with its result.
  static async completeGoogleOAuth(req: Request, res: Response) {
    const fallback = `${config.app.clientUrl}/dashboard/integrations`;
    try {
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      if (!code || !state) {
        return res.redirect(
          `${fallback}?google=error&reason=missing_oauth_parameters`,
        );
      }
      const result = await service.completeGoogleOAuth(code, state);
      const redirect = new URL(result.redirectUri);
      redirect.searchParams.set("google", "connected");
      redirect.searchParams.set("forms", String(result.forms));
      return res.redirect(redirect.toString());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Google OAuth error";
      logger.error("[LeadSources] Google OAuth callback failed", {
        error: message,
      });
      const redirect = new URL(fallback);
      redirect.searchParams.set("google", "error");
      redirect.searchParams.set("message", message.slice(0, 240));
      return res.redirect(redirect.toString());
    }
  }

  // Starts Facebook Lead Ads OAuth for the authenticated organization administrator.
  static async beginFacebookOAuth(req: Request, res: Response) {
    try {
      const auth = (req as AuthenticatedRequest).user;
      const result = await service.beginFacebookOAuth(
        auth.activeOrganizationId,
        auth.userId,
      );
      sendResponse(
        res,
        200,
        true,
        "Facebook authorization URL created",
        result,
      );
    } catch (error) {
      sendError(
        res,
        400,
        error instanceof Error
          ? error.message
          : "Could not start Facebook OAuth",
      );
    }
  }

  // Handles the Facebook OAuth callback and redirects with connected Page results.
  static async completeFacebookOAuth(req: Request, res: Response) {
    const fallback = `${config.app.clientUrl}/dashboard/integrations`;
    try {
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      if (!code || !state) {
        return res.redirect(
          `${fallback}?facebook=error&reason=missing_oauth_parameters`,
        );
      }
      const result = await service.completeFacebookOAuth(code, state);
      const redirect = new URL(result.redirectUri);
      redirect.searchParams.set("facebook", "connected");
      redirect.searchParams.set("pages", String(result.connected.length));
      if (result.errors.length) {
        redirect.searchParams.set("warnings", String(result.errors.length));
      }
      return res.redirect(redirect.toString());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Facebook OAuth error";
      logger.error("[LeadSources] Facebook OAuth callback failed", {
        error: message,
      });
      const redirect = new URL(fallback);
      redirect.searchParams.set("facebook", "error");
      redirect.searchParams.set("reason", "connection_failed");
      redirect.searchParams.set("message", message.slice(0, 240));
      return res.redirect(redirect.toString());
    }
  }

  // Completes Meta’s webhook verification challenge for the configured verify token.
  static async verifyFacebookWebhook(req: Request, res: Response) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (
      config.leadSources.facebook.verifyToken &&
      mode === "subscribe" &&
      token === config.leadSources.facebook.verifyToken &&
      challenge
    ) {
      return res.status(200).send(String(challenge));
    }
    return res.status(403).send("Forbidden");
  }

  // Accepts signed Facebook lead webhooks and forwards them for asynchronous processing.
  static async receiveFacebookWebhook(req: Request, res: Response) {
    if (!verifyMetaSignature(req)) {
      return sendError(res, 401, "Invalid Meta webhook signature");
    }
    try {
      const result = await service.receiveFacebookWebhook(req.body);
      return sendResponse(res, 200, true, "Facebook webhook accepted", result);
    } catch (error) {
      return sendError(
        res,
        500,
        error instanceof Error
          ? error.message
          : "Could not accept Facebook webhook",
      );
    }
  }

  // Returns every integration connection visible to the active organization.
  static async list(req: Request, res: Response) {
    try {
      const connections = await service.list(getOrgId(req));
      return sendResponse(res, 200, true, "Lead sources retrieved", {
        connections,
      });
    } catch (error) {
      return sendError(
        res,
        500,
        error instanceof Error ? error.message : "Could not list lead sources",
      );
    }
  }

  // Synchronizes forms for a connected Facebook or Google Forms account.
  static async syncForms(req: Request, res: Response) {
    try {
      const forms = await service.syncForms(
        String(req.params.connectionId),
        getOrgId(req),
      );
      return sendResponse(res, 200, true, "Lead forms synchronized", {
        forms,
      });
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : "Could not synchronize forms",
      );
    }
  }

  // Refreshes the calendar list cached for a connected Google account.
  static async syncGoogleCalendars(req: Request, res: Response) {
    try {
      const calendars = await service.syncGoogleCalendars(
        String(req.params.connectionId),
        getOrgId(req),
      );
      return sendResponse(res, 200, true, "Google Calendars synchronized", {
        calendars,
      });
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error
          ? error.message
          : "Could not synchronize Google Calendars",
      );
    }
  }

  // Refreshes the task lists cached for a connected Google account.
  static async syncGoogleTaskLists(req: Request, res: Response) {
    try {
      const taskLists = await service.syncGoogleTaskLists(
        String(req.params.connectionId),
        getOrgId(req),
      );
      return sendResponse(res, 200, true, "Google Task lists synchronized", {
        taskLists,
      });
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error
          ? error.message
          : "Could not synchronize Google Task lists",
      );
    }
  }

  // Updates status, mappings, or defaults for one synchronized lead form.
  static async updateForm(req: Request, res: Response) {
    try {
      const form = await service.updateForm(
        getOrgId(req),
        String(req.params.formId),
        req.body,
      );
      return sendResponse(res, 200, true, "Lead form updated", { form });
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : "Could not update lead form",
      );
    }
  }

  // Disconnects one provider account from the active organization.
  static async deleteConnection(req: Request, res: Response) {
    try {
      await service.deleteConnection(
        getOrgId(req),
        String(req.params.connectionId),
      );
      return sendResponse(res, 200, true, "Lead source disconnected");
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error
          ? error.message
          : "Could not disconnect lead source",
      );
    }
  }

  // Returns a paginated lead-submission history for the active organization.
  static async listSubmissions(req: Request, res: Response) {
    try {
      const result = await service.listSubmissions(getOrgId(req), req.query);
      return sendResponse(res, 200, true, "Lead submissions retrieved", result);
    } catch (error) {
      return sendError(
        res,
        500,
        error instanceof Error ? error.message : "Could not list submissions",
      );
    }
  }

  // Requeues one failed lead submission for another processing attempt.
  static async retrySubmission(req: Request, res: Response) {
    try {
      const submission = await service.retrySubmission(
        getOrgId(req),
        String(req.params.submissionId),
      );
      return sendResponse(res, 202, true, "Lead submission queued for retry", {
        submission,
      });
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : "Could not retry submission",
      );
    }
  }
}
// Handles HTTP input, output, callbacks, and errors for lead-source integrations.
