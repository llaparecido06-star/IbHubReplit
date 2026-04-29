import { z } from "zod";
import { logger } from "./logger.js";

/**
 * Centralized, Zod-validated environment configuration.
 *
 * Read this once on boot. Throws (with a helpful list of what's missing or
 * malformed) if anything required is missing. Never use process.env directly
 * in route handlers — import `config` from here so a typo or missing var
 * surfaces at startup instead of at request time.
 */

const EnvSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().optional(),

  // Supabase (required)
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe (required for payment routes)
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_PREMIUM: z.string().min(1).optional(),
  STRIPE_PRICE_BUSINESS: z.string().min(1).optional(),
  STRIPE_PRICE_EXCLUSIVE: z.string().min(1).optional(),

  // Session/cookies
  SESSION_SECRET: z.string().min(16).optional(),

  // Replit-injected — used to build the CORS origin allow list
  REPLIT_DOMAINS: z.string().optional(),
  REPLIT_DEV_DOMAIN: z.string().optional(),
  REPLIT_EXPO_DEV_DOMAIN: z.string().optional(),

  // OpenAI (optional)
  OPENAI_API_KEY: z.string().min(1).optional(),
});

export type AppConfig = z.infer<typeof EnvSchema>;

function parseEnv(): AppConfig {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    logger.fatal(
      { issues: parsed.error.issues },
      `Invalid environment configuration:\n${issues.join("\n")}`,
    );
    throw new Error(
      `Invalid environment configuration:\n${issues.join("\n")}`,
    );
  }
  return parsed.data;
}

export const config: AppConfig = parseEnv();

/**
 * Build the list of allowed origins for CORS based on the runtime environment.
 *
 * - In production: only the published REPLIT_DOMAINS are allowed.
 * - In development: also allow REPLIT_DEV_DOMAIN, REPLIT_EXPO_DEV_DOMAIN,
 *   and localhost (for local tooling).
 *
 * Returns `true` if the list ends up empty in development (very early boot),
 * so the dev workflow doesn't break. In production an empty list means
 * "deny all" — request must include a known origin.
 */
export function buildAllowedOrigins(): (string | RegExp)[] | true {
  const origins = new Set<string>();

  if (config.REPLIT_DOMAINS) {
    for (const d of config.REPLIT_DOMAINS.split(",").map((s) => s.trim()).filter(Boolean)) {
      origins.add(`https://${d}`);
      origins.add(`http://${d}`);
    }
  }

  if (config.NODE_ENV !== "production") {
    if (config.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${config.REPLIT_DEV_DOMAIN}`);
      origins.add(`http://${config.REPLIT_DEV_DOMAIN}`);
    }
    if (config.REPLIT_EXPO_DEV_DOMAIN) {
      origins.add(`https://${config.REPLIT_EXPO_DEV_DOMAIN}`);
    }
    origins.add("http://localhost");
    origins.add("http://localhost:80");
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1");
  }

  if (origins.size === 0 && config.NODE_ENV !== "production") return true;
  return Array.from(origins);
}
