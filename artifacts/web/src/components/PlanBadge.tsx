/**
 * Shared subscription plan badge.
 *
 * Source of truth for plan IDs is the `plans` table in Supabase. As of today
 * the active plans are:
 *   - gratuito     (R$ 0)
 *   - profissional (R$ 99,90)
 *   - basico       (R$ 149,00)
 *   - empresa      (R$ 247,00)
 *   - executivo    (R$ 499,00)
 *
 * We also accept legacy aliases that older Stripe webhook flows may have
 * written into `profiles.plan` (free / premium / business / exclusive)
 * and normalize them so users keep seeing the right label.
 */

const GOLD = "#c9a84c";
const WHITE = "#fff";

type PlanStyle = { color: string; label: string; textColor?: string };

const PLAN_MAP: Record<string, PlanStyle> = {
  // Canonical IDs (match the plans table)
  gratuito:     { color: "#9aa3b2", label: "Gratuito" },
  profissional: { color: GOLD,      label: "Profissional", textColor: "#0d1b2a" },
  basico:       { color: "#374151", label: "Básico" },
  empresa:      { color: "#1a56db", label: "Empresa" },
  executivo:    { color: "#7B2FBE", label: "Executivo" },

  // Legacy aliases — kept so users whose profile still carries the old
  // English IDs continue to see the correct Portuguese label.
  free:      { color: "#9aa3b2", label: "Gratuito" },
  premium:   { color: GOLD,      label: "Profissional", textColor: "#0d1b2a" },
  business:  { color: "#1a56db", label: "Empresa" },
  exclusive: { color: "#7B2FBE", label: "Executivo" },
};

export interface PlanBadgeProps {
  plan?: string | null;
  /** When true, renders nothing for the free / gratuito tier. Default: false. */
  hideFree?: boolean;
  /** Optional extra style overrides. */
  style?: React.CSSProperties;
}

export function resolvePlanStyle(plan?: string | null): PlanStyle | null {
  if (!plan) return null;
  return PLAN_MAP[plan.toLowerCase()] ?? null;
}

/** True for any value that represents the free tier (canonical or legacy). */
export function isFreePlan(plan?: string | null): boolean {
  if (!plan) return true;
  const id = plan.toLowerCase();
  return id === "gratuito" || id === "free" || id === "";
}

export default function PlanBadge({ plan, hideFree = false, style }: PlanBadgeProps) {
  if (hideFree && isFreePlan(plan)) return null;
  const resolved = resolvePlanStyle(plan) ?? PLAN_MAP.gratuito;
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: resolved.textColor ?? WHITE,
        backgroundColor: resolved.color,
        padding: "2px 9px",
        borderRadius: 100,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {resolved.label}
    </span>
  );
}
