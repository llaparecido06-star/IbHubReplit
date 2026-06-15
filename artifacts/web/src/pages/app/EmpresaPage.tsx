import React, { useEffect, useState, useRef, useMemo } from "react";
import { linkifyText } from "@/utils/linkify";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchWebCompanyPageById,
  fetchCompanyPostsWeb,
  fetchCompanyProducts,
  createCompanyProduct,
  updateCompanyProduct,
  deleteCompanyProduct,
  uploadCompanyProductImage,
  checkIsFollowingCompany,
  toggleCompanyFollow,
  fetchCompanyFollowersCount,
  fetchCompanyPostsCount,
  fetchPublicCompanyOpportunities,
  fetchPublicCompanyEvents,
  checkUserCompanyRole,
  getOrCreateWebConversation,
  toggleLikePost,
  toggleBookmarkPost,
  uploadCompanyCoverWeb,
  updateCompanyPage,
  CompanyPageFull,
  CompanyProduct,
  Post,
  ReactionType,
  CompanyAdminOpportunity,
  AppEvent,
} from "@/services/api";
import VideoPlayer from "@/components/feed/VideoPlayer";
import { PostActionsBar, reactionEmoji } from "@/components/feed/PostActionsBar";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f2f3f5";

const CATEGORY_LABEL: Record<string, string> = {
  produto:   "Produto",
  vinho:     "Vinho",
  acessorio: "Acessório",
  servico:   "Serviço",
  outro:     "Outro",
};
const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "produto",   label: "Produto" },
  { value: "vinho",     label: "Vinho" },
  { value: "acessorio", label: "Acessório" },
  { value: "servico",   label: "Serviço" },
  { value: "outro",     label: "Outro" },
];

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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return ""; }
}

function formatYear(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); }
  catch { return ""; }
}

function Avatar({ src, name, size = 40, bg = "#722f37" }: { src?: string | null; name: string; size?: number; bg?: string }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 800, color: WHITE, flexShrink: 0 }}>
      {(name?.[0] ?? "E").toUpperCase()}
    </div>
  );
}

