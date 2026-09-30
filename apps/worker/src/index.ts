import dotenv from "dotenv";
dotenv.config();

import { startEmailWorker } from "./workers/email.worker";
import { startAnalyticsWorker } from "./workers/analytics.worker";
import { startSubscriptionExpiryWorker } from "./workers/subscription-expiry.worker";
import { startGoogleFormsPoller, startLeadSourceWorker } from "./workers/lead-source.worker";
import { isEeEnabled } from "./config";
import logger from "./utils/logger";

logger.info("Starting platform worker service", {
  nodeEnv: process.env.NODE_ENV || "development",
});

const emailWorker = startEmailWorker();
const analyticsWorker = startAnalyticsWorker();
const leadSourceWorker = startLeadSourceWorker();
const googleFormsPoller = startGoogleFormsPoller();

// The subscription expiry worker is an EE-only concern.
// It must never start on OSS deployments where no license key is present.
const subscriptionExpiryWorker = isEeEnabled()
  ? startSubscriptionExpiryWorker()
  : null;

if (!subscriptionExpiryWorker) {
  logger.info("EE not enabled; subscription expiry worker skipped");
}

const shutdown = async (signal: string) => {
  logger.info("Received shutdown signal", { signal });
  await Promise.all([
    emailWorker.close(),
    analyticsWorker.close(),
    leadSourceWorker.close(),
    googleFormsPoller.close(),
    subscriptionExpiryWorker?.close(),
  ]);
  logger.info("Platform worker shutdown completed", { signal });
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { reason });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error });
  process.exit(1);
});
