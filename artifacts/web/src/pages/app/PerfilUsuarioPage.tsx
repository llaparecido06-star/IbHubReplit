import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchPublicUserProfile,
  fetchUserPosts,
  fetchProfileStats,
  sendWebConnectionRequest,
  checkWebConnectionStatus,
  checkWebFollowStatus,
  toggleWebFollow,
  getOrCreateWebConversation,
  fetchPublicWineCellar,
  UserProfile,
  Post,
  WineEntry,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WINE   = "#722f37";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f2f3f5";

/* ── helpers ── */
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
function fmtN(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

/* ── sub-components ── */
function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: WINE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0 }}>
      {(name?.[0] ?? "U").toUpperCase()}
    </div>
  );
}

function PlanBadge({ plan }: { plan?: string | null }) {
  if (!plan || plan === "free" || plan === "gratuito") return null;
  const colors: Record<string, string> = {
    exclusive: "#7B2FBE", executivo: "#7B2FBE",
    business: "#1a56db", empresa: "#1a56db",
    premium: GOLD, profissional: GOLD,
    basico: "#374151",
  };
  const labels: Record<string, string> = {
    exclusive: "Executivo", executivo: "Executivo",
    business: "Business", empresa: "Business",
    premium: "Premium", profissional: "Premium",
    basico: "Básico",
  };
  const color = colors[plan] ?? "#6b7280";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: WHITE, backgroundColor: color, padding: "2px 9px", borderRadius: 100 }}>
      {labels[plan] ?? plan}
    </span>
  );
}

function Tag({ label, color = GOLD }: { label: string; color?: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color, backgroundColor: color + "18", border: `1px solid ${color}30`, padding: "3px 10px", borderRadius: 100 }}>
      {label}
    </span>
  );
}

function PostCard({ post }: { post: Post }) {
  const [, setLocation] = useLocation();
  const content = post.content ?? "";
  const displayContent = content.length > 300 ? content.slice(0, 300).trimEnd() + "…" : content;
  const images: string[] = post.image_urls?.length ? post.image_urls : (post.image_url ? [post.image_url] : []);
  return (
    <div
      onClick={() => setLocation(`/app/posts/${post.id}`)}
      style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 18px", marginBottom: 12, cursor: "pointer", transition: "box-shadow .15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      {content && <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: images.length ? 10 : 0 }}>{displayContent}</div>}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: content ? 10 : 0, flexWrap: images.length > 2 ? "wrap" : "nowrap" }}>
          {images.slice(0, 4).map((img, i) =>
            images.length === 1 ? (
              <img key={i} src={img} alt="" style={{ width: "100%", maxHeight: 400, objectFit: "contain", borderRadius: 10, backgroundColor: "#f2f3f5", display: "block" }} />
            ) : (
              <img key={i} src={img} alt="" style={{ flex: 1, minWidth: 0, height: 180, objectFit: "cover", borderRadius: 10 }} />
            )
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 18, marginTop: 12, fontSize: 13, color: MUTED, alignItems: "center" }}>
        <span>👍 {post.likes_count}</span>
        <span>💬 {post.comments_count}</span>
        <span style={{ marginLeft: "auto" }}>{timeAgo(post.created_at)}</span>
      </div>
    </div>
  );
}

function WineCard({ wine, onClick }: { wine: WineEntry; onClick: () => void }) {
  const statusLabel: Record<string, string> = { adega: "Na Adega", consumido: "Consumido", presenteado: "Presenteado", wishlist: "Wishlist" };
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
      {wine.rating > 0 && (
        <div style={{ fontSize: 14, color: GOLD, marginTop: 8 }}>{"★".repeat(wine.rating)}{"☆".repeat(5 - wine.rating)}</div>
      )}
      {wine.notes && (
        <div style={{ fontSize: 12, color: MUTED, fontStyle: "italic", marginTop: 6 }}>"{wine.notes.slice(0, 100)}{wine.notes.length > 100 ? "…" : ""}"</div>
      )}
    </div>
  );
}

