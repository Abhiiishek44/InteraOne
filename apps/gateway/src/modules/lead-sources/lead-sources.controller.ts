import { createHmac, timingSafeEqual } from "crypto";
import { Request, Response } from "express";
import config from "@shared/infra/config";
import { sendError, sendResponse } from "@shared/core/response";
import logger from "@shared/core/logger";
import { AuthenticatedRequest } from "@shared/security/middleware";
import { LeadSourcesService } from "./lead-sources.service";

const service = new LeadSourcesService();

const getOrgId = (req: Request) =>
  (req as AuthenticatedRequest).user.activeOrganizationId;

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

export class LeadSourcesController {
  static async beginGoogleOAuth(req: Request, res: Response) {
    try {
      const auth = (req as AuthenticatedRequest).user;
      const result = await service.beginGoogleOAuth(
        auth.activeOrganizationId,
        auth.userId,
      );
      return sendResponse(res, 200, true, "Google authorization URL created", result);
    } catch (error) {
      return sendError(
        res,
        400,
        error instanceof Error ? error.message : "Could not start Google OAuth",
      );
    }
  }

  static async completeGoogleOAuth(req: Request, res: Response) {
    const fallback = `${config.app.clientUrl}/dashboard/integrations`;
    try {
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");
      if (!code || !state) {
        return res.redirect(`${fallback}?google=error&reason=missing_oauth_parameters`);
      }
      const result = await service.completeGoogleOAuth(code, state);
      const redirect = new URL(result.redirectUri);
      redirect.searchParams.set("google", "connected");
      redirect.searchParams.set("forms", String(result.forms));
      return res.redirect(redirect.toString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Google OAuth error";
      logger.error("[LeadSources] Google OAuth callback failed", { error: message });
      const redirect = new URL(fallback);
      redirect.searchParams.set("google", "error");
      redirect.searchParams.set("message", message.slice(0, 240));
      return res.redirect(redirect.toString());
    }
  }

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
