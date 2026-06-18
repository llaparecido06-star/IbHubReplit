import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { supabase, getCachedSession } from "@/lib/supabase";
import { sendWebConnectionRequest, toggleCompanyFollow } from "@/services/api";

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
interface CompanyResult  { id: string; name: string; avatar_url: string | null; industry: string | null; isCompanyPage?: boolean; }
interface PostResult     { id: string; content: string; created_at: string; likes_count: number; comments_count: number; user_id?: string | null; company_page_id?: string | null; author?: { id: string; full_name: string | null; avatar_url: string | null; isCompany?: boolean } | null; }
interface VagaResult     { id: string; title: string; description: string | null; company: string | null; location: string | null; contract_type: string | null; created_at: string; }
interface EventResult    { id: string; title: string; description: string | null; start_date: string; location: string | null; entry_type: string; }
interface GroupResult    { id: string; name: string; description: string | null; members_count: number; category: string | null; }

interface SearchResults {
  pessoas: PersonResult[]; publicacoes: PostResult[];
  empresas: CompanyResult[]; vagas: VagaResult[];
  eventos: EventResult[]; grupos: GroupResult[];
}
interface SuggestionState {
  pessoas: PersonResult[]; empresas: CompanyResult[]; publicacoes: PostResult[];
  vagas: VagaResult[]; eventos: EventResult[]; grupos: GroupResult[];
}
const EMPTY_RESULTS: SearchResults = { pessoas: [], publicacoes: [], empresas: [], vagas: [], eventos: [], grupos: [] };
const EMPTY_SUGGESTIONS: SuggestionState = { pessoas: [], empresas: [], publicacoes: [], vagas: [], eventos: [], grupos: [] };

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
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: hover && onClick ? BG : WHITE, borderBottom: `1px solid ${BORDER}`, cursor: onClick ? "pointer" : "default", transition: "background 0.12s" }}
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

function PersonCard({
  p, isEmpresa = false, currentUserId,
  isSent, onSent,
}: {
  p: PersonResult; isEmpresa?: boolean; currentUserId: string;
  isSent: boolean; onSent: () => void;
}) {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const plan = PLAN_LABELS[p.plan ?? ""];
  const isSelf = p.id === currentUserId;

  const handleConnect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSent || isSelf || loading) return;
    setLoading(true);
    await sendWebConnectionRequest(p.id, currentUserId);
    onSent();
    setLoading(false);
  };

  return (
    <Row onClick={() => setLocation(isEmpresa ? `/app/empresa/${p.id}` : `/app/usuario/${p.id}`)}>
      <Avatar src={p.avatar_url} name={p.full_name ?? "?"} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.full_name ?? "—"}</span>
          {plan && <span style={{ fontSize: 11, fontWeight: 700, color: plan.color, background: plan.color + "18", borderRadius: 5, padding: "1px 6px", flexShrink: 0 }}>{plan.label}</span>}
        </div>
        {p.headline && <div style={{ fontSize: 13, color: MUTED, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.headline}</div>}
        {p.username && <div style={{ fontSize: 12, color: MUTED }}>@{p.username}</div>}
      </div>
      {!isEmpresa && !isSelf && (
        <button
          onClick={handleConnect}
          disabled={isSent || loading}
          style={{
            padding: "6px 14px",
            background: isSent ? "#e8f5e9" : NAVY,
            color: isSent ? "#16a34a" : WHITE,
            border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
            cursor: isSent || loading ? "default" : "pointer",
            flexShrink: 0, fontFamily: "inherit", opacity: loading ? 0.6 : 1,
          }}
        >
          {isSent ? "✓ Enviado" : loading ? "…" : "Conectar"}
        </button>
      )}
    </Row>
  );
}