function MiniPostCard({ post: initialPost, currentUserId }: { post: Post; currentUserId: string | null }) {
  const [, setLocation] = useLocation();
  const [post, setPost] = useState<Post>(initialPost);
  useEffect(() => { setPost(initialPost); }, [initialPost]);

  const content = post.content ?? "";
  const displayContent = content.length > 260 ? content.slice(0, 260).trimEnd() + "…" : content;
  const companyPage = post.company_page ?? null;
  const authorName   = companyPage ? companyPage.name   : (post.author?.full_name ?? "Membro");
  const authorAvatar = companyPage ? companyPage.avatar_url : post.author?.avatar_url;
  const images: string[] = post.image_urls?.length ? post.image_urls : (post.image_url ? [post.image_url] : []);

  const goToAuthor = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (companyPage) { setLocation(`/app/empresa/${companyPage.id}`); return; }
    if (post.author?.id) setLocation(`/app/usuario/${post.author.id}`);
  };

  const handleReact = async (reaction: ReactionType) => {
    if (!currentUserId) return;
    const wasLiked = !!post.is_liked;
    setPost(p => ({
      ...p,
      is_liked: !wasLiked || p.reaction_type !== reaction ? true : false,
      reaction_type: !wasLiked || p.reaction_type !== reaction ? reaction : null,
      likes_count: wasLiked && p.reaction_type === reaction ? Math.max(0, p.likes_count - 1) : (wasLiked ? p.likes_count : p.likes_count + 1),
    }));
    await toggleLikePost(post.id, currentUserId, wasLiked && post.reaction_type === reaction, reaction);
  };

  const handleBookmark = async () => {
    if (!currentUserId) return;
    const was = !!post.is_bookmarked;
    setPost(p => ({ ...p, is_bookmarked: !was }));
    await toggleBookmarkPost(post.id, currentUserId, was);
  };

  return (
    <div
      onClick={() => setLocation(`/app/posts/${post.id}`)}
      style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, marginBottom: 10, cursor: "pointer", transition: "box-shadow .15s", overflow: "hidden" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span onClick={goToAuthor} style={{ cursor: "pointer", display: "inline-flex" }}>
            <Avatar src={authorAvatar} name={authorName} size={32} bg={companyPage ? GOLD : "#722f37"} />
          </span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div onClick={goToAuthor} style={{ fontSize: 13, fontWeight: 700, color: NAVY, cursor: "pointer" }}>{authorName}</div>
              {companyPage && <span style={{ fontSize: 9, fontWeight: 700, color: WHITE, backgroundColor: GOLD, padding: "1px 5px", borderRadius: 100 }}>Empresa</span>}
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>{timeAgo(post.created_at)}</div>
          </div>
        </div>
        {content && <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{linkifyText(displayContent)}</div>}
        {images.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {images.slice(0, 4).map((img, i) => (
              <img key={i} src={img} alt="" style={{ flex: 1, minWidth: 0, maxHeight: 200, objectFit: "cover", borderRadius: 10, width: images.length === 1 ? "100%" : undefined }} />
            ))}
          </div>
        )}
      </div>

      {post.video_url && (
        <div onClick={e => e.stopPropagation()}>
          <VideoPlayer src={post.video_url} />
        </div>
      )}

      {(post.likes_count > 0 || post.comments_count > 0) && (
        <div style={{ display: "flex", gap: 12, padding: "8px 16px", fontSize: 12, color: MUTED, borderTop: `1px solid ${BORDER}` }}>
          {post.likes_count > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>{post.is_liked ? reactionEmoji(post.reaction_type ?? "saude") : "👍"}</span>
              {post.likes_count}
            </span>
          )}
          {post.comments_count > 0 && <span style={{ marginLeft: "auto" }}>{post.comments_count} comentário{post.comments_count !== 1 ? "s" : ""}</span>}
        </div>
      )}

      <div onClick={e => e.stopPropagation()}>
        <PostActionsBar
          post={post}
          onReact={handleReact}
          onComment={() => setLocation(`/app/posts/${post.id}`)}
          onBookmark={handleBookmark}
        />
      </div>
    </div>
  );
}

// ─── Portfolio components ──────────────────────────────────────────────────

function ProductCard({
  product,
  isManager,
  onOpen,
  onEdit,
  onDelete,
}: {
  product: CompanyProduct;
  isManager: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        backgroundColor: WHITE,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        transition: "box-shadow .15s, transform .15s",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ width: "100%", aspectRatio: "4 / 3", backgroundColor: BG, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ fontSize: 38, color: MUTED }}>📦</div>
        )}
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, lineHeight: 1.3, wordBreak: "break-word" }}>{product.name}</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, backgroundColor: GOLD + "18", border: `1px solid ${GOLD}30`, padding: "2px 8px", borderRadius: 100, whiteSpace: "nowrap", flexShrink: 0 }}>
            {CATEGORY_LABEL[product.category] ?? product.category}
          </span>
        </div>
        {product.description && (
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {product.description}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 4 }}>
          {product.price ? (
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{product.price}</div>
          ) : (
            <span />
          )}
          {!isManager && (
            <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>Ver detalhes →</span>
          )}
        </div>
        {isManager && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              style={{ flex: 1, padding: "7px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", backgroundColor: WHITE, color: NAVY }}
            >
              ✏️ Editar
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{ padding: "7px 10px", border: `1px solid #f1c1c5`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", backgroundColor: "#fff5f5", color: "#a82a2a" }}
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductModal({ product, onClose }: { product: CompanyProduct; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: WHITE, borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ position: "relative" }}>
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} style={{ width: "100%", maxHeight: 320, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: 220, backgroundColor: BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, color: MUTED }}>📦</div>
          )}
          <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.55)", color: WHITE, border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, fontWeight: 700 }}>×</button>
        </div>

        <div style={{ padding: 24 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, backgroundColor: GOLD + "18", border: `1px solid ${GOLD}30`, padding: "3px 10px", borderRadius: 100, marginBottom: 10, display: "inline-block" }}>
            {CATEGORY_LABEL[product.category] ?? product.category}
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: NAVY, margin: "0 0 8px" }}>{product.name}</h2>
          {product.price && (
            <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, marginBottom: 12 }}>{product.price}</div>
          )}
          {product.description ? (
            <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 12px", whiteSpace: "pre-wrap" }}>{product.description}</p>
          ) : (
            <p style={{ fontSize: 14, color: MUTED, fontStyle: "italic", margin: "0 0 12px" }}>Sem descrição.</p>
          )}
          <div style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>Adicionado em {formatDate(product.created_at)}</div>
        </div>
      </div>
    </div>
  );
}

