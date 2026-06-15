import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD  = "#c9a84c";
const NAVY  = "#0d1b2a";
const BORDER = "#e5e7eb";
const MUTED  = "#8a93a2";
const WHITE  = "#ffffff";
const BG     = "#f2f3f5";

const ROLE_LABELS: Record<string, string> = {
  owner:        "Proprietário",
  editor:       "Editor",
  moderador:    "Moderador",
  visualizador: "Visualizador",
  admin:        "Admin (legado)",
};

const ROLE_COLORS: Record<string, string> = {
  owner:        "#722f37",
  editor:       "#1a56db",
  moderador:    "#8b5cf6",
  visualizador: "#7a8494",
  admin:        "#c9a84c",
};

const PLAN_COLORS: Record<string, string> = {
  gratuito:    "#7a8494",
  premium:     "#1a56db",
  exclusive:   "#8b5cf6",
  business:    "#c9a84c",
  empresarial: "#c9a84c",
};

interface CompanyMember {
  user_id: string;
  role: string;
  added_at: string;
  full_name: string | null;
  avatar_url: string | null;
  member_plan: string | null;
}

interface AdminCompany {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  industry: string | null;
  location: string | null;
  plan: string | null;
  created_at: string;
  owner_id: string;
  owner_name: string | null;
  owner_avatar: string | null;
  owner_plan: string | null;
  member_count: number;
  members?: CompanyMember[];
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function MiniAvatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: GOLD + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 800, color: GOLD, flexShrink: 0 }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan) return null;
  const color = PLAN_COLORS[plan.toLowerCase()] ?? MUTED;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, backgroundColor: color + "18", padding: "2px 8px", borderRadius: 20, textTransform: "capitalize", flexShrink: 0 }}>
      {plan}
    </span>
  );
}

