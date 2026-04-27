import React, { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { supabase } from "@/lib/supabase";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const TABS = ["Ativos", "Todos"];

interface AppStory {
  id: string;
  user_id: string;
  image_url: string | null;
  expires_at: string | null;
  created_at: string;
  author_name?: string | null;
  author_username?: string | null;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function AdminMomentos() {
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<AppStory[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("Ativos");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewsCount, setViewsCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const [storiesRes, viewsRes, likesRes] = await Promise.all([
        supabase.from("stories").select("id, user_id, image_url, expires_at, created_at, profile:profiles!stories_user_id_fkey(full_name, username)").order("created_at", { ascending: false }),
        supabase.from("story_views").select("id", { count: "exact", head: true }),
        supabase.from("story_likes").select("id", { count: "exact", head: true }),
      ]);
      const raw = (storiesRes.data ?? []) as unknown as Array<{ id: string; user_id: string; image_url: string | null; expires_at: string | null; created_at: string; profile: { full_name: string | null; username: string | null }[] | { full_name: string | null; username: string | null } | null }>;
      setStories(raw.map((s) => ({
        id: s.id,
        user_id: s.user_id,
        image_url: s.image_url,
        expires_at: s.expires_at,
        created_at: s.created_at,
        author_name: Array.isArray(s.profile) ? (s.profile as Array<{ full_name: string | null }>)[0]?.full_name : (s.profile as { full_name: string | null } | null)?.full_name,
        author_username: Array.isArray(s.profile) ? (s.profile as Array<{ username: string | null }>)[0]?.username : (s.profile as { username: string | null } | null)?.username,
      })));
      setViewsCount(viewsRes.count ?? 0);
      setLikesCount(likesRes.count ?? 0);
    } catch (e) {
      console.error("AdminMomentos load:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDelete = async (story: AppStory) => {
    if (!confirm(`Remover story de "${story.author_name ?? "usuário"}"? Esta ação é irreversível.`)) return;
    setDeletingId(story.id);
    const { error } = await supabase.from("stories").delete().eq("id", story.id);
    if (!error) {
      setStories((prev) => prev.filter((s) => s.id !== story.id));
    } else {
      alert("Erro ao remover story.");
    }
    setDeletingId(null);
  };

  const now = new Date().toISOString();
  const activeStories = stories.filter((s) => !s.expires_at || s.expires_at > now);

  const filtered = (tab === "Ativos" ? activeStories : stories).filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.author_name ?? "").toLowerCase().includes(q) || (s.author_username ?? "").toLowerCase().includes(q);
  });

  const kpiItems = [
    { icon: "▶", iconBg: "#d1fae5", label: "Ativos",  value: activeStories.length },
    { icon: "📋", iconBg: "#ede9fe", label: "Total",   value: stories.length },
    { icon: "👁", iconBg: "#fef9ee", label: "Visualizações", value: viewsCount },
    { icon: "❤", iconBg: "#ffe4e6", label: "Curtidas", value: likesCount },
  ];

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Momentos</h1>
            <p style={{ fontSize: 14, color: "#8a93a2", margin: 0 }}>Gerenciamento de stories da plataforma</p>
          </div>
          <button onClick={load} style={{ padding: "8px 16px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}>↻ Atualizar</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
          {kpiItems.map((k) => (
            <div key={k.label} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 14, padding: 18 }}>
              <div style={{ width: 42, height: 42, backgroundColor: k.iconBg, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: NAVY }}>{loading ? "..." : k.value}</div>
              <div style={{ fontSize: 12, color: "#8a93a2", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa" }}>🔍</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por autor..." style={{ width: "100%", padding: "10px 12px 10px 36px", border: "1px solid #e8eaed", borderRadius: 10, fontSize: 14, outline: "none", backgroundColor: "#fff", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: "10px 16px", border: "1px solid #e8eaed", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 700 : 400, backgroundColor: tab === t ? NAVY : "#fff", color: tab === t ? "#fff" : "#555" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando momentos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>▶</div>
            <p style={{ color: "#aaa" }}>Nenhum momento encontrado.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((story) => {
              const isActive = !story.expires_at || story.expires_at > now;
              return (
                <div key={story.id} style={{ backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                  {story.image_url ? (
                    <img src={story.image_url} alt="" style={{ width: 52, height: 52, borderRadius: 9, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 9, backgroundColor: `${GOLD}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>▶</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{story.author_name ?? "Usuário"}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, backgroundColor: isActive ? "#d1fae5" : "#f3f4f6", color: isActive ? "#059669" : "#6b7280", padding: "2px 7px", borderRadius: 5 }}>
                        {isActive ? "Ativo" : "Expirado"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#8a93a2" }}>
                      @{story.author_username ?? "—"} · {timeAgo(story.created_at)}
                      {story.expires_at && ` · expira ${new Date(story.expires_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(story)}
                    disabled={deletingId === story.id}
                    style={{ padding: "6px 14px", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                  >{deletingId === story.id ? "..." : "🗑 Remover"}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
