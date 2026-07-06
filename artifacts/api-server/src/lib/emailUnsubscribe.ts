import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import { getCanonicalWebBaseUrl } from "./canonicalUrl.js";

/**
 * Signed, stateless unsubscribe links for the weekly digest email.
 *
 * The token is an HMAC-SHA256 of the user id, keyed with SESSION_SECRET, so
 * an unauthenticated GET request can flip `notif_email` off without a login
 * session — while still being unguessable/unforgeable without the secret.
 */
function sign(userId: string): string {
  if (!config.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required to sign unsubscribe links");
  }
  return createHmac("sha256", config.SESSION_SECRET).update(userId).digest("hex");
}

export function buildUnsubscribeUrl(userId: string): string {
  const token = sign(userId);
  const base = getCanonicalWebBaseUrl();
  return `${base}/api/email/unsubscribe?uid=${encodeURIComponent(userId)}&token=${token}`;
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(sign(userId), "hex");
    actual = Buffer.from(token, "hex");
  } catch {
    return false;
  }
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
