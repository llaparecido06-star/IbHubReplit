import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { supabase, getCachedSession } from "@/lib/supabase";
import { sendWebConnectionRequest } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const WINE   = "#722f37";

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  premium:   { label: "Premium",   color: "#8b5cf6" },
  exclusive: { label: "Exclusive", color: "#c9a84c" },
  business:  { label: "Business",  color: "#0d1b2a" },
};

type Filter = "todos" | "pessoas" | "publicacoes" | "empresas" | "vagas" | "eventos" | "grupos";

interface PersonResult   { id: string; full_name: string | null; username: string | null; avatar_url: string | null; headline: string | null; plan: string | null; }
interface CompanyResult  { id: string; name: string; avatar_url: string | null; industry: string | null; }
interface PostResult     { id: string; content: string; created_at: string; likes_count: number; comments_count: number; user_id?: string | null; company_page_id?: string | null; author?: { id: string; full_name: string | null; avatar_url: string | null; isCompany?: boolean } | null; }
interface VagaResult     { id: string; title: string; description: string | null; company: string | null; location: string | null; contract_type: string | null; created_at: string; }
interface EventResult    { id: string; title: string; description: string | null; start_date: string; location: string | null; entry_type: string; }
interface GroupResult    { id: string; name: string; description: string | null; members_count: number; category: string | null; }

interface SearchResults {
  pessoas: PersonResult[]; publicacoes: PostResult[];
  empresas: CompanyResult[]; vagas: VagaResult[];
  eventos: EventResult[]; grupos: GroupResult[];
}
const EMPTY: SearchResults = { pessoas: [], publicacoes: [], empresas: [], vagas: [], eventos: [], grupos: [] };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function Avatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: NAVY, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0 }}>
      {initials || "?"}
    </div>
  );
}

function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", background: hover && onClick ? BG : WHITE, borderBottom: `1px solid ${BORDER}`, cursor: onClick ? "pointer" : "default", transition: "background 0.12s" }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ padding: "10px 20px 4px", fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: `1px solid ${BORDER}`, background: BG }}>
      {label} · {count}
    </div>
  );
}

function PersonCard({ p, isEmpresa = false, currentUserId }: { p: PersonResult; isEmpresa?: boolean; currentUserId: string }) {
  const [, setLocation] = useLocation();
  const [sent, setSent] = useState(false);
  const plan = PLAN_LABELS[p.plan ?? ""];
  const isSelf = p.id === currentUserId;

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sent || isSelf) return;
    await sendWebConnectionRequest(p.id, currentUserId);
    setSent(true);
  };

  return (
    <Row onClick={() => setLocation(isEmpresa ? `/app/empresa/${p.id}` : `/app/usuario/${p.id}`)}>
      <Avatar src={p.avatar_url} name={p.full_name ?? "?"} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.full_name ?? "—"}</span>
          {plan && <span style={{ fontSize: 10, fontWeight: 700, color: plan.color, background: plan.color + "18", borderRadius: 5, padding: "1px 5px", flexShrink: 0 }}>{plan.label}</span>}
        </div>
        {p.headline && <div style={{ fontSize: 12, color: MUTED, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.headline}</div>}
        {p.username && <div style={{ fontSize: 11, color: MUTED }}>@{p.username}</div>}
      </div>
      {!isEmpresa && !isSelf && (
        <button
          onClick={handleConnect}
          disabled={sent}
          style={{ padding: "6px 14px", background: sent ? "#e8f5e9" : NAVY, color: sent ? "#16a34a" : WHITE, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: sent ? "default" : "pointer", flexShrink: 0, fontFamily: "inherit" }}
        >
          {sent ? "✓ Enviado" : "Conectar"}
        </button>
      )}
    </Row>
  );
}

function EmpresaCard({ c }: { c: CompanyResult }) {
  const [, setLocation] = useLocation();
  return (
    <Row onClick={() => setLocation(`/app/empresa/${c.id}`)}>
      <Avatar src={c.avatar_url} name={c.name ?? "?"} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
        {c.industry && <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{c.industry}</div>}
      </div>
      <button
        onClick={e => { e.stopPropagation(); setLocation(`/app/empresa/${c.id}`); }}
        style={{ padding: "6px 14px", background: "#f0f4ff", color: NAVY, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0, fontFamily: "inherit" }}
      >
        Ver página
      </button>
    </Row>
  );
}