function EmpresaCard({
  c, isFollowing, onToggleFollow, currentUserId,
}: {
  c: CompanyResult; isFollowing: boolean; onToggleFollow: () => void; currentUserId: string;
}) {
  const [, setLocation] = useLocation();
  const [loadingFollow, setLoadingFollow] = useState(false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loadingFollow || !currentUserId) return;
    setLoadingFollow(true);
    await toggleCompanyFollow(c.id, currentUserId, isFollowing);
    onToggleFollow();
    setLoadingFollow(false);
  };

  return (
    <Row onClick={() => setLocation(`/app/empresa/${c.id}`)}>
      <Avatar src={c.avatar_url} name={c.name ?? "?"} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
        {c.industry && <div style={{ fontSize: 13, color: MUTED, marginTop: 1 }}>{c.industry}</div>}
      </div>
      {c.isCompanyPage !== false && (
        <button
          onClick={handleFollow}
          disabled={loadingFollow}
          style={{
            padding: "6px 14px",
            background: isFollowing ? BG : NAVY,
            color: isFollowing ? NAVY : WHITE,
            border: isFollowing ? `1.5px solid ${BORDER}` : "none",
            borderRadius: 7, fontSize: 12, fontWeight: 700,
            cursor: loadingFollow ? "default" : "pointer",
            flexShrink: 0, fontFamily: "inherit", opacity: loadingFollow ? 0.6 : 1,
          }}
        >
          {isFollowing ? "✓ Seguindo" : "Seguir"}
        </button>
      )}
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
      {p.author && <span onClick={goToAuthor} style={{ cursor: "pointer", display: "inline-flex" }}><Avatar src={p.author.avatar_url} name={authorName} size={44} /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {p.author && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <span onClick={goToAuthor} style={{ fontSize: 14, fontWeight: 700, color: NAVY, cursor: "pointer" }}>{authorName}</span>
            {p.author.isCompany && <span style={{ fontSize: 11, color: MUTED, background: BG, borderRadius: 4, padding: "1px 6px" }}>Empresa</span>}
          </div>
        )}
        <div style={{ fontSize: 14, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.content}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>❤️ {p.likes_count} · 💬 {p.comments_count} · {timeAgo(p.created_at)}</div>
      </div>
    </Row>
  );
}

function VagaCard({ v }: { v: VagaResult }) {
  const [, setLocation] = useLocation();
  return (
    <Row onClick={() => setLocation("/app/oportunidades")}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: NAVY + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>💼</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title}</div>
        {v.company && <div style={{ fontSize: 13, color: MUTED }}>{v.company}{v.location ? ` · ${v.location}` : ""}</div>}
        {v.contract_type && <div style={{ fontSize: 12, color: GOLD, marginTop: 2 }}>{v.contract_type}</div>}
      </div>
    </Row>
  );
}

function EventCard({ ev }: { ev: EventResult }) {
  const [, setLocation] = useLocation();
  const date = new Date(ev.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return (
    <Row onClick={() => setLocation("/app/oportunidades")}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: WINE + "12", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📅</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
        <div style={{ fontSize: 13, color: MUTED }}>{date}{ev.location ? ` · ${ev.location}` : ""}</div>
        {ev.entry_type === "paid" && <div style={{ fontSize: 12, color: GOLD, marginTop: 2 }}>Pago</div>}
      </div>
    </Row>
  );
}

function GroupCard({ g }: { g: GroupResult }) {
  const [, setLocation] = useLocation();
  return (
    <Row onClick={() => setLocation("/app/grupos")}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: GOLD + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>👥</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{g.name}</div>
        {g.description && <div style={{ fontSize: 13, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.description}</div>}
        <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{g.members_count} membros{g.category ? ` · ${g.category}` : ""}</div>
      </div>
    </Row>
  );
}

function SuggestionHeader({ label, icon, onVerMais }: { label: string; icon: string; onVerMais?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 6px", borderBottom: `1px solid ${BORDER}`, background: BG }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: NAVY, letterSpacing: "0.03em", display: "flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span>{label}
      </span>
      {onVerMais && (
        <button
          onClick={onVerMais}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: GOLD, fontWeight: 700, fontFamily: "inherit", padding: 0 }}
        >
          Ver mais →
        </button>
      )}
    </div>
  );
}

