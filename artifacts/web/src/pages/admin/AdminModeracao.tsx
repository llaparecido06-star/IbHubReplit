import React, { useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  ModerationPost,
  fetchRecentPosts,
  deletePost,
} from "@/services/adminApi";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";

export default function AdminModeracao() {
  const [posts, setPosts] = useState<ModerationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async (q?: string) => {
    setLoading(true);
    const data = await fetchRecentPosts(100, q);
    setPosts(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSearchSubmit = () => { load(search || undefined); };

  const handleDelete = async (post: ModerationPost) => {
    if (!confirm(`Remover este post de "${post.author_name ?? "usuário"}"? Esta ação é irreversível.`)) return;
    setDeleting(post.id);
    const ok = await deletePost(post.id);
    setDeleting(null);
    if (ok) {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } else {
      alert("Erro ao remover post.");
    }
  };

  const filtered = posts;

  return (
    <AdminShell>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>Moderação</h1>
        <p style={{ fontSize: 14, color: "#8a93a2", margin: "0 0 24px" }}>
          Revise e remova conteúdo inapropriado
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              placeholder="Buscar por conteúdo ou autor..."
              style={{
                width: "100%",
                padding: "10px 12px 10px 38px",
                border: "1px solid #e8eaed",
                borderRadius: 10,
                fontSize: 14,
                outline: "none",
                backgroundColor: "#fff",
                boxSizing: "border-box",
              }}
            />
          </div>
          <button
            onClick={handleSearchSubmit}
            style={{ padding: "10px 18px", backgroundColor: NAVY, border: "none", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff" }}
          >Buscar</button>
          <button
            onClick={() => { setSearch(""); load(); }}
            style={{ padding: "10px 18px", backgroundColor: "#fff", border: "1px solid #e8eaed", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600, color: NAVY }}
          >↻ Tudo</button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 36 }}>⏳</div>
            <p style={{ color: "#aaa" }}>Carregando posts...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80, backgroundColor: "#fff", borderRadius: 14, border: "1px solid #e8eaed" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ color: NAVY, margin: "0 0 8px" }}>Nenhum conteúdo para moderar</h3>
            <p style={{ color: "#8a93a2", margin: 0 }}>Tudo está em ordem.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, color: "#8a93a2", marginBottom: 4 }}>
              {filtered.length} post{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </div>
            {filtered.map((post) => (
              <div
                key={post.id}
                style={{
                  backgroundColor: "#fff",
                  border: "1px solid #e8eaed",
                  borderRadius: 14,
                  padding: 18,
                  display: "flex",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  backgroundColor: "#722f37",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 15, fontWeight: 800,
                }}>
                  {(post.author_name ?? "?")?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{post.author_name ?? "Usuário desconhecido"}</span>
                      <span style={{ fontSize: 11, color: "#aaa", marginLeft: 10 }}>
                        {new Date(post.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(post)}
                      disabled={deleting === post.id}
                      style={{
                        padding: "5px 12px",
                        backgroundColor: "#fef2f2",
                        color: "#dc2626",
                        border: "1px solid #fca5a5",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >{deleting === post.id ? "Removendo..." : "🗑️ Remover"}</button>
                  </div>
                  {post.content && (
                    <p style={{ fontSize: 14, color: "#333", margin: "0 0 8px", lineHeight: 1.5, wordBreak: "break-word" }}>
                      {post.content.length > 300 ? post.content.slice(0, 300) + "..." : post.content}
                    </p>
                  )}
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Imagem do post"
                      style={{ maxWidth: 240, maxHeight: 160, objectFit: "cover", borderRadius: 8, border: "1px solid #e8eaed" }}
                    />
                  )}
                  {!post.content && !post.image_url && (
                    <p style={{ fontSize: 13, color: "#aaa", fontStyle: "italic", margin: 0 }}>Post sem conteúdo textual</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