function PostCard({ p }: { p: PostResult }) {
  const [, setLocation] = useLocation();
  const authorName = p.author?.full_name ?? "?";
  const goToAuthor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!p.author) return;
    setLocation(p.author.isCompany ? `/app/empresa/${p.author.id}` : `/app/usuario/${p.author.id}`);
  };
  return (
    <Row onClick={() => setLocation(`/app/posts/${p.id}`)}>
      {p.author && <span onClick={goToAuthor} style={{ cursor: "pointer", display: "inline-flex" }}><Avatar src={p.author.avatar_url} name={authorName} size={40} /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {p.author && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <span onClick={goToAuthor} style={{ fontSize: 13, fontWeight: 700, color: NAVY, cursor: "pointer" }}>{authorName}</span>
            {p.author.isCompany && <span style={{ fontSize: 10, color: MUTED, background: BG, borderRadius: 4, padding: "1px 5px" }}>Empresa</span>}
          </div>
        )}
        <div style={{ fontSize: 13, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.content}</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>❤️ {p.likes_count} · 💬 {p.comments_count} · {timeAgo(p.created_at)}</div>
      </div>
    </Row>
  );
}

function VagaCard({ v }: { v: VagaResult }) {
  const [, setLocation] = useLocation();
  return (
    <Row onClick={() => setLocation("/app/oportunidades")}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: NAVY + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>💼</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
        {v.company && <div style={{ fontSize: 12, color: MUTED }}>{v.company}{v.location ? ` · ${v.location}` : ""}</div>}
        {v.contract_type && <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>{v.contract_type}</div>}
      </div>
    </Row>
  );
}

function EventCard({ ev }: { ev: EventResult }) {
  const [, setLocation] = useLocation();
  const date = new Date(ev.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return (
    <Row onClick={() => setLocation("/app/oportunidades")}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: WINE + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📅</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
        <div style={{ fontSize: 12, color: MUTED }}>{date}{ev.location ? ` · ${ev.location}` : ""}</div>
        {ev.entry_type === "paid" && <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>Pago</div>}
      </div>
    </Row>
  );
}

function GroupCard({ g }: { g: GroupResult }) {
  return (
    <Row>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: GOLD + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👥</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{g.name}</div>
        {g.description && <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.description}</div>}
        <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{g.members_count} membros{g.category ? ` · ${g.category}` : ""}</div>
      </div>
    </Row>
  );
}