export default function BuscaPage() {
  const { user, loading: authLoading } = useAuth();
  const myId = user?.id ?? "";
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const initialQuery = new URLSearchParams(searchString).get("q") ?? "";
  const [query,   setQuery]   = useState(initialQuery);
  const [filter,  setFilter]  = useState<Filter>("todos");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [suggestions, setSuggestions] = useState<SuggestionState>(EMPTY_SUGGESTIONS);

  // Tracks which person IDs the current user has already sent/established connections to.
  // Pre-loaded from DB on mount so it persists across navigation and re-renders.
  const [sentConnectionIds, setSentConnectionIds] = useState<Set<string>>(new Set());

  // Tracks which company_page IDs the current user already follows.
  const [followedCompanyIds, setFollowedCompanyIds] = useState<Set<string>>(new Set());

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
    if (!trimmed) { setResults(EMPTY_RESULTS); setSearched(false); return; }
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
      const companies = ((cRes.data ?? []) as any[]).map(c => ({ ...c, isCompanyPage: true })) as CompanyResult[];
      const profileEmpresas = ((pRes.data ?? []) as any[]).map((p): CompanyResult => ({
        id: p.id, name: p.full_name ?? "?", avatar_url: p.avatar_url, industry: p.headline ?? null, isCompanyPage: false,
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

      const newEmpresas = (resE.data ?? []) as CompanyResult[];
      setResults({
        pessoas:     (resP.data   ?? []) as PersonResult[],
        publicacoes: (resPub.data ?? []) as PostResult[],
        empresas:    newEmpresas,
        vagas:       (resV.data   ?? []) as VagaResult[],
        eventos:     (resEv.data  ?? []) as EventResult[],
        grupos:      (resG.data   ?? []) as GroupResult[],
      });

      // Update follow status for any new companies in search results
      const newCompanyPageIds = newEmpresas.filter(c => c.isCompanyPage !== false).map(c => c.id);
      if (newCompanyPageIds.length && myId) {
        const { data: followData } = await supabase
          .from("company_follows")
          .select("company_id")
          .eq("user_id", myId)
          .in("company_id", newCompanyPageIds);
        if (followData?.length) {
          setFollowedCompanyIds(prev => {
            const next = new Set(prev);
            (followData as any[]).forEach(f => next.add(f.company_id));
            return next;
          });
        }
      }
    } catch { setResults(EMPTY_RESULTS); }

    setLoading(false);
  }, [myId]);

  useEffect(() => {
    if (initialQuery && !didAutoSearch.current && myId) {
      didAutoSearch.current = true;
      runSearch(initialQuery, "todos");
    }
  }, [initialQuery, myId, runSearch]);

  // Load all suggestion categories on mount and pre-fetch connection/follow statuses
  useEffect(() => {
    if (!myId) return;
    (async () => {
      const [pRes, eRes, postRes, vagaRes, eventoRes, grupoRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, avatar_url, headline, plan")
          .eq("profile_type", "pessoa").neq("id", myId).order("created_at", { ascending: false }).limit(8),
        supabase.from("company_pages").select("id, name, avatar_url, industry")
          .order("created_at", { ascending: false }).limit(8),
        supabase.from("posts").select("id, content, created_at, likes_count, comments_count, user_id, company_page_id")
          .is("parent_id", null).order("created_at", { ascending: false }).limit(6),
        supabase.from("opportunities").select("id, title, description, company, location, contract_type, created_at")
          .eq("type", "vaga").eq("is_active", true).order("created_at", { ascending: false }).limit(8),
        supabase.from("events").select("id, title, description, start_date, location, entry_type")
          .eq("is_active", true).order("start_date", { ascending: true }).limit(8),
        supabase.from("groups").select("id, name, description, members_count, category").limit(8),
      ]);

      // Enrich posts with author info
      const posts = (postRes.data ?? []) as any[];
      const userIds = [...new Set(posts.filter(p => !p.company_page_id).map(p => p.user_id).filter(Boolean))] as string[];
      const companyIds = [...new Set(posts.filter(p => p.company_page_id).map(p => p.company_page_id).filter(Boolean))] as string[];
      const [{ data: profData }, { data: compData }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds) : Promise.resolve({ data: [] }),
        companyIds.length ? supabase.from("company_pages").select("id, name, avatar_url").in("id", companyIds) : Promise.resolve({ data: [] }),
      ]);
      const pMap = new Map((profData ?? []).map((p: any) => [p.id, p]));
      const cMap = new Map((compData ?? []).map((c: any) => [c.id, c]));
      const postsWithAuthors: PostResult[] = posts.map((p: any) => {
        if (p.company_page_id && cMap.has(p.company_page_id)) {
          const c = cMap.get(p.company_page_id);
          return { ...p, author: { id: c.id, full_name: c.name, avatar_url: c.avatar_url, isCompany: true } };
        }
        return { ...p, author: p.user_id ? (pMap.get(p.user_id) ?? null) : null };
      });

      const pessoas = (pRes.data ?? []) as PersonResult[];
      const empresas = ((eRes.data ?? []) as any[]).map(c => ({ ...c, isCompanyPage: true })) as CompanyResult[];

      setSuggestions({
        pessoas,
        empresas,
        publicacoes: postsWithAuthors,
        vagas:    (vagaRes.data   ?? []) as VagaResult[],
        eventos:  (eventoRes.data ?? []) as EventResult[],
        grupos:   (grupoRes.data  ?? []) as GroupResult[],
      });

      // Pre-fetch connection statuses — mark people with existing connections/requests as "sent"
      const personIds = pessoas.map(p => p.id);
      if (personIds.length) {
        const { data: connData } = await supabase
          .from("connections")
          .select("requester_id, receiver_id, status")
          .or(
            `and(requester_id.eq.${myId},receiver_id.in.(${personIds.join(",")})),` +
            `and(requester_id.in.(${personIds.join(",")}),receiver_id.eq.${myId})`
          );
        if (connData?.length) {
          const initialSent = new Set<string>();
          (connData as any[]).forEach(c => {
            // Mark as sent: any pending (we sent) or accepted connection
            if (c.requester_id === myId) initialSent.add(c.receiver_id);
            else initialSent.add(c.requester_id);
          });
          setSentConnectionIds(initialSent);
        }
      }

      // Pre-fetch which suggestion companies the user already follows
      const companyPageIds = empresas.map(c => c.id);
      if (companyPageIds.length) {
        const { data: followData } = await supabase
          .from("company_follows")
          .select("company_id")
          .eq("user_id", myId)
          .in("company_id", companyPageIds);
        if (followData?.length) {
          setFollowedCompanyIds(new Set((followData as any[]).map(f => f.company_id)));
        }
      }
    })();
  }, [myId]);

  const handleChange = (q: string) => {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(q, filter), 350);
  };

  const handleFilter = (f: Filter) => {
    setFilter(f);
    if (query.trim()) runSearch(query, f);
    // If no query, just switch filter — the suggestions view handles the rest
  };

  const markSent = (personId: string) => {
    setSentConnectionIds(prev => new Set(prev).add(personId));
  };

  const toggleFollowed = (companyId: string) => {
    setFollowedCompanyIds(prev => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId);
      else next.add(companyId);
      return next;
    });
  };

  const totalCount =
    results.pessoas.length + results.publicacoes.length + results.empresas.length +
    results.vagas.length + results.eventos.length + results.grupos.length;

  const hasResults = totalCount > 0;

  // Which suggestion sections to show when !searched (no query)
  const showAll = filter === "todos";

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
                <button onClick={() => { setQuery(""); setResults(EMPTY_RESULTS); setSearched(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 18, padding: 0, lineHeight: 1 }}>×</button>
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

        {/* Results / Suggestions */}
        <div style={{ background: WHITE }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 80, color: MUTED }}>⏳ Buscando…</div>
          ) : !searched ? (
            /* ── Suggestions view (no active search query) ── */
            <div>
              {/* Pessoas para conectar */}
              {(showAll || filter === "pessoas") && suggestions.pessoas.length > 0 && (
                <>
                  <SuggestionHeader
                    icon="👤"
                    label="Pessoas para conectar"
                    onVerMais={showAll ? () => handleFilter("pessoas") : undefined}
                  />
                  {(showAll ? suggestions.pessoas.slice(0, 4) : suggestions.pessoas).map(p => (
                    <PersonCard
                      key={p.id} p={p} currentUserId={myId}
                      isSent={sentConnectionIds.has(p.id)}
                      onSent={() => markSent(p.id)}
                    />
                  ))}
                </>
              )}

              {/* Empresas para seguir */}
              {(showAll || filter === "empresas") && suggestions.empresas.length > 0 && (
                <>
                  <SuggestionHeader
                    icon="🏢"
                    label="Empresas para seguir"
                    onVerMais={showAll ? () => handleFilter("empresas") : undefined}
                  />
                  {(showAll ? suggestions.empresas.slice(0, 4) : suggestions.empresas).map(c => (
                    <EmpresaCard
                      key={c.id} c={c}
                      currentUserId={myId}
                      isFollowing={followedCompanyIds.has(c.id)}
                      onToggleFollow={() => toggleFollowed(c.id)}
                    />
                  ))}
                </>
              )}

              {/* Publicações recentes */}
              {(showAll || filter === "publicacoes") && suggestions.publicacoes.length > 0 && (
                <>
                  <SuggestionHeader
                    icon="📝"
                    label="Publicações recentes"
                    onVerMais={showAll ? () => setLocation("/app/feed") : undefined}
                  />
                  {(showAll ? suggestions.publicacoes.slice(0, 4) : suggestions.publicacoes).map(p => (
                    <PostCard key={p.id} p={p} />
                  ))}
                </>
              )}

              {/* Vagas */}
              {(filter === "vagas") && suggestions.vagas.length > 0 && (
                <>
                  <SuggestionHeader icon="💼" label="Vagas em destaque" />
                  {suggestions.vagas.map(v => <VagaCard key={v.id} v={v} />)}
                </>
              )}

              {/* Eventos */}
              {(filter === "eventos") && suggestions.eventos.length > 0 && (
                <>
                  <SuggestionHeader icon="📅" label="Próximos eventos" />
                  {suggestions.eventos.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </>
              )}

              {/* Grupos */}
              {(filter === "grupos") && suggestions.grupos.length > 0 && (
                <>
                  <SuggestionHeader icon="👥" label="Grupos para participar" />
                  {suggestions.grupos.map(g => <GroupCard key={g.id} g={g} />)}
                </>
              )}

              {/* Fallback — ainda carregando ou sem dados */}
              {suggestions.pessoas.length === 0 && suggestions.empresas.length === 0 && suggestions.publicacoes.length === 0 && (
                <div style={{ textAlign: "center", padding: 80 }}>
                  <div style={{ fontSize: 52, marginBottom: 16 }}>🍷</div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: NAVY, margin: "0 0 8px" }}>Busca Global ibhub</p>
                  <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Pesquise pessoas, empresas, publicações, vagas, eventos e grupos da rede do vinho</p>
                </div>
              )}
            </div>
          ) : !hasResults ? (
            <div style={{ textAlign: "center", padding: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: NAVY, margin: "0 0 6px" }}>Nenhum resultado</p>
              <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Tente outro termo de busca</p>
            </div>
          ) : (
            /* ── Search results ── */
            <>
              {results.pessoas.length > 0 && (filter === "todos" || filter === "pessoas") && (
                <>
                  <SectionHeader label="Pessoas" count={results.pessoas.length} />
                  {results.pessoas.map(p => (
                    <PersonCard
                      key={p.id} p={p} currentUserId={myId}
                      isSent={sentConnectionIds.has(p.id)}
                      onSent={() => markSent(p.id)}
                    />
                  ))}
                </>
              )}
              {results.empresas.length > 0 && (filter === "todos" || filter === "empresas") && (
                <>
                  <SectionHeader label="Empresas" count={results.empresas.length} />
                  {results.empresas.map(c => (
                    <EmpresaCard
                      key={c.id} c={c}
                      currentUserId={myId}
                      isFollowing={followedCompanyIds.has(c.id)}
                      onToggleFollow={() => toggleFollowed(c.id)}
                    />
                  ))}
                </>
              )}
              {results.publicacoes.length > 0 && (filter === "todos" || filter === "publicacoes") && (
                <>
                  <SectionHeader label="Publicações" count={results.publicacoes.length} />
                  {results.publicacoes.map(p => <PostCard key={p.id} p={p} />)}
                </>
              )}
              {results.vagas.length > 0 && (filter === "todos" || filter === "vagas") && (
                <>
                  <SectionHeader label="Vagas" count={results.vagas.length} />
                  {results.vagas.map(v => <VagaCard key={v.id} v={v} />)}
                </>
              )}
              {results.eventos.length > 0 && (filter === "todos" || filter === "eventos") && (
                <>
                  <SectionHeader label="Eventos" count={results.eventos.length} />
                  {results.eventos.map(ev => <EventCard key={ev.id} ev={ev} />)}
                </>
              )}
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