function ProductForm({
  initial,
  companyId,
  onClose,
  onSaved,
}: {
  initial: CompanyProduct | null;
  companyId: string;
  onClose: () => void;
  onSaved: (product: CompanyProduct) => void;
}) {
  const [name, setName]               = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice]             = useState(initial?.price ?? "");
  const [category, setCategory]       = useState(initial?.category ?? "produto");
  const [imageUrl, setImageUrl]       = useState<string | null>(initial?.image_url ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(initial?.image_url ?? null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track blob: URLs so we can revoke them on replace / unmount.
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function pickFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) { setError("Selecione um arquivo de imagem (jpg, png, webp)."); return; }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) { setError("Imagem muito grande. Limite: 5 MB."); return; }
    setPendingFile(file);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError("Dê um nome ao item."); return; }
    setSaving(true);
    try {
      let saved: CompanyProduct | null = null;
      if (initial) {
        const ok = await updateCompanyProduct(initial.id, {
          name: name.trim(),
          description: description.trim() || null,
          price: price.trim() || null,
          category,
        });
        if (!ok) { setError("Não foi possível salvar."); setSaving(false); return; }
        saved = { ...initial, name: name.trim(), description: description.trim() || null, price: price.trim() || null, category, image_url: imageUrl };
      } else {
        saved = await createCompanyProduct({
          company_id: companyId,
          name: name.trim(),
          description: description.trim() || null,
          price: price.trim() || null,
          category,
          image_url: null,
        });
        if (!saved) { setError("Não foi possível criar o item."); setSaving(false); return; }
      }

      if (pendingFile && saved) {
        const url = await uploadCompanyProductImage(saved.id, pendingFile);
        if (url) {
          await updateCompanyProduct(saved.id, { image_url: url });
          saved = { ...saved, image_url: url };
        }
      }

      if (saved) onSaved(saved);
      onClose();
    } catch (e) {
      console.warn("ProductForm save:", e);
      setError("Erro inesperado ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: WHITE, borderRadius: 20, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>{initial ? "Editar item" : "Novo item do portfólio"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: MUTED, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6, display: "block" }}>Foto do item</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ width: "100%", aspectRatio: "4 / 3", backgroundColor: BG, borderRadius: 12, border: `1.5px dashed ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", position: "relative" }}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="prévia" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ textAlign: "center", color: MUTED }}>
                  <div style={{ fontSize: 36 }}>📷</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Clique para escolher uma imagem</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>JPG, PNG ou WEBP — máx. 5 MB</div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
              style={{ display: "none" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6, display: "block" }}>
              Nome <span style={{ color: "#a82a2a" }}>*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Vinho Cabernet Reserva"
              style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 14, color: NAVY, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6, display: "block" }}>Categoria</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 14, color: NAVY, outline: "none", backgroundColor: WHITE, boxSizing: "border-box" }}
            >
              {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6, display: "block" }}>Preço (opcional)</label>
            <input
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="Ex: R$ 89,90"
              style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 14, color: NAVY, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 6, display: "block" }}>Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Conte sobre este item, harmonizações, tipo de uva..."
              style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 14, color: NAVY, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          {error && (
            <div style={{ backgroundColor: "#fff5f5", border: "1px solid #f1c1c5", color: "#a82a2a", padding: "8px 12px", borderRadius: 10, fontSize: 13 }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{ flex: 1, padding: "12px 16px", border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", backgroundColor: WHITE, color: NAVY, opacity: saving ? 0.6 : 1 }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1, padding: "12px 16px", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: saving ? "default" : "pointer", backgroundColor: GOLD, color: WHITE, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Salvando…" : (initial ? "Salvar" : "Adicionar")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cards for Vagas / Eventos ────────────────────────────────────────────

function OpportunityCard({ op, onClick }: { op: CompanyAdminOpportunity; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, cursor: "pointer", transition: "box-shadow .15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{op.title}</div>
          {op.location && <div style={{ fontSize: 12, color: MUTED }}>📍 {op.location}</div>}
          {op.contract_type && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>💼 {op.contract_type}</div>}
        </div>
        {op.salary && <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, whiteSpace: "nowrap" }}>{op.salary}</span>}
      </div>
      {op.description && (
        <div style={{ fontSize: 13, color: NAVY, marginTop: 8, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {op.description}
        </div>
      )}
    </div>
  );
}

function EventCard({ ev, onClick }: { ev: AppEvent; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", cursor: "pointer", transition: "box-shadow .15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      {ev.cover_image_url && (
        <img src={ev.cover_image_url} alt={ev.title} style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ padding: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{ev.title}</div>
        <div style={{ fontSize: 12, color: MUTED }}>📅 {formatDate(ev.start_date)}</div>
        {ev.location && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>📍 {ev.location}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {ev.location_type && <span style={{ fontSize: 10, fontWeight: 700, color: NAVY, backgroundColor: BG, padding: "2px 8px", borderRadius: 100 }}>{ev.location_type === "online" ? "Online" : "Presencial"}</span>}
          {ev.entry_type && <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, backgroundColor: GOLD + "18", padding: "2px 8px", borderRadius: 100 }}>{ev.entry_type === "pago" ? "Pago" : "Gratuito"}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

type TabKey = "publicacoes" | "vagas" | "sobre" | "portfolio" | "eventos";

export default function EmpresaPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const { profile, user } = useAuth();
  const [location, setLocation] = useLocation();

  const currentUserId = profile?.id ?? user?.id ?? "";

  const [company, setCompany]         = useState<CompanyPageFull | null>(null);
  const [posts, setPosts]             = useState<Post[]>([]);
  const [products, setProducts]       = useState<CompanyProduct[]>([]);
  const [opportunities, setOpps]      = useState<CompanyAdminOpportunity[]>([]);
  const [oppsLoaded, setOppsLoaded]   = useState(false);
  const [oppsLoading, setOppsLoading] = useState(false);
  const [events, setEvents]           = useState<AppEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [followers, setFollowers]     = useState(0);
  const [postsCount, setPostsCount]   = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy]   = useState(false);
  const [msgBusy, setMsgBusy]         = useState(false);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<TabKey>(() => {
    if (typeof window === "undefined") return "publicacoes";
    const t = new URLSearchParams(window.location.search).get("tab");
    const valid: TabKey[] = ["publicacoes", "vagas", "sobre", "portfolio", "eventos"];
    return (valid as string[]).includes(t ?? "") ? (t as TabKey) : "publicacoes";
  });
  // Sync tab when the URL ?tab= changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("tab");
    const valid: TabKey[] = ["publicacoes", "vagas", "sobre", "portfolio", "eventos"];
    if (t && (valid as string[]).includes(t) && t !== tab) {
      setTab(t as TabKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);
  const [selectedProduct, setSelectedProduct] = useState<CompanyProduct | null>(null);
  const [editingProduct, setEditingProduct]   = useState<CompanyProduct | null>(null);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [isManager, setIsManager]     = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    // Reset lazy-loaded tab state when companyId changes.
    setOpps([]);
    setOppsLoaded(false);
    setOppsLoading(false);
    setEvents([]);
    setEventsLoaded(false);
    setEventsLoading(false);
    Promise.all([
      fetchWebCompanyPageById(companyId),
      fetchCompanyPostsWeb(companyId, currentUserId),
      fetchCompanyProducts(companyId),
      fetchCompanyFollowersCount(companyId),
      fetchCompanyPostsCount(companyId),
      currentUserId ? checkIsFollowingCompany(companyId, currentUserId) : Promise.resolve(false),
      currentUserId ? checkUserCompanyRole(companyId, currentUserId) : Promise.resolve({ isOwner: false, role: null as string | null }),
    ]).then(([cp, p, prods, followersN, postsN, follow, role]) => {
      setCompany(cp);
      setPosts(p);
      setProducts(prods);
      setFollowers(followersN);
      setPostsCount(postsN);
      setIsFollowing(follow);
      // Owner-only: matches company_pages / company_products RLS.
      setIsManager(role.isOwner || role.role === "editor");
      setLoading(false);
    }).catch(err => {
      console.warn("EmpresaPage load:", err);
      setLoading(false);
    });
  }, [companyId, currentUserId]);

  // Lazy-load vagas/eventos on first tab open; loaded flag avoids re-fetching empty results.
  useEffect(() => {
    if (!companyId || !company) return;
    if (tab === "vagas" && !oppsLoaded && !oppsLoading) {
      setOppsLoading(true);
      fetchPublicCompanyOpportunities(companyId, "vaga", company.owner_id)
        .then(setOpps)
        .catch(() => {})
        .finally(() => { setOppsLoaded(true); setOppsLoading(false); });
    }
    if (tab === "eventos" && !eventsLoaded && !eventsLoading) {
      setEventsLoading(true);
      fetchPublicCompanyEvents(companyId)
        .then(setEvents)
        .catch(() => {})
        .finally(() => { setEventsLoaded(true); setEventsLoading(false); });
    }
  }, [tab, companyId, company]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOwner = company?.owner_id === currentUserId;

  const handleFollow = async () => {
    if (!currentUserId || !companyId || followBusy) return;
    setFollowBusy(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowers(c => Math.max(0, c + (wasFollowing ? -1 : 1)));
    const ok = await toggleCompanyFollow(companyId, currentUserId, wasFollowing);
    if (!ok) {
      setIsFollowing(wasFollowing);
      setFollowers(c => Math.max(0, c + (wasFollowing ? 1 : -1)));
    }
    setFollowBusy(false);
  };

  const handleMessage = async () => {
    if (!currentUserId || !company || msgBusy) return;
    setMsgBusy(true);
    try {
      const convId = await getOrCreateWebConversation(currentUserId, company.owner_id, companyId, false);
      if (convId) setLocation(`/app/mensagens?conv=${convId}`);
      else setLocation("/app/mensagens");
    } finally {
      setMsgBusy(false);
    }
  };

  const handleDeleteProduct = async (product: CompanyProduct) => {
    if (!confirm(`Remover "${product.name}" do portfólio?`)) return;
    const ok = await deleteCompanyProduct(product.id);
    if (ok) setProducts(list => list.filter(p => p.id !== product.id));
  };

  // Companies don't have a "Conexões" counter (no person-to-person handshake).
  const stats = useMemo(() => ([
    { label: "Seguidores", value: followers },
    { label: "Publicações", value: postsCount },
  ]), [followers, postsCount]);

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

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "publicacoes", label: "Publicações" },
    { key: "vagas",       label: "Vagas" },
    { key: "sobre",       label: "Sobre" },
    { key: "portfolio",   label: "Portfólio" },
    { key: "eventos",     label: "Eventos" },
  ];

  return (
    <AppShell>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        {/* Back */}
        <button onClick={() => history.back()} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 13, fontWeight: 600, marginBottom: 16, padding: 0 }}>
          ← Voltar
        </button>

        {/* Company card (parity with personal profile) */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
          {/* Cover photo */}
          <div style={{ height: 130, position: "relative", overflow: "hidden" }}>
            {company.cover_url ? (
              <img
                src={company.cover_url}
                alt="Capa da empresa"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <>
                <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, #1a2f4a 0%, ${NAVY} 60%, ${GOLD}55 100%)` }} />
                <div style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", top: -80, right: -40, backgroundColor: "rgba(201,168,76,0.13)" }} />
              </>
            )}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: GOLD, opacity: 0.6 }} />
            {/* Upload overlay — managers only */}
            {isManager && (
              <>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !companyId || !currentUserId) return;
                    setCoverUploading(true);
                    const url = await uploadCompanyCoverWeb(companyId, file, currentUserId);
                    if (url) {
                      await updateCompanyPage(companyId, { cover_url: url });
                      setCompany(prev => prev ? { ...prev, cover_url: url } : prev);
                    }
                    setCoverUploading(false);
                  }}
                />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                  style={{
                    position: "absolute", bottom: 10, right: 10,
                    padding: "6px 14px", borderRadius: 8, border: "none",
                    backgroundColor: "rgba(13,27,42,0.72)", color: WHITE,
                    fontSize: 12, fontWeight: 700, cursor: coverUploading ? "default" : "pointer",
                    backdropFilter: "blur(4px)", display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {coverUploading ? "⏳ Enviando…" : "📷 Alterar capa"}
                </button>
              </>
            )}
          </div>

          <div style={{ padding: "0 24px 20px", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: -42, flexWrap: "wrap" }}>
              <div style={{ border: `4px solid ${WHITE}`, borderRadius: 14, overflow: "hidden", flexShrink: 0 }}>
                <Avatar src={company.avatar_url} name={company.name} size={88} bg={GOLD} />
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {isOwner ? (
                  <>
                    <button
                      onClick={() => setLocation(`/app/empresa/${companyId}/admin`)}
                      style={{ padding: "9px 18px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", backgroundColor: GOLD, color: WHITE }}
                    >
                      📋 Gerenciar Anúncios
                    </button>
                    <button
                      onClick={() => setLocation(`/app/empresa/${companyId}/editar`)}
                      style={{ padding: "9px 18px", border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", backgroundColor: WHITE, color: NAVY }}
                    >
                      ✏️ Editar página
                    </button>
                  </>
                ) : currentUserId ? (
                  <>
                    <button
                      onClick={handleFollow}
                      disabled={followBusy}
                      style={{
                        padding: "9px 18px", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: followBusy ? "default" : "pointer",
                        backgroundColor: isFollowing ? WHITE : GOLD,
                        color: isFollowing ? NAVY : WHITE,
                        boxShadow: isFollowing ? `inset 0 0 0 1.5px ${BORDER}` : "none",
                        opacity: followBusy ? 0.7 : 1,
                      }}
                    >
                      {isFollowing ? "✓ Seguindo" : "+ Seguir"}
                    </button>
                    <button
                      onClick={handleMessage}
                      disabled={msgBusy}
                      style={{ padding: "9px 18px", border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: msgBusy ? "default" : "pointer", backgroundColor: WHITE, color: NAVY, opacity: msgBusy ? 0.7 : 1 }}
                    >
                      💬 Mensagem
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: NAVY, margin: "0 0 4px" }}>{company.name}</h1>
              {company.username && <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>@{company.username}</div>}
              {company.industry && (
                <div style={{ fontSize: 14, color: NAVY, fontWeight: 600, marginBottom: 6 }}>{company.industry}</div>
              )}
            </div>

            {(company.website || company.location) && (
              <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                {company.location && <span style={{ fontSize: 13, color: MUTED }}>📍 {company.location}</span>}
                {company.website && (
                  <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: GOLD, textDecoration: "none" }}>
                    🔗 {company.website}
                  </a>
                )}
              </div>
            )}

            {/* Stats row */}
            <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${BORDER}` }}>
              {stats.map(s => (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "0 4px", marginBottom: 16, display: "flex", overflowX: "auto" }}>
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => {
                setTab(t.key);
                if (typeof window !== "undefined") {
                  const params = new URLSearchParams(window.location.search);
                  params.set("tab", t.key);
                  setLocation(`${window.location.pathname}?${params.toString()}`, { replace: true });
                }
              }} style={{
                flex: "1 0 auto", minWidth: 88, padding: "14px 12px", background: "none", border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: active ? 800 : 500,
                color: active ? GOLD : MUTED,
                borderBottom: active ? `2.5px solid ${GOLD}` : "2.5px solid transparent",
                fontFamily: "inherit", transition: "color .15s", whiteSpace: "nowrap",
              }}>
                {t.label}
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
            posts.map(post => <MiniPostCard key={post.id} post={post} currentUserId={user?.id ?? null} />)
          )
        )}

        {/* Tab: Vagas */}
        {tab === "vagas" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {oppsLoading || !oppsLoaded ? (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", color: MUTED }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${GOLD}30`, borderTopColor: GOLD, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 10px" }} />
                Carregando vagas...
              </div>
            ) : opportunities.length === 0 ? (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Nenhuma vaga publicada</h3>
                <p style={{ fontSize: 14, color: MUTED }}>Esta empresa ainda não tem vagas abertas.</p>
              </div>
            ) : (
              opportunities.map(op => (
                <OpportunityCard key={op.id} op={op} onClick={() => setLocation(`/app/oportunidades/${op.id}`)} />
              ))
            )}
          </div>
        )}

        {/* Tab: Sobre */}
        {tab === "sobre" && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: NAVY, margin: "0 0 16px" }}>Sobre a empresa</h3>
            {company.bio ? (
              <p style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, margin: "0 0 16px", whiteSpace: "pre-wrap" }}>{company.bio}</p>
            ) : (
              <p style={{ fontSize: 14, color: MUTED, marginBottom: 16 }}>Nenhuma descrição adicionada.</p>
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
              {company.created_at && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${GOLD}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📅</div>
                  <div>
                    <div style={{ fontSize: 11, color: MUTED }}>No ibhub desde</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{formatYear(company.created_at)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Portfolio */}
        {tab === "portfolio" && (
          <div>
            {isManager && (
              <button
                onClick={() => setCreatingProduct(true)}
                style={{ width: "100%", padding: "12px 16px", border: `1.5px dashed ${GOLD}`, borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: "pointer", backgroundColor: GOLD + "10", color: GOLD, marginBottom: 12 }}
              >
                + Adicionar item ao portfólio
              </button>
            )}
            {products.length === 0 ? (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "56px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Portfólio vazio</h3>
                <p style={{ fontSize: 14, color: MUTED, marginBottom: isManager ? 16 : 0 }}>
                  {isManager ? "Adicione produtos, vinhos, acessórios ou serviços para exibir aqui." : "Esta empresa ainda não adicionou itens ao portfólio."}
                </p>
                {isManager && (
                  <button
                    onClick={() => setCreatingProduct(true)}
                    style={{ padding: "10px 22px", backgroundColor: GOLD, color: WHITE, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  >
                    + Adicionar primeiro item
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {products.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isManager={isManager}
                    onOpen={() => setSelectedProduct(p)}
                    onEdit={() => setEditingProduct(p)}
                    onDelete={() => handleDeleteProduct(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Eventos */}
        {tab === "eventos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {eventsLoading || !eventsLoaded ? (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", color: MUTED }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${GOLD}30`, borderTopColor: GOLD, borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 10px" }} />
                Carregando eventos...
              </div>
            ) : events.length === 0 ? (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: NAVY, margin: "0 0 8px" }}>Nenhum evento</h3>
                <p style={{ fontSize: 14, color: MUTED }}>Esta empresa ainda não tem eventos publicados.</p>
              </div>
            ) : (
              events.map(ev => <EventCard key={ev.id} ev={ev} onClick={() => setLocation(`/app/eventos/${ev.id}`)} />)
            )}
          </div>
        )}

        {/* Modals */}
        {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
        {(creatingProduct || editingProduct) && companyId && (
          <ProductForm
            initial={editingProduct}
            companyId={companyId}
            onClose={() => { setCreatingProduct(false); setEditingProduct(null); }}
            onSaved={(saved) => {
              setProducts(list => {
                const idx = list.findIndex(p => p.id === saved.id);
                if (idx >= 0) { const next = [...list]; next[idx] = saved; return next; }
                return [saved, ...list];
              });
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
