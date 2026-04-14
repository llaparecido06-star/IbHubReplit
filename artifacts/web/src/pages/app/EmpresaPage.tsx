import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchWebCompanyPageById,
  fetchCompanyPostsWeb,
  CompanyPageFull,
  Post,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function Avatar({ src, name, size = 40, bg = "#722f37" }: { src?: string | null; name: string; size?: number; bg?: string }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0 }}>
      {(name?.[0] ?? "E").toUpperCase()}
    </div>
  );
}

function MiniPostCard({ post }: { post: Post }) {
  const content = post.content ?? "";
  const displayContent = content.length > 220 ? content.slice(0, 220).trimEnd() + "…" : content;
  const authorName = post.author?.full_name ?? "Membro";
  return (
    <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Avatar src={post.author?.avatar_url} name={authorName} size={32} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{authorName}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{timeAgo(post.created_at)}</div>
        </div>
      </div>
      <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{displayContent}</div>
      {post.image_url && <img src={post.image_url} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, marginTop: 10 }} />}
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: MUTED }}>
        <span>👍 {post.likes_count}</span>
        <span>💬 {post.comments_count}</span>
      </div>
    </div>
  );
}

export default function EmpresaPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const [, setLocation] = useLocation();

  const currentUserId = profile?.id ?? user?.id ?? "";

  const [company, setCompany] = useState<CompanyPageFull | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [tab, setTab] = useState<"publicacoes" | "sobre">("publicacoes");

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setLoadingPosts(true);
    Promise.all([
      fetchWebCompanyPageById(companyId),
      fetchCompanyPostsWeb(companyId, currentUserId),
    ]).then(([cp, p]) => {
      setCompany(cp);
      setPosts(p);
      setLoading(false);
      setLoadingPosts(false);
    });
  }, [companyId, currentUserId]);

  const isOwner = company?.owner_id === currentUserId;

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80, color: MUTED }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
          Carregando página da empresa…
        </div>
      </AppShell>
    );
  }

  if (!company) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80, color: MUTED }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>Empresa não encontrada</h2>
          <button onClick={() => setLocation("/app")} style={{ marginTop: 16, padding: "10px 24px", backgroundColor: GOLD, color: WHITE, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Voltar ao feed
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Back */}
        <button onClick={() => history.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
          ← Voltar
        </button>

        {/* Company card */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ height: 100, background: `linear-gradient(135deg, #1a2f4a 0%, #0d1b2a 60%, ${GOLD} 100%)` }} />
          <div style={{ padding: "0 20px 20px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -28 }}>
              <div style={{ border: "3px solid white", borderRadius: 12, overflow: "hidden" }}>
                <Avatar src={company.avatar_url} name={company.name} size={80} bg={GOLD} />
              </div>
              {isOwner && (
                <button onClick={() => setLocation(`/app/empresa/${companyId}/editar`)} style={{ padding: "8px 18px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", backgroundColor: WHITE, color: NAVY, marginBottom: 4 }}>
                  ✏️ Editar página
                </button>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>{company.name}</h1>
              {company.username && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>@{company.username}</div>}
              {company.industry && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED, backgroundColor: "#f2f2ed", borderRadius: 20, padding: "2px 10px" }}>
                  🏭 {company.industry}
                </div>
              )}
            </div>

            {company.bio && (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "12px 0 0" }}>{company.bio}</p>
            )}

            {(company.website || company.location) && (
              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                {company.location && <span style={{ fontSize: 13, color: MUTED }}>📍 {company.location}</span>}
                {company.website && (
                  <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                     target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: 13, color: GOLD, textDecoration: "none" }}>
                    🔗 {company.website}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "0 4px", marginBottom: 16, display: "flex" }}>
          {(["publicacoes", "sobre"] as const).map(t => {
            const labels = { publicacoes: "Publicações", sobre: "Sobre" };
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "14px 8px", background: "none", border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: active ? 800 : 500,
                color: active ? GOLD : MUTED,
                borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
                fontFamily: "inherit",
              }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {tab === "publicacoes" ? (
          loadingPosts ? (
            <div style={{ textAlign: "center", padding: 48, color: MUTED }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>🍷</div>Carregando publicações…
            </div>
          ) : posts.length === 0 ? (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Nenhuma publicação ainda</h3>
              <p style={{ fontSize: 14, color: MUTED }}>Esta empresa ainda não publicou nada.</p>
            </div>
          ) : (
            posts.map(post => <MiniPostCard key={post.id} post={post} />)
          )
        ) : (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: NAVY, margin: "0 0 16px" }}>Sobre a empresa</h3>
            {company.bio ? (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 16px" }}>{company.bio}</p>
            ) : (
              <p style={{ fontSize: 14, color: MUTED }}>Nenhuma descrição adicionada.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {company.industry && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 18 }}>🏭</span>
                  <div>
                    <div style={{ fontSize: 11, color: MUTED }}>Setor</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{company.industry}</div>
                  </div>
                </div>
              )}
              {company.location && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 18 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 11, color: MUTED }}>Localização</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{company.location}</div>
                  </div>
                </div>
              )}
              {company.website && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 18 }}>🔗</span>
                  <div>
                    <div style={{ fontSize: 11, color: MUTED }}>Website</div>
                    <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
                       target="_blank" rel="noopener noreferrer"
                       style={{ fontSize: 14, fontWeight: 600, color: GOLD, textDecoration: "none" }}>
                      {company.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