/* ── Wine detail modal ── */
function WineModal({ wine, onClose }: { wine: WineEntry; onClose: () => void }) {
  const statusLabel: Record<string, string> = { adega: "Na Adega", consumido: "Consumido", presenteado: "Presenteado", wishlist: "Wishlist" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: WHITE, borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>🍷 Detalhes do Vinho</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: MUTED, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 6 }}>{wine.name}</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, backgroundColor: GOLD + "18", border: `1px solid ${GOLD}30`, padding: "4px 12px", borderRadius: 100, marginBottom: 16, display: "inline-block" }}>
          {statusLabel[wine.status] ?? wine.status}
        </span>
        <div style={{ marginTop: 8 }}>
          {[
            { label: "Produtor", value: wine.producer },
            { label: "Uva/Casta", value: wine.grape },
            { label: "Safra", value: wine.vintage },
            { label: "Região", value: wine.region },
            { label: "País", value: wine.country },
            { label: "Quantidade", value: wine.qty ? String(wine.qty) : null },
            { label: "Preço", value: wine.price != null ? `R$ ${Number(wine.price).toFixed(2)}` : null },
            { label: "Local de Armazenamento", value: wine.storage },
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

/* ════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════ */
export default function PerfilUsuarioPage() {
  const { id: targetId } = useParams<{ id: string }>();
  const { profile: currentProfile, user } = useAuth();
  const [, setLocation] = useLocation();
  const currentUserId = currentProfile?.id ?? user?.id ?? "";

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ connections: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [wines, setWines] = useState<WineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"publicacoes" | "adega" | "sobre">("publicacoes");

  /* Connection / follow state */
  const [connectionStatus, setConnectionStatus] = useState<"none" | "pending" | "connected">("none");
  const [isFollowing, setIsFollowing] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);

  const [selectedWine, setSelectedWine] = useState<WineEntry | null>(null);

  useEffect(() => {
    if (!targetId) return;
    if (targetId === currentUserId) { setLocation("/app/perfil"); return; }

    setLoading(true);
    Promise.all([
      fetchPublicUserProfile(targetId),
      fetchProfileStats(targetId),
      fetchUserPosts(targetId),
      fetchPublicWineCellar(targetId),
      currentUserId ? checkWebConnectionStatus(targetId, currentUserId) : Promise.resolve("none" as const),
      currentUserId ? checkWebFollowStatus(targetId, currentUserId) : Promise.resolve(false),
    ]).then(([prof, s, p, w, connStatus, following]) => {
      setUserProfile(prof);
      setStats(s);
      setPosts(p);
      setWines(w);
      setConnectionStatus(connStatus);
      setIsFollowing(following);
      setLoading(false);
    });
  }, [targetId, currentUserId]);

  const handleConnect = async () => {
    if (!currentUserId || connectLoading || connectionStatus !== "none") return;
    setConnectLoading(true);
    setConnectionStatus("pending");
    if (!isFollowing) setIsFollowing(true);
    await sendWebConnectionRequest(targetId!, currentUserId);
    setConnectLoading(false);
  };

  const handleFollow = async () => {
    if (!currentUserId || followLoading) return;
    setFollowLoading(true);
    const next = !isFollowing;
    setIsFollowing(next);
    setStats(s => ({ ...s, followers: s.followers + (next ? 1 : -1) }));
    await toggleWebFollow(targetId!, currentUserId, !next);
    setFollowLoading(false);
  };

  const handleMessage = async () => {
    if (!currentUserId || msgLoading || !targetId) return;
    setMsgLoading(true);
    const convId = await getOrCreateWebConversation(currentUserId, targetId);
    setMsgLoading(false);
    if (convId) {
      setLocation(`/app/mensagens?conv=${convId}`);
    }
  };

  /* Mensagem button is available when following OR connected */
  const canMessage = isFollowing || connectionStatus === "connected";

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

  if (!userProfile) {
    return (
      <AppShell>
        <div style={{ textAlign: "center", padding: 80, color: MUTED }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>😕</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>Perfil não encontrado</h2>
          <p style={{ fontSize: 14, color: MUTED }}>Este usuário não existe ou foi removido.</p>
          <button onClick={() => setLocation("/app")} style={{ marginTop: 16, padding: "10px 24px", backgroundColor: GOLD, color: WHITE, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
            Voltar ao feed
          </button>
        </div>
      </AppShell>
    );
  }

  const headline = userProfile.headline ?? [userProfile.position, userProfile.company].filter(Boolean).join(" · ");
  const isCompany = userProfile.profile_type === "empresa";
  const tab2 = isCompany ? "portfólio" : "adega";
  const tab2Label = isCompany ? "Portfólio" : "Adega";

  /* Connect button state */
  const connectBtnLabel = connectionStatus === "connected" ? "✓ Conectado" : connectionStatus === "pending" ? "Solicitado" : "Conectar";
  const connectBtnDisabled = connectionStatus !== "none" || connectLoading;
  const connectBtnBg = connectionStatus === "connected" ? "#e8f5e9" : connectionStatus === "pending" ? BG : GOLD;
  const connectBtnColor = connectionStatus === "connected" ? "#16a34a" : connectionStatus === "pending" ? MUTED : WHITE;

  return (
    <AppShell>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Back */}
        <button onClick={() => history.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
          ← Voltar
        </button>

        {/* Profile card */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, marginBottom: 14 }}>

          {/* Cover */}
          <div style={{ height: 120, background: `linear-gradient(135deg, ${NAVY} 0%, #1e3a5f 60%, #2a4a6b 100%)`, position: "relative", borderRadius: "16px 16px 0 0", overflow: "hidden" }}>
            <div style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", top: -90, right: -50, backgroundColor: "rgba(201,168,76,0.12)" }} />
            <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", bottom: -50, left: -30, backgroundColor: "rgba(201,168,76,0.07)" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: GOLD, opacity: 0.6 }} />
          </div>

          <div style={{ padding: "0 24px 24px" }}>
            {/* Avatar + action buttons row */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: -44 }}>
              <div style={{ border: `4px solid ${WHITE}`, borderRadius: "50%", flexShrink: 0 }}>
                <Avatar src={userProfile.avatar_url} name={userProfile.full_name} size={88} />
              </div>
              <div style={{ display: "flex", gap: 8, paddingBottom: 6, flexWrap: "wrap" }}>
                {/* 1. Seguir */}
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  style={{
                    padding: "9px 18px", border: `1.5px solid ${isFollowing ? BORDER : NAVY}`, borderRadius: 10,
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    backgroundColor: isFollowing ? "transparent" : NAVY,
                    color: isFollowing ? NAVY : WHITE,
                    opacity: followLoading ? 0.7 : 1,
                  }}
                >
                  {isFollowing ? "Seguindo" : "Seguir"}
                </button>

                {/* 2. Conectar (hidden when already connected) */}
                {connectionStatus !== "connected" && (
                  <button
                    onClick={handleConnect}
                    disabled={connectBtnDisabled}
                    style={{
                      padding: "9px 18px", border: "none", borderRadius: 10,
                      fontSize: 13, fontWeight: 700, cursor: connectBtnDisabled ? "default" : "pointer",
                      backgroundColor: connectBtnBg, color: connectBtnColor,
                    }}
                  >
                    {connectLoading ? "…" : connectBtnLabel}
                  </button>
                )}
                {connectionStatus === "connected" && (
                  <div style={{ padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, backgroundColor: "#e8f5e9", color: "#16a34a" }}>
                    ✓ Conectado
                  </div>
                )}

                {/* 3. Mensagem — only visible when following OR connected */}
                {canMessage && (
                  <button
                    onClick={handleMessage}
                    disabled={msgLoading}
                    style={{
                      padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                      cursor: msgLoading ? "default" : "pointer",
                      border: connectionStatus === "connected" ? "none" : `1.5px solid ${GOLD}`,
                      backgroundColor: connectionStatus === "connected" ? GOLD : "transparent",
                      color: connectionStatus === "connected" ? WHITE : GOLD,
                      opacity: msgLoading ? 0.7 : 1,
                    }}
                  >
                    {msgLoading ? "…" : "Mensagem"}
                  </button>
                )}
              </div>
            </div>

            {/* Name + plan */}
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: 0 }}>{userProfile.full_name}</h1>
                <PlanBadge plan={userProfile.plan} />
              </div>
              {userProfile.username && <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>@{userProfile.username}</div>}
              {headline && <div style={{ fontSize: 14, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>{headline}</div>}
              {userProfile.location && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 13, color: MUTED }}>
                  <span>📍</span> {userProfile.location}
                </div>
              )}
              {userProfile.bio && (
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, margin: "10px 0 0" }}>{userProfile.bio}</p>
              )}
            </div>

            {/* Tags */}
            {(userProfile.areas_of_expertise ?? []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {(userProfile.areas_of_expertise ?? []).map(a => <Tag key={a} label={a} color={GOLD} />)}
              </div>
            )}
            {(userProfile.certifications ?? []).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Certificações</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(userProfile.certifications ?? []).map(c => <Tag key={c} label={c} color={NAVY} />)}
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{ display: "flex", gap: 0, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
              {[
                { label: "Conexões",   value: stats.connections },
                { label: "Seguidores", value: stats.followers },
                { label: "Seguindo",   value: stats.following },
              ].map((s, i, arr) => (
                <React.Fragment key={s.label}>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: GOLD }}>{fmtN(s.value)}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.label}</div>
                  </div>
                  {i < arr.length - 1 && <div style={{ width: 1, backgroundColor: BORDER }} />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "0 4px", marginBottom: 16, display: "flex" }}>
          {(["publicacoes", tab2, "sobre"] as const).map(t => {
            const labels: Record<string, string> = { publicacoes: "Publicações", [tab2]: tab2Label, sobre: "Sobre" };
            const active = tab === t;
            return (
              <button key={t} onClick={() => setTab(t as any)} style={{
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

        {/* Tab content */}
        {tab === "publicacoes" && (
          posts.length === 0 ? (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Nenhuma publicação ainda</h3>
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>Este usuário ainda não publicou nada.</p>
            </div>
          ) : (
            posts.map(post => <PostCard key={post.id} post={post} />)
          )
        )}

        {tab === tab2 && (
          wines.length === 0 ? (
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🍷</div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>
                {isCompany ? "Portfólio ainda vazio" : "Adega ainda vazia"}
              </h3>
              <p style={{ fontSize: 14, color: MUTED, margin: 0 }}>
                {isCompany ? "Esta empresa ainda não compartilhou seu portfólio." : "Este usuário ainda não compartilhou nada na adega."}
              </p>
            </div>
          ) : (
            wines.map(wine => <WineCard key={wine.id} wine={wine} onClick={() => setSelectedWine(wine)} />)
          )
        )}

        {tab === "sobre" && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: NAVY, margin: "0 0 16px" }}>Sobre</h3>
            {userProfile.bio ? (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 16px" }}>{userProfile.bio}</p>
            ) : (
              <p style={{ fontSize: 14, color: MUTED, margin: "0 0 16px" }}>Nenhuma bio adicionada.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(userProfile.position || userProfile.company) && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>🏢</span>
                  </div>
                  <div>
                    {userProfile.position && <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{userProfile.position}</div>}
                    {userProfile.company && <div style={{ fontSize: 13, color: MUTED }}>{userProfile.company}</div>}
                  </div>
                </div>
              )}
              {userProfile.location && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 16 }}>📍</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{userProfile.location}</div>
                </div>
              )}
            </div>
            {(userProfile.certifications ?? []).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Certificações</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(userProfile.certifications ?? []).map(c => <Tag key={c} label={c} color={NAVY} />)}
                </div>
              </div>
            )}
            {(userProfile.areas_of_expertise ?? []).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Áreas de Expertise</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(userProfile.areas_of_expertise ?? []).map(a => <Tag key={a} label={a} color={GOLD} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wine detail modal */}
        {selectedWine && <WineModal wine={selectedWine} onClose={() => setSelectedWine(null)} />}
      </div>
    </AppShell>
  );
}
