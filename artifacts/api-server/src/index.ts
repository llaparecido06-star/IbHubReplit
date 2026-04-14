import app from "./app";
import { logger } from "./lib/logger";
import cron from "node-cron";
import { dailyUnlockJob } from "./jobs/dailyUnlock.js";

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
});
