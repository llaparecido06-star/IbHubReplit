import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallPage } from "@/components/PaywallPage";
import { AppShell } from "@/components/layout/AppShell";
import { fetchUserAnalytics, UserAnalytics } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BG = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color?: string }) {
  return (
    <div style={{
      backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`,
      padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 32 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color: color ?? NAVY }}>{value.toLocaleString("pt-BR")}</div>
        <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const [, setLocation] = useLocation();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchUserAnalytics(profile.id).then(setAnalytics).finally(() => setLoading(false));
  }, [profile?.id]);

  const { hasFeature, isLoading: permLoading } = usePermissions();

  if (permLoading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #c9a84c", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        </div>
      </AppShell>
    );
  }

  if (!hasFeature("Relatórios Detalhados")) {
    return (
      <AppShell>
        <PaywallPage
          featureName="Relatórios Detalhados"
          description="Acesse estatísticas completas do seu perfil e acompanhe o seu crescimento na rede."
          requiredPlan="Profissional"
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 4 }}>📊 Analytics Pessoal</h1>
            <p style={{ color: MUTED, fontSize: 14 }}>Acompanhe o desempenho das suas publicações e crescimento de rede.</p>
          </div>
          <button onClick={() => setLocation("/app/perfil")} style={{ fontSize: 13, color: GOLD, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
            Ver perfil →
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando analytics...</div>
        ) : !analytics ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <p style={{ color: MUTED }}>Não foi possível carregar os dados.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
              <StatCard label="Publicações" value={analytics.totalPosts} icon="📝" color={NAVY} />
              <StatCard label="Seguidores" value={analytics.followersCount} icon="👥" color={NAVY} />
              <StatCard label="Curtidas totais" value={analytics.totalLikes} icon="❤️" color="#e74c3c" />
              <StatCard label="Comentários totais" value={analytics.totalComments} icon="💬" color="#3498db" />
            </div>

            <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
              <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Taxa de engajamento</h3>
                <div style={{ fontSize: 36, fontWeight: 800, color: GOLD, marginBottom: 4 }}>
                  {analytics.totalPosts > 0
                    ? ((analytics.totalLikes + analytics.totalComments) / analytics.totalPosts).toFixed(1)
                    : "0.0"}
                </div>
                <div style={{ fontSize: 13, color: MUTED }}>média de interações por publicação</div>
              </div>
              <div style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Compartilhamentos</h3>
                <div style={{ fontSize: 36, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{analytics.totalShares}</div>
                <div style={{ fontSize: 13, color: MUTED }}>total de compartilhamentos</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: NAVY, marginBottom: 16 }}>🏆 Top Publicações</h3>
              {analytics.topPosts.length === 0 ? (
                <p style={{ color: MUTED, textAlign: "center", padding: "16px 0" }}>Nenhuma publicação ainda.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {analytics.topPosts.map((post, idx) => (
                    <div
                      key={post.id}
                      onClick={() => setLocation(`/app/posts/${post.id}`)}
                      style={{
                        display: "flex", alignItems: "center", gap: 14, padding: 14,
                        backgroundColor: BG, borderRadius: 10, cursor: "pointer",
                        border: `1px solid ${BORDER}`,
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: idx === 0 ? GOLD : BORDER, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: idx === 0 ? "#fff" : MUTED, flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {post.content.slice(0, 80)}{post.content.length > 80 ? "…" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 14, alignItems: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 12, color: "#e74c3c", fontWeight: 700 }}>❤️ {post.likes_count}</span>
                        <span style={{ fontSize: 12, color: "#3498db", fontWeight: 700 }}>💬 {post.comments_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 20, padding: 16, backgroundColor: "#fff8e7", borderRadius: 12, border: "1px solid #f0d080" }}>
              <p style={{ fontSize: 13, color: "#7a5c00", margin: 0 }}>
                <strong>💡 Dica:</strong> Publique conteúdo sobre vinhos, eventos e novidades do mercado para aumentar seu engajamento. Utilize hashtags relevantes e marque pessoas para expandir seu alcance.
              </p>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
