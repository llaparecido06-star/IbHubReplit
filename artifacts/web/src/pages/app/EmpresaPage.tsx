import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchWebCompanyPageById,
  fetchCompanyPostsWeb,
  fetchPublicWineCellar,
  CompanyPageFull,
  Post,
  WineEntry,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f2f3f5";

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
  const [, setLocation] = useLocation();
  const content = post.content ?? "";
  const displayContent = content.length > 260 ? content.slice(0, 260).trimEnd() + "…" : content;
  const companyPage = post.company_page ?? null;
  const authorName   = companyPage ? companyPage.name   : (post.author?.full_name ?? "Membro");
  const authorAvatar = companyPage ? companyPage.avatar_url : post.author?.avatar_url;
  const images: string[] = post.image_urls?.length ? post.image_urls : (post.image_url ? [post.image_url] : []);

  return (
    <div
      onClick={() => setLocation(`/app/posts/${post.id}`)}
      style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "box-shadow .15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Avatar src={authorAvatar} name={authorName} size={32} bg={companyPage ? GOLD : "#722f37"} />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{authorName}</div>
            {companyPage && <span style={{ fontSize: 9, fontWeight: 700, color: WHITE, backgroundColor: GOLD, padding: "1px 5px", borderRadius: 100 }}>Empresa</span>}
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>{timeAgo(post.created_at)}</div>
        </div>
      </div>
      {content && <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{displayContent}</div>}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          {images.slice(0, 4).map((img, i) => (
            <img key={i} src={img} alt="" style={{ flex: 1, minWidth: 0, maxHeight: 200, objectFit: "cover", borderRadius: 10, width: images.length === 1 ? "100%" : undefined }} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: MUTED }}>
        <span>👍 {post.likes_count}</span>
        <span>💬 {post.comments_count}</span>
      </div>
    </div>
  );
}

function WineCard({ wine, onClick }: { wine: WineEntry; onClick: () => void }) {
  const statusLabel: Record<string, string> = { adega: "Em Estoque", consumido: "Consumido", presenteado: "Presenteado", wishlist: "Wishlist" };
  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "box-shadow .15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>{wine.name}</div>
          {(wine.producer || wine.vintage) && (
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{[wine.producer, wine.vintage].filter(Boolean).join(" · ")}</div>
          )}
          {wine.region && <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{wine.region}{wine.country ? `, ${wine.country}` : ""}</div>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, backgroundColor: GOLD + "18", border: `1px solid ${GOLD}30`, padding: "3px 10px", borderRadius: 100, whiteSpace: "nowrap", flexShrink: 0 }}>
          {statusLabel[wine.status] ?? wine.status}
        </span>
      </div>
      {wine.rating > 0 && <div style={{ fontSize: 14, color: GOLD, marginTop: 8 }}>{"★".repeat(wine.rating)}{"☆".repeat(5 - wine.rating)}</div>}
      {wine.score_100 != null && (
        <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginTop: 4 }}>{wine.score_100}/100 pts</div>
      )}
      {wine.notes && (
        <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic", marginTop: 6 }}>"{wine.notes.slice(0, 100)}{wine.notes.length > 100 ? "…" : ""}"</div>
      )}
    </div>
  );
}