export default function BuscaPage() {
  const { user, loading: authLoading } = useAuth();
  const myId = user?.id ?? "";
  const searchString = useSearch();
  const initialQuery = new URLSearchParams(searchString).get("q") ?? "";
  const [query,   setQuery]   = useState(initialQuery);
  const [filter,  setFilter]  = useState<Filter>("todos");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didAutoSearch = useRef(false);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const FILTERS: { key: Filter; label: string; icon: string }[] = [
    { key: "todos",       label: "Todos",        icon: "🌐" },
    { key: "pessoas",     label: "Pessoas",      icon: "👤" },
    { key: "publicacoes", label: "Publicações",  icon: "📝" },
    { key: "empresas",    label: "Empresas",     icon: "🏢" },
    { key: "vagas",       label: "Vagas",        icon: "💼" },
    { key: "eventos",     label: "Eventos",      icon: "📅" },
    { key: "grupos",      label: "Grupos",       icon: "👥" },
  ];

  const runSearch = useCallback(async (q: string, f: Filter) => {
    const trimmed = q.trim();
    if (!trimmed) { setResults(EMPTY); setSearched(false); return; }
    if (!myId) return;
    setLoading(true);
    setSearched(true);

    const isAll = f === "todos";
    const lim = (full: number) => isAll ? Math.ceil(full / 2) : full;

    const searchEmpresas = async (): Promise<{ data: CompanyResult[] }> => {
      const [cRes, pRes] = await Promise.all([
        supabase.from("company_pages").select("id, name, avatar_url, industry").ilike("name", `%${trimmed}%`).limit(lim(20)),
        supabase.from("profiles").select("id, full_name, avatar_url, headline").or(`full_name.ilike.%${trimmed}%,headline.ilike.%${trimmed}%`).eq("profile_type", "empresa").limit(lim(10)),
      ]);
      const companies = (cRes.data ?? []) as CompanyResult[];
      const profileEmpresas = (pRes.data ?? []).map((p: any): CompanyResult => ({
        id: p.id, name: p.full_name ?? "?", avatar_url: p.avatar_url, industry: p.headline ?? null,
      }));
      const seen = new Set(companies.map(c => c.id));
      return { data: [...companies, ...profileEmpresas.filter(p => !seen.has(p.id))] };
    };

    const searchPostsViaApi = async (): Promise<{ data: any[] }> => {
      try {
        const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
        const session = await getCachedSession();
        if (!session?.access_token) return { data: [] };
        const params = new URLSearchParams({ q: trimmed, limit: String(lim(20)) });
        const res = await fetch(`${apiBase}/search/posts?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!res.ok) return { data: [] };
        const { posts } = await res.json() as { posts: any[] };
        if (!posts?.length) return { data: [] };

        const userIds = [...new Set(posts.filter((p: any) => !p.company_page_id).map((p: any) => p.user_id as string).filter(Boolean))];
        const companyIds = [...new Set(posts.filter((p: any) => p.company_page_id).map((p: any) => p.company_page_id as string).filter(Boolean))];

        const [{ data: profiles }, { data: companies }] = await Promise.all([
          userIds.length ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds) : Promise.resolve({ data: [] }),
          companyIds.length ? supabase.from("company_pages").select("id, name, avatar_url").in("id", companyIds) : Promise.resolve({ data: [] }),
        ]);

        const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        const cMap = new Map((companies ?? []).map((c: any) => [c.id, c]));

        return {
          data: posts.map((p: any) => {
            if (p.company_page_id && cMap.has(p.company_page_id)) {
              const c = cMap.get(p.company_page_id);
              return { ...p, author: { id: c.id, full_name: c.name, avatar_url: c.avatar_url, isCompany: true } };
            }
            return { ...p, author: p.user_id ? (pMap.get(p.user_id) ?? null) : null };
          }),
        };
      } catch { return { data: [] }; }
    };

    try {
      const [resP, resPub, resE, resV, resEv, resG] = await Promise.all([
        (isAll || f === "pessoas")
          ? supabase.from("profiles").select("id, full_name, username, avatar_url, headline, plan").or(`full_name.ilike.%${trimmed}%,username.ilike.%${trimmed}%,headline.ilike.%${trimmed}%`).eq("profile_type", "pessoa").neq("id", myId).limit(lim(30))
          : Promise.resolve({ data: [] }),

        (isAll || f === "publicacoes") ? searchPostsViaApi() : Promise.resolve({ data: [] }),

        (isAll || f === "empresas") ? searchEmpresas() : Promise.resolve({ data: [] }),

        (isAll || f === "vagas")
          ? supabase.from("opportunities").select("id, title, description, company, location, contract_type, created_at").or(`title.ilike.%${trimmed}%,company.ilike.%${trimmed}%`).eq("type", "vaga").eq("is_active", true).order("created_at", { ascending: false }).limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "eventos")
          ? supabase.from("events").select("id, title, description, start_date, location, entry_type").or(`title.ilike.%${trimmed}%,location.ilike.%${trimmed}%`).eq("is_active", true).order("start_date", { ascending: true }).limit(lim(20))
          : Promise.resolve({ data: [] }),

        (isAll || f === "grupos")
          ? supabase.from("groups").select("id, name, description, members_count, category").or(`name.ilike.%${trimmed}%,description.ilike.%${trimmed}%`).limit(lim(20))
          : Promise.resolve({ data: [] }),
      ]);

      setResults({
        pessoas:     (resP.data   ?? []) as PersonResult[],
        publicacoes: (resPub.data ?? []) as PostResult[],
        empresas:    (resE.data   ?? []) as CompanyResult[],
        vagas:       (resV.data   ?? []) as VagaResult[],
        eventos:     (resEv.data  ?? []) as EventResult[],
        grupos:      (resG.data   ?? []) as GroupResult[],
      });
    } catch { setResults(EMPTY); }

    setLoading(false);
  }, [myId]);

  useEffect(() => {
    if (initialQuery && !didAutoSearch.current && myId) {
      didAutoSearch.current = true;
      runSearch(initialQuery, "todos");
    }
  }, [initialQuery, myId, runSearch]);

  const handleChange = (q: string) => {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(q, filter), 350);
  };

  const handleFilter = (f: Filter) => {
    setFilter(f);
    if (query.trim()) runSearch(query, f);
  };

  const totalCount =
    results.pessoas.length + results.publicacoes.length + results.empresas.length +
    results.vagas.length + results.eventos.length + results.grupos.length;

  const hasResults = totalCount > 0;

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 60 }}>
        {/* Sticky header: search + filters */}
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: WHITE, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ padding: "18px 20px 12px" }}>
            <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 800, color: NAVY }}>Busca Global</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 16px" }}>
              <span style={{ color: MUTED, display: "flex" }}>
                <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={e => handleChange(e.target.value)}
                placeholder="Buscar pessoas, empresas, publicações, vagas…"
                disabled={authLoading}
                style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 15, color: NAVY, fontFamily: "inherit" }}
              />
              {query && (
                <button onClick={() => { setQuery(""); setResults(EMPTY); setSearched(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
              )}
            </div>
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: 6, padding: "0 20px 12px", overflowX: "auto", scrollbarWidth: "none" }}>
            {FILTERS.map(f => {
              const active = filter === f.key;
              const sectionCount: Record<Filter, number> = {
                todos:       totalCount,
                pessoas:     results.pessoas.length,
                publicacoes: results.publicacoes.length,
                empresas:    results.empresas.length,
                vagas:       results.vagas.length,
                eventos:     results.eventos.length,
                grupos:      results.grupos.length,
              };
              const cnt = searched ? sectionCount[f.key] : 0;
              return (
                <button
                  key={f.key}
                  onClick={() => handleFilter(f.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 12px", borderRadius: 20, border: `1.5px solid ${active ? NAVY : BORDER}`,
                    background: active ? NAVY : WHITE, color: active ? WHITE : NAVY,
                    fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                    fontFamily: "inherit", flexShrink: 0, transition: "all 0.15s",
                  }}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                  {searched && cnt > 0 && (
                    <span style={{ background: active ? "rgba(255,255,255,0.3)" : GOLD + "20", color: active ? WHITE : GOLD, borderRadius: 10, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <div style={{ background: WHITE }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 80, color: MUTED }}>⏳ Buscando…</div>
          ) : !searched ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🍷</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: NAVY, margin: "0 0 8px" }}>Busca Global ibhub</p>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Pesquise pessoas, empresas, publicações, vagas, eventos e grupos da rede do vinho</p>
            </div>
          ) : !hasResults ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: "0 0 6px" }}>Nenhum resultado</p>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Tente outro termo de busca</p>
            </div>
          ) : (
            <>
              {/* Pessoas */}
              {results.pessoas.length > 0 && (filter === "todos" || filter === "pessoas") && (
                <>
                  <SectionHeader label="Pessoas" count={results.pessoas.length} />
                  {results.pessoas.map(p => <PersonCard key={p.id} p={p} currentUserId={myId} />)}
                </>
              )}
              {/* Empresas */}
              {results.empresas.length > 0 && (filter === "todos" || filter === "empresas") && (
                <>
                  <SectionHeader label="Empresas" count={results.empresas.length} />
                  {results.empresas.map(c => <EmpresaCard key={c.id} c={c} />)}
                </>
              )}
              {/* Publicações */}
              {results.publicacoes.length > 0 && (filter === "todos" || filter === "publicacoes") && (
                <>
                  <SectionHeader label="Publicações" count={results.publicacoes.length} />
                  {results.publicacoes.map(p => <PostCard key={p.id} p={p} />)}
                </>
              )}
              {/* Vagas */}
              {results.vagas.length > 0 && (filter === "todos" || filter === "vagas") && (
                <>
                  <SectionHeader label="Vagas" count={results.vagas.length} />
                  {results.vagas.map(v => <VagaCard key={v.id} v={v} />)}
                </>
              )}
              {/* Eventos */}
              {results.eventos.length > 0 && (filter === "todos" || filter === "eventos") && (
                <>
                  <SectionHeader label="Eventos" count={results.eventos.length} />
                  {results.eventos.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </>
              )}
              {/* Grupos */}
              {results.grupos.length > 0 && (filter === "todos" || filter === "grupos") && (
                <>
                  <SectionHeader label="Grupos" count={results.grupos.length} />
                  {results.grupos.map(g => <GroupCard key={g.id} g={g} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
