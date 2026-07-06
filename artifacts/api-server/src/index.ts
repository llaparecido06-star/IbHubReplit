import app from "./app";
import { logger } from "./lib/logger";
import cron from "node-cron";
import { dailyUnlockJob } from "./jobs/dailyUnlock.js";
import { welcomeEmailSweepJob } from "./jobs/welcomeEmailSweep.js";
import { weeklyDigestJob } from "./jobs/weeklyDigest.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Schedule daily unlock job at 08:00 BRT (UTC-3 = 11:00 UTC)
  cron.schedule("0 11 * * *", async () => {
    logger.info("Running dailyUnlockJob (scheduled)");
    try {
      await dailyUnlockJob();
    } catch (e) {
      logger.error({ err: e }, "dailyUnlockJob failed");
    }
  });

  logger.info("Daily unlock cron scheduled at 08:00 BRT (11:00 UTC)");

  // Welcome-email sweep: every 10 minutes, catch any user whose Supabase
  // Auth confirmation hasn't been welcomed yet.
  cron.schedule("*/10 * * * *", async () => {
    logger.info("Running welcomeEmailSweepJob (scheduled)");
    try {
      await welcomeEmailSweepJob();
    } catch (e) {
      logger.error({ err: e }, "welcomeEmailSweepJob failed");
    }
  });

  logger.info("Welcome email sweep cron scheduled every 10 minutes");

  // Weekly digest: Mondays at 09:00 BRT (UTC-3 = 12:00 UTC)
  cron.schedule("0 12 * * 1", async () => {
    logger.info("Running weeklyDigestJob (scheduled)");
    try {
      await weeklyDigestJob();
    } catch (e) {
      logger.error({ err: e }, "weeklyDigestJob failed");
    }
  });

  logger.info("Weekly digest cron scheduled for Mondays at 09:00 BRT (12:00 UTC)");
});