function WineModal({ wine, onClose }: { wine: WineEntry; onClose: () => void }) {
  const statusLabel: Record<string, string> = { adega: "Em Estoque", consumido: "Consumido", presenteado: "Presenteado", wishlist: "Wishlist" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: WHITE, borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>🍷 Detalhes</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: MUTED, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 6 }}>{wine.name}</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, backgroundColor: GOLD + "18", border: `1px solid ${GOLD}30`, padding: "4px 12px", borderRadius: 100, marginBottom: 16, display: "inline-block" }}>
          {statusLabel[wine.status] ?? wine.status}
        </span>
        <div style={{ marginTop: 8 }}>
          {[
            { label: "Produtor",  value: wine.producer },
            { label: "Uva/Casta", value: wine.grape },
            { label: "Safra",     value: wine.vintage },
            { label: "Região",    value: wine.region },
            { label: "País",      value: wine.country },
            { label: "Quantidade", value: wine.qty ? String(wine.qty) : null },
            { label: "Preço",     value: wine.price != null ? `R$ ${Number(wine.price).toFixed(2)}` : null },
          ].filter(r => !!r.value).map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 13, color: MUTED }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{r.value}</span>
            </div>
          ))}
        </div>
        {wine.rating > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Avaliação</div>
            <div style={{ fontSize: 22, color: GOLD }}>{"★".repeat(wine.rating)}{"☆".repeat(5 - wine.rating)}</div>
          </div>
        )}
        {(wine.aroma || wine.sabor || wine.harmonizacao) && (
          <div style={{ backgroundColor: BG, borderRadius: 12, padding: 14, marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 2 }}>Avaliação Sensorial</div>
            {wine.aroma && <div style={{ fontSize: 13, color: MUTED }}>👃 <strong>Aroma:</strong> {wine.aroma}</div>}
            {wine.sabor && <div style={{ fontSize: 13, color: MUTED }}>👅 <strong>Sabor:</strong> {wine.sabor}</div>}
            {wine.harmonizacao && <div style={{ fontSize: 13, color: MUTED }}>🍽️ <strong>Harmonização:</strong> {wine.harmonizacao}</div>}
          </div>
        )}
        {wine.notes && (
          <div style={{ backgroundColor: BG, borderRadius: 12, padding: 14, marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 4 }}>Notas</div>
            <div style={{ fontSize: 13, color: NAVY, fontStyle: "italic", lineHeight: 1.6 }}>"{wine.notes}"</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmpresaPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const [, setLocation] = useLocation();

  const currentUserId = profile?.id ?? user?.id ?? "";

  const [company, setCompany]     = useState<CompanyPageFull | null>(null);
  const [posts, setPosts]         = useState<Post[]>([]);
  const [portfolio, setPortfolio] = useState<WineEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"publicacoes" | "portfolio" | "sobre">("publicacoes");
  const [selectedItem, setSelectedItem] = useState<WineEntry | null>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      fetchWebCompanyPageById(companyId),
      fetchCompanyPostsWeb(companyId, currentUserId),
      fetchPublicWineCellar(companyId),
    ]).then(([cp, p, w]) => {
      setCompany(cp);
      setPosts(p);
      setPortfolio(w);
      setLoading(false);
    });
  }, [companyId, currentUserId]);

  const isOwner = company?.owner_id === currentUserId;

  if (loading) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80, color: MUTED }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${GOLD}30`, borderTopColor: GOLD, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Back */}
        <button onClick={() => history.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
          ← Voltar
        </button>

        {/* Company card */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ height: 120, background: `linear-gradient(135deg, #1a2f4a 0%, ${NAVY} 60%, ${GOLD}55 100%)`, position: "relative" }}>
            <div style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", top: -80, right: -40, backgroundColor: "rgba(201,168,76,0.13)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: GOLD, opacity: 0.6 }} />
          </div>

          <div style={{ padding: "0 24px 24px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -36 }}>
              <div style={{ border: `4px solid ${WHITE}`, borderRadius: 14, overflow: "hidden", flexShrink: 0 }}>
                <Avatar src={company.avatar_url} name={company.name} size={80} bg={GOLD} />
              </div>
              {isOwner && (
                <button
                  onClick={() => setLocation(`/app/empresa/${companyId}/editar`)}
                  style={{ padding: "8px 18px", border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", backgroundColor: WHITE, color: NAVY, marginBottom: 6 }}
                >
                  ✏️ Editar página
                </button>
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>{company.name}</h1>
              {company.username && <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>@{company.username}</div>}
              {company.industry && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED, backgroundColor: "#f2f2ed", borderRadius: 20, padding: "2px 10px" }}>
                  🏭 {company.industry}
                </div>
              )}
            </div>

            {company.bio && <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "12px 0 0" }}>{company.bio}</p>}

            {(company.website || company.location) && (
              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                {company.location && <span style={{ fontSize: 13, color: MUTED }}>📍 {company.location}</span>}
                {company.website && (
                  <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: GOLD, textDecoration: "none" }}>
                    🔗 {company.website}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "0 4px", marginBottom: 16, display: "flex" }}>
          {(["publicacoes", "portfolio", "sobre"] as const).map(t => {
            const labels = { publicacoes: "Publicações", portfolio: "Portifólio", sobre: "Sobre" };
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "14px 8px", background: "none", border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: active ? 800 : 500,
                color: active ? GOLD : MUTED,
                borderBottom: active ? `2.5px solid ${GOLD}` : "2.5px solid transparent",
                fontFamily: "inherit", transition: "color .15s",
              }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Tab: Publicações */}
        {tab === "publicacoes" && (
          posts.length === 0 ? (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Nenhuma publicação ainda</h3>
              <p style={{ fontSize: 14, color: MUTED }}>Esta empresa ainda não publicou nada.</p>
            </div>
          ) : (
            posts.map(post => <MiniPostCard key={post.id} post={post} />)
          )
        )}

        {/* Tab: Portifólio */}
        {tab === "portfolio" && (
          portfolio.length === 0 ? (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🍷</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Portifólio ainda vazio</h3>
              <p style={{ fontSize: 14, color: MUTED }}>Esta empresa ainda não adicionou produtos ao portifólio.</p>
            </div>
          ) : (
            portfolio.map(item => <WineCard key={item.id} wine={item} onClick={() => setSelectedItem(item)} />)
          )
        )}

        {/* Tab: Sobre */}
        {tab === "sobre" && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: NAVY, margin: "0 0 16px" }}>Sobre a empresa</h3>
            {company.bio ? (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 16px" }}>{company.bio}</p>
            ) : (
              <p style={{ fontSize: 14, color: MUTED }}>Nenhuma descrição adicionada.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              {company.industry && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🏭</div>
                  <div>
                    <div style={{ fontSize: 11, color: MUTED }}>Setor</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{company.industry}</div>
                  </div>
                </div>
              )}
              {company.location && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📍</div>
                  <div>
                    <div style={{ fontSize: 11, color: MUTED }}>Localização</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{company.location}</div>
                  </div>
                </div>
              )}
              {company.website && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🔗</div>
                  <div>
                    <div style={{ fontSize: 11, color: MUTED }}>Website</div>
                    <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: GOLD, textDecoration: "none" }}>
                      {company.website}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wine/portfolio detail modal */}
        {selectedItem && <WineModal wine={selectedItem} onClose={() => setSelectedItem(null)} />}
      </div>
    </AppShell>
  );
}
