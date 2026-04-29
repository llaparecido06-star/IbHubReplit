import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { config, buildAllowedOrigins } from "./lib/config";
import { apiLimiter, sensitiveLimiter } from "./middlewares/rateLimit";

const app: Express = express();

// Trust the Replit proxy chain so req.ip / X-Forwarded-For are honored
// (required for accurate rate limiting per real client IP).
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ─── Security headers ──────────────────────────────────────────────────────
// Helmet sets a sensible baseline of security headers (X-Content-Type-Options,
// X-Frame-Options, Strict-Transport-Security, etc.). We disable the default
// CSP because the API only serves JSON; the web/mobile artifacts manage their
// own CSP. We also disable cross-origin embedder/opener restrictions to keep
// API responses embeddable from the proxied frontends.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// ─── CORS ──────────────────────────────────────────────────────────────────
// In production: only the published REPLIT_DOMAINS are allowed.
// In development: also REPLIT_DEV_DOMAIN, REPLIT_EXPO_DEV_DOMAIN, and localhost.
// Server-to-server requests (no Origin header, e.g. cron jobs, webhooks,
// curl/Postman) are always allowed.
const allowed = buildAllowedOrigins();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed === true) return callback(null, true);
      const ok = allowed.some((entry) =>
        entry instanceof RegExp ? entry.test(origin) : entry === origin,
      );
      if (ok) return callback(null, true);
      logger.warn({ origin, allowed }, "CORS: rejected origin");
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);

// Stripe webhook must receive the raw body for signature verification
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));

// Increase limit for chat file uploads (base64 encoded, so 50MB file ≈ 70MB JSON)
app.use("/api/uploads", express.json({ limit: "75mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "75mb" }));

// ─── Rate limiting ─────────────────────────────────────────────────────────
// Tight cap on the highest-risk surfaces (admin actions, billing/checkout,
// chat sends, push notifications), then a broad cap on the rest of the API.
// Webhooks and the unauthenticated health probe are exempted so external
// services and monitors aren't throttled.
app.use("/api/healthz", (_req, _res, next) => next());
app.use((req, _res, next) => {
  if (req.path === "/api/stripe/webhook" || req.path === "/api/healthz") return next();
  return apiLimiter(req as Request, _res, next);
});
app.use("/api/admin", sensitiveLimiter);
app.use("/api/stripe", sensitiveLimiter);
app.use("/api/messages", sensitiveLimiter);
app.use("/api/push", sensitiveLimiter);

app.use("/api", router);

// ─── Error handlers ────────────────────────────────────────────────────────
// Convert CORS rejections (and other Error()s from middlewares) into clean
// JSON responses instead of letting Express render its default HTML error
// page (which can leak stack traces in development).
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("not allowed by CORS")) {
    res.status(403).json({ error: "CORS_REJECTED", message });
    return;
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "INTERNAL_ERROR" });
});

// Surface the boot configuration so an operator can sanity-check what's loaded.
logger.info(
  {
    nodeEnv: config.NODE_ENV,
    corsAllowed: allowed === true ? "ALL (dev fallback)" : allowed,
  },
  "API server configured",
);

export default app;
