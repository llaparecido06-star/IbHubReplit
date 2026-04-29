import rateLimit from "express-rate-limit";

/**
 * Layered rate limits.
 *
 * Two strategies:
 * 1. `apiLimiter` — broad protection on every /api/* request to soak DoS-like
 *    bursts. Generous (300/minute/IP) so legitimate dashboards that fan out
 *    many parallel reads are not affected.
 * 2. `sensitiveLimiter` — tight cap (60/minute/IP) for write/admin/billing
 *    surfaces where brute force or abuse would hurt the most.
 *
 * Both use the default in-memory store (per-instance). For multi-instance
 * deployments swap to a Redis store later — see express-rate-limit docs.
 *
 * `keyGenerator` falls back to req.ip (which respects `app.set("trust proxy")`
 * already implied by Express 5 + the Replit proxy chain).
 */

const COMMON = {
  standardHeaders: true as const,
  legacyHeaders: false as const,
  message: { error: "Muitas requisições. Aguarde alguns instantes e tente novamente." },
};

export const apiLimiter = rateLimit({
  ...COMMON,
  windowMs: 60 * 1000,
  limit: 300,
});

export const sensitiveLimiter = rateLimit({
  ...COMMON,
  windowMs: 60 * 1000,
  limit: 60,
});
