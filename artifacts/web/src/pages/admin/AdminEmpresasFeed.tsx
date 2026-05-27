import React, { useCallback, useEffect, useRef, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BORDER = "#e5e7eb";
const MUTED = "#8a93a2";
const WHITE = "#ffffff";

interface CompanyPage {
  id: string;
  name: string;
  avatar_url: string | null;
  can_post_market: boolean;
  created_at: string;
}

async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

async function fetchCompanies(q: string): Promise<CompanyPage[]> {
  const session = await getSession();
  const token = session?.access_token;
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? `${window.location.origin}/api`;
  const params = new URLSearchParams(q ? { q } : {});
  const res = await fetch(`${apiBase}/admin/company-pages?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Erro ao carregar empresas: ${res.status}`);
  const json = await res.json() as { companies: CompanyPage[] };
  return json.companies;
}

async function toggleMarketAccess(id: string, value: boolean): Promise<void> {
  const session = await getSession();
  const token = session?.access_token;
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? `${window.location.origin}/api`;
  const res = await fetch(`${apiBase}/admin/company-pages/${id}/market-access`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ can_post_market: value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Erro ${res.status}`);
  }
}

export default function AdminEmpresasFeed() {
  const [companies, setCompanies] = useState<CompanyPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCompanies(q);
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

  const handleToggle = async (company: CompanyPage) => {
    if (togglingId) return;
    const newVal = !company.can_post_market;
    setTogglingId(company.id);
    try {
      await toggleMarketAccess(company.id, newVal);
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, can_post_market: newVal } : c));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTogglingId(null);
    }
  };

  const withAccess = companies.filter(c => c.can_post_market);
  const withoutAccess = companies.filter(c => !c.can_post_market);

  return (
    <AdminShell>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>📡</span>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: 0 }}>Empresas — Feed de Mercado</h1>
          </div>
          <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>
            Gerencie quais empresas podem publicar posts no feed exclusivo Mercado &gt; Ideal.BI.
            Ao ativar, o dono da empresa verá o botão de publicação no feed.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: GOLD }}>{withAccess.length}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Com acesso ao feed</div>
          </div>
          <div style={{ flex: 1, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: NAVY }}>{companies.length}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Total de empresas</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar empresa pelo nome…"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "10px 14px", border: `1px solid ${BORDER}`,
              borderRadius: 10, fontSize: 14, fontFamily: "inherit",
              outline: "none", backgroundColor: WHITE,
            }}
          />
        </div>

        {error && (
          <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#dc2626" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: MUTED }}>⏳ Carregando empresas…</div>
        ) : companies.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: MUTED, backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏢</div>
            <div style={{ fontSize: 14 }}>Nenhuma empresa encontrada{search ? ` para "${search}"` : ""}.</div>
          </div>
        ) : (
          <>
            {/* Companies with access */}
            {withAccess.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>
                  ✅ Com acesso ao feed ({withAccess.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {withAccess.map(c => (
                    <CompanyRow
                      key={c.id}
                      company={c}
                      toggling={togglingId === c.id}
                      onToggle={() => void handleToggle(c)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Companies without access */}
            {withoutAccess.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>
                  Sem acesso ({withoutAccess.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {withoutAccess.map(c => (
                    <CompanyRow
                      key={c.id}
                      company={c}
                      toggling={togglingId === c.id}
                      onToggle={() => void handleToggle(c)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function CompanyRow({ company, toggling, onToggle }: {
  company: CompanyPage;
  toggling: boolean;
  onToggle: () => void;
}) {
  const initials = company.name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      backgroundColor: WHITE, border: `1px solid ${company.can_post_market ? GOLD + "60" : BORDER}`,
      borderRadius: 12, padding: "12px 16px",
      transition: "border-color 0.2s",
    }}>
      {/* Avatar */}
      {company.avatar_url ? (
        <img
          src={company.avatar_url}
          alt={company.name}
          style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 14, fontWeight: 800, color: GOLD,
        }}>
          {initials}
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {company.name}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
          {company.can_post_market
            ? "Pode publicar no feed de mercado"
            : "Sem acesso ao feed de mercado"}
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={onToggle}
        disabled={toggling}
        style={{
          flexShrink: 0,
          padding: "7px 16px",
          borderRadius: 8,
          border: company.can_post_market ? `1px solid #dc262640` : `1px solid ${GOLD}80`,
          backgroundColor: company.can_post_market ? "#fef2f2" : `${GOLD}12`,
          color: company.can_post_market ? "#dc2626" : GOLD,
          fontSize: 12, fontWeight: 700, cursor: toggling ? "wait" : "pointer",
          fontFamily: "inherit", transition: "all 0.15s",
          opacity: toggling ? 0.6 : 1,
        }}
      >
        {toggling ? "…" : company.can_post_market ? "Revogar acesso" : "Liberar acesso"}
      </button>
    </div>
  );
}
