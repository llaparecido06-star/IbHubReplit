import React, { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import { formatRelativeDate } from "@/utils/dateUtils";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

interface MarketItem {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  category: string | null;
  condition: string | null;
  location: string | null;
  image_urls: string[] | null;
  image_url: string | null;
  created_at: string;
  user_id: string;
  status: string | null;
  seller?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    headline: string | null;
    username: string | null;
  };
}

function Avatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  const init = (name ?? "U")[0].toUpperCase();
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: NAVY, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 700 }}>
      {init}
    </div>
  );
}

export default function MarketItemPage() {
  const [, params] = useRoute("/app/marketplace/:id");
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const itemId = params?.id;

  const [item, setItem]       = useState<MarketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgIdx, setImgIdx]   = useState(0);
  const [contacted, setContacted] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("*")
        .eq("id", itemId)
        .single();
      if (error || !data) { setLoading(false); return; }

      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, headline, username")
        .eq("user_id", data.user_id)
        .maybeSingle();

      setItem({ ...data, seller: sellerProfile ?? undefined });
      setLoading(false);
    })();
  }, [itemId]);

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: MUTED }}>Carregando...</div>
      </AppShell>
    );
  }

  if (!item) {
    return (
      <AppShell>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>📭</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Item não encontrado</div>
          <button onClick={() => setLocation("/app/oportunidades")} style={{ padding: "10px 24px", backgroundColor: GOLD, color: NAVY, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            Ver oportunidades
          </button>
        </div>
      </AppShell>
    );
  }

  const images = item.image_urls?.length ? item.image_urls : item.image_url ? [item.image_url] : [];
  const isOwner = profile?.id === item.seller?.id;

  const formatPrice = (price: number | null, currency: string | null) => {
    if (!price) return "Sob consulta";
    const c = currency ?? "BRL";
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(price);
    } catch {
      return `${c} ${price.toFixed(2)}`;
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 0 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => history.back()}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: NAVY, padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: NAVY, margin: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </h1>
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ position: "relative" }}>
              <img
                src={images[imgIdx]}
                alt={item.title}
                style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }}
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setImgIdx(i => Math.max(0, i - 1))}
                    disabled={imgIdx === 0}
                    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setImgIdx(i => Math.min(images.length - 1, i + 1))}
                    disabled={imgIdx === images.length - 1}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ›
                  </button>
                  <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                    {images.map((_, i) => (
                      <div
                        key={i}
                        onClick={() => setImgIdx(i)}
                        style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === imgIdx ? WHITE : "rgba(255,255,255,0.5)", cursor: "pointer" }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Thumbnails */}
            {images.length > 1 && (
              <div style={{ display: "flex", gap: 8, padding: 12, overflowX: "auto" }}>
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    onClick={() => setImgIdx(i)}
                    style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: i === imgIdx ? `2px solid ${GOLD}` : `2px solid transparent`, flexShrink: 0 }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main info */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: "0 0 6px" }}>{item.title}</h2>
              <div style={{ fontSize: 22, fontWeight: 900, color: GOLD }}>{formatPrice(item.price, item.currency)}</div>
            </div>
            {item.status && item.status !== "ativo" && (
              <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, backgroundColor: "#fee2e2", color: "#dc2626" }}>
                {item.status === "vendido" ? "Vendido" : item.status}
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {item.category && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, backgroundColor: `${GOLD}15`, color: NAVY }}>
                {item.category}
              </span>
            )}
            {item.condition && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, backgroundColor: BG, color: MUTED }}>
                {item.condition}
              </span>
            )}
            {item.location && (
              <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20, backgroundColor: BG, color: MUTED }}>
                📍 {item.location}
              </span>
            )}
          </div>

          {item.description && (
            <div style={{ fontSize: 14, color: NAVY, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{item.description}</div>
          )}

          <div style={{ fontSize: 12, color: MUTED, marginTop: 12 }}>{formatRelativeDate(item.created_at)}</div>
        </div>

        {/* Seller */}
        {item.seller && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Vendedor</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span onClick={() => setLocation(`/app/usuario/${item.seller!.id}`)} style={{ cursor: "pointer", display: "inline-flex" }}>
                <Avatar src={item.seller.avatar_url} name={item.seller.full_name ?? "U"} size={48} />
              </span>
              <div style={{ flex: 1 }}>
                <div onClick={() => setLocation(`/app/usuario/${item.seller!.id}`)} style={{ fontSize: 15, fontWeight: 700, color: NAVY, cursor: "pointer", display: "inline-block" }}>{item.seller.full_name ?? "Usuário"}</div>
                {item.seller.headline && <div style={{ fontSize: 12, color: MUTED }}>{item.seller.headline}</div>}
              </div>
              {!isOwner && (
                <button
                  onClick={() => setLocation(`/app/usuario/${item.seller!.id}`)}
                  style={{ padding: "8px 16px", backgroundColor: BG, color: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  Ver perfil
                </button>
              )}
            </div>
          </div>
        )}

        {/* CTA */}
        {!isOwner && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16 }}>
            <button
              onClick={() => {
                if (item.seller?.username) {
                  setContacted(true);
                  setLocation(`/app/mensagens?user=${item.seller.id}`);
                } else {
                  setContacted(true);
                }
              }}
              disabled={contacted}
              style={{ width: "100%", padding: "14px 0", backgroundColor: contacted ? BG : GOLD, color: contacted ? MUTED : NAVY, border: "none", borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: contacted ? "default" : "pointer" }}
            >
              {contacted ? "✓ Mensagem enviada" : "💬 Entrar em contato"}
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
