import React from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const BG     = "#f5f5f0";

interface RowItem {
  icon: string;
  label: string;
  sub?: string;
  to: string;
  external?: boolean;
}

interface Section {
  title: string;
  rows: RowItem[];
}

function Row({ row, onNav }: { row: RowItem; onNav: (to: string, external?: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onNav(row.to, row.external)}
      style={{
        width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 12, padding: 14, fontFamily: "inherit",
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 10, backgroundColor: BG,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        fontSize: 16,
      }} aria-hidden>{row.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>{row.label}</div>
        {row.sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{row.sub}</div>}
      </div>
      <span aria-hidden style={{ color: MUTED, fontSize: 18 }}>›</span>
    </button>
  );
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { profile, signOut } = useAuth();

  const handleNav = (to: string, external?: boolean) => {
    if (external) {
      window.open(to, "_blank", "noopener,noreferrer");
    } else {
      setLocation(to);
    }
  };

  const handleSignOut = async () => {
    if (!confirm("Deseja realmente sair da sua conta?")) return;
    await signOut();
    setLocation("/");
  };

  const planMap: Record<string, string> = {
    exclusive:    "Plano Executivo",
    business:     "Plano Empresa",
    premium:      "Plano Profissional",
    profissional: "Plano Profissional",
    empresa:      "Plano Empresa",
    executivo:    "Plano Executivo",
    basico:       "Plano Básico",
    gratuito:     "Plano Gratuito",
    free:         "Plano Gratuito",
  };
  const planRaw = (profile?.plan ?? "").toLowerCase();
  const planLabel = planMap[planRaw] ?? (planRaw ? `Plano ${planRaw}` : "Plano Gratuito");
  const name = profile?.full_name ?? "Usuário";
  const initial = name.charAt(0).toUpperCase();

  const sections: Section[] = [
    {
      title: "CONTA",
      rows: [
        { icon: "✏️", label: "Editar Perfil",    sub: "Alterar informações pessoais",    to: "/minha-conta" },
        { icon: "📊", label: "Analytics",        sub: "Estatísticas do seu perfil",      to: "/app/analytics" },
        { icon: "🛡️", label: "Certificações",    sub: "Suas certificações",              to: "/app/certificacoes" },
      ],
    },
    {
      title: "CONTEÚDO",
      rows: [
        { icon: "🔖", label: "Publicações Salvas", sub: "Suas publicações favoritas",  to: "/app/salvos" },
        { icon: "📅", label: "Eventos",            sub: "Listagem geral de eventos",   to: "/app/eventos" },
      ],
    },
    {
      title: "PREFERÊNCIAS",
      rows: [
        { icon: "🔔", label: "Notificações",            sub: "Gerenciar notificações",        to: "/app/configuracoes/notificacoes" },
        { icon: "🔒", label: "Privacidade e Segurança", sub: "Visibilidade, senha e bloqueios", to: "/app/configuracoes/privacidade" },
        { icon: "🚫", label: "Usuários Bloqueados",     sub: "Gerenciar bloqueios",           to: "/app/bloqueados" },
      ],
    },
    {
      title: "ASSINATURA",
      rows: [
        { icon: "⭐", label: "Assinatura", sub: "Gerencie seu plano", to: "/assinar" },
      ],
    },
    {
      title: "SUPORTE & LEGAL",
      rows: [
        { icon: "📜", label: "Termos de Uso",          sub: "Termos e condições",     to: "/termos-de-uso" },
        { icon: "🔐", label: "Política de Privacidade", sub: "Como usamos seus dados", to: "/politica-de-privacidade" },
        { icon: "💬", label: "Fale Conosco",           sub: "Suporte e feedback",      to: "/app/configuracoes/contato" },
        { icon: "🐛", label: "Reportar Bug",           sub: "Nos ajude a melhorar",   to: "/app/configuracoes/reportar-bug" },
      ],
    },
  ];

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: "8px 0 4px" }}>Configurações</h1>

        {/* User card */}
        <div style={{
          backgroundColor: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: 24, objectFit: "cover" }} />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: 24, backgroundColor: NAVY,
              color: GOLD, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800, flexShrink: 0,
            }}>{initial}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{planLabel}</div>
          </div>
        </div>

        {sections.map((sec) => (
          <div key={sec.title}>
            <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: 0.8, padding: "0 2px 8px" }}>
              {sec.title}
            </div>
            <div style={{ backgroundColor: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              {sec.rows.map((row, i) => (
                <div key={row.label} style={{ borderBottom: i < sec.rows.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                  <Row row={row} onNav={handleNav} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {profile?.is_admin && (
          <div style={{ backgroundColor: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
            <Row
              row={{ icon: "🛡️", label: "Painel Administrativo", sub: "Gerenciar plataforma", to: "/admin" }}
              onNav={handleNav}
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: "16px 0", borderRadius: 12, border: "1.5px solid #dc2626",
            background: "none", cursor: "pointer", width: "100%",
          }}
        >
          <span aria-hidden>↩️</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#dc2626" }}>Sair da conta</span>
        </button>

        <div style={{ textAlign: "center", fontSize: 12, color: MUTED, paddingBottom: 16 }}>
          ibhub v1.0 · © 2026
        </div>
      </div>
    </AppShell>
  );
}