async function loadCompanies(search: string): Promise<AdminCompany[]> {
  let q = supabase
    .from("company_pages")
    .select("id, name, username, avatar_url, industry, location, plan, created_at, owner_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (search.trim()) {
    q = q.ilike("name", `%${search.trim()}%`);
  }

  const { data: companies, error } = await q;
  if (error || !companies || companies.length === 0) return [];

  const ownerIds = [...new Set((companies as any[]).map(c => c.owner_id).filter(Boolean))];
  const companyIds = (companies as any[]).map(c => c.id);

  const [profilesRes, adminsRes] = await Promise.all([
    ownerIds.length > 0
      ? supabase.from("profiles").select("id, full_name, avatar_url, plan").in("id", ownerIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("company_page_admins")
      .select("company_id, user_id, role, added_at")
      .in("company_id", companyIds),
  ]);

  const profileMap = new Map<string, any>();
  ((profilesRes.data ?? []) as any[]).forEach((p: any) => profileMap.set(p.id, p));

  // Count members per company
  const memberCountMap = new Map<string, number>();
  ((adminsRes.data ?? []) as any[]).forEach((a: any) => {
    memberCountMap.set(a.company_id, (memberCountMap.get(a.company_id) ?? 0) + 1);
  });

  return (companies as any[]).map(c => {
    const owner = profileMap.get(c.owner_id);
    return {
      ...c,
      owner_name:   owner?.full_name ?? null,
      owner_avatar: owner?.avatar_url ?? null,
      owner_plan:   owner?.plan ?? null,
      member_count: memberCountMap.get(c.id) ?? 0,
    };
  });
}

async function loadMembers(companyId: string, ownerId: string): Promise<CompanyMember[]> {
  const { data: rows } = await supabase
    .from("company_page_admins")
    .select("company_id, user_id, role, added_at")
    .eq("company_id", companyId)
    .order("added_at", { ascending: true });

  if (!rows || rows.length === 0) return [];

  const userIds = [...new Set((rows as any[]).map((r: any) => r.user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, plan")
    .in("id", userIds);

  const pMap = new Map<string, any>();
  ((profiles ?? []) as any[]).forEach((p: any) => pMap.set(p.id, p));

  return (rows as any[]).map((r: any) => {
    const p = pMap.get(r.user_id);
    return {
      user_id:     r.user_id,
      role:        r.role,
      added_at:    r.added_at,
      full_name:   p?.full_name ?? null,
      avatar_url:  p?.avatar_url ?? null,
      member_plan: p?.plan ?? null,
    };
  });
}

// ─── Company Row ──────────────────────────────────────────────────────────────

function CompanyRow({ company }: { company: AdminCompany }) {
  const [, setLocation] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [members, setMembers] = useState<CompanyMember[] | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const handleExpand = async () => {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (members !== null) return;
    setLoadingMembers(true);
    const data = await loadMembers(company.id, company.owner_id);
    setMembers(data);
    setLoadingMembers(false);
  };

  return (
    <div style={{ backgroundColor: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", marginBottom: 10 }}>

      {/* Main row */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", cursor: "pointer" }} onClick={handleExpand}>

        {/* Logo */}
        <MiniAvatar src={company.avatar_url} name={company.name} size={42} />

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{company.name}</span>
            {company.username && <span style={{ fontSize: 12, color: MUTED }}>@{company.username}</span>}
            <PlanBadge plan={company.plan} />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 3, fontSize: 12, color: MUTED, flexWrap: "wrap" }}>
            {company.industry && <span>🏭 {company.industry}</span>}
            {company.location && <span>📍 {company.location}</span>}
            <span>📅 {fmt(company.created_at)}</span>
            <span>👥 {company.member_count + 1} membro{company.member_count + 1 !== 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Owner mini-card */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, minWidth: 140, maxWidth: 200 }}>
          <MiniAvatar src={company.owner_avatar} name={company.owner_name ?? "?"} size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {company.owner_name ?? "—"}
            </div>
            <div style={{ fontSize: 10, color: MUTED }}>
              <span style={{ color: ROLE_COLORS.owner, fontWeight: 700 }}>Proprietário</span>
              {company.owner_plan && <span> · {company.owner_plan}</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); window.open(`/app/empresa/${company.id}`, "_blank"); }}
            title="Ver página pública"
            style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontSize: 12, cursor: "pointer" }}
          >
            🔗
          </button>
          <button
            onClick={e => { e.stopPropagation(); setLocation(`/app/empresa/${company.id}/editar`); }}
            title="Editar empresa"
            style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontSize: 12, cursor: "pointer" }}
          >
            ✏️
          </button>
          <button
            style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${BORDER}`, backgroundColor: expanded ? GOLD + "18" : WHITE, color: expanded ? GOLD : MUTED, fontSize: 12, cursor: "pointer", fontWeight: 700 }}
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: "#fafafa", padding: "16px 18px" }}>

          {/* Owner full card */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: MUTED, textTransform: "uppercase", marginBottom: 8 }}>Proprietário</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", backgroundColor: WHITE, borderRadius: 10, border: `1px solid ${BORDER}` }}>
              <MiniAvatar src={company.owner_avatar} name={company.owner_name ?? "?"} size={38} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{company.owner_name ?? "—"}</div>
                <div style={{ fontSize: 11, color: MUTED }}>ID: {company.owner_id}</div>
              </div>
              <PlanBadge plan={company.owner_plan} />
              <span style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLORS.owner, backgroundColor: ROLE_COLORS.owner + "18", padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
                Proprietário
              </span>
              <button
                onClick={() => window.open(`/app/perfil/${company.owner_id}`, "_blank")}
                style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontSize: 12, cursor: "pointer", flexShrink: 0 }}
              >
                👤 Ver perfil
              </button>
            </div>
          </div>

          {/* Members */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: MUTED, textTransform: "uppercase", marginBottom: 8 }}>
              Equipe ({company.member_count} membro{company.member_count !== 1 ? "s" : ""} além do proprietário)
            </div>

            {loadingMembers ? (
              <div style={{ padding: 20, textAlign: "center", color: MUTED, fontSize: 13 }}>Carregando membros...</div>
            ) : !members || members.length === 0 ? (
              <div style={{ padding: "12px 14px", fontSize: 13, color: MUTED, backgroundColor: WHITE, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                Nenhum membro além do proprietário.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {members.map(m => (
                  <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", backgroundColor: WHITE, borderRadius: 10, border: `1px solid ${BORDER}` }}>
                    <MiniAvatar src={m.avatar_url} name={m.full_name ?? "?"} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{m.full_name ?? "Usuário"}</div>
                      <div style={{ fontSize: 11, color: MUTED }}>Adicionado em {fmt(m.added_at)}</div>
                    </div>
                    <PlanBadge plan={m.member_plan} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: ROLE_COLORS[m.role] ?? MUTED, backgroundColor: (ROLE_COLORS[m.role] ?? MUTED) + "18", padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                    <button
                      onClick={() => window.open(`/app/perfil/${m.user_id}`, "_blank")}
                      style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontSize: 12, cursor: "pointer", flexShrink: 0 }}
                    >
                      👤 Ver perfil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminEmpresasCRM() {
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadCompanies(q);
      setCompanies(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(""); }, [load]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void load(q), 350);
  };

  const filtered = filterPlan
    ? companies.filter(c => (c.plan ?? "gratuito").toLowerCase() === filterPlan)
    : companies;

  const plans = [...new Set(companies.map(c => (c.plan ?? "gratuito").toLowerCase()))].sort();

  return (
    <AdminShell>
      <div style={{ padding: "24px 24px 40px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>🏢 CRM — Empresas Cadastradas</h1>
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>
            Visualize todas as páginas de empresa, seus proprietários e equipes.
          </p>
        </div>

        {/* Stats bar */}
        {!loading && (
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { label: "Total", value: companies.length, color: NAVY },
              ...plans.map(p => ({
                label: p.charAt(0).toUpperCase() + p.slice(1),
                value: companies.filter(c => (c.plan ?? "gratuito").toLowerCase() === p).length,
                color: PLAN_COLORS[p] ?? MUTED,
              })),
            ].map(stat => (
              <div key={stat.label} style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 18px", display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: stat.color }}>{stat.value}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar empresa por nome..."
            style={{
              flex: 1, minWidth: 220, padding: "10px 14px", borderRadius: 10,
              border: `1.5px solid ${BORDER}`, fontSize: 14, outline: "none",
              fontFamily: "inherit",
            }}
          />
          <select
            value={filterPlan}
            onChange={e => setFilterPlan(e.target.value)}
            style={{
              padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${BORDER}`,
              fontSize: 14, backgroundColor: WHITE, fontFamily: "inherit", cursor: "pointer",
            }}
          >
            <option value="">Todos os planos</option>
            {plans.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {error && (
          <div style={{ padding: 16, backgroundColor: "#fff5f5", border: "1px solid #fcc", borderRadius: 10, color: "#a82a2a", fontSize: 13, marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: MUTED }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${GOLD}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            Carregando empresas...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, color: MUTED }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🏢</div>
            <p style={{ margin: 0 }}>{search ? `Nenhuma empresa encontrada para "${search}".` : "Nenhuma empresa cadastrada."}</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>
              {filtered.length} empresa{filtered.length !== 1 ? "s" : ""}{filterPlan ? ` — plano ${filterPlan}` : ""}
            </div>
            {filtered.map(c => <CompanyRow key={c.id} company={c} />)}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AdminShell>
  );
}
