import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import {
  DEFAULT_PREFS,
  loadPrefs,
  savePrefs,
  type PrefKey,
} from "@/utils/notificationPrefs";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

interface NotifRow {
  icon: string;
  label: string;
  sub: string;
  stateKey: PrefKey;
}

const NOTIF_ROWS: NotifRow[] = [
  { icon: "👤", label: "Novos Seguidores",      sub: "Quando alguém começar a seguir você",    stateKey: "followers" },
  { icon: "💬", label: "Mensagens",             sub: "Novas mensagens diretas",                stateKey: "messages" },
  { icon: "💼", label: "Vagas e Oportunidades", sub: "Novas vagas na sua área",                stateKey: "jobs" },
  { icon: "❤️", label: "Curtidas",              sub: "Quando curtirem suas publicações",       stateKey: "likes" },
  { icon: "💭", label: "Comentários",           sub: "Novos comentários nas suas publicações", stateKey: "comments" },
  { icon: "@",  label: "Menções",               sub: "Quando alguém mencionar você",           stateKey: "mentions" },
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      style={{
        width: 46, height: 26, borderRadius: 13, border: "none",
        backgroundColor: checked ? NAVY : "#d1d5db",
        position: "relative", transition: "background 0.2s", flexShrink: 0, cursor: "pointer",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 20, height: 20, borderRadius: "50%", backgroundColor: WHITE,
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();
  const userId = profile?.id ?? user?.id ?? null;
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(DEFAULT_PREFS);

  useEffect(() => {
    setPrefs(loadPrefs(userId));
  }, [userId]);

  const toggle = (key: PrefKey) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      savePrefs(next, userId);
      return next;
    });
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 2px" }}>
          <button
            type="button"
            onClick={() => setLocation("/app/configuracoes")}
            aria-label="Voltar"
            style={{ background: "none", border: "none", cursor: "pointer", color: NAVY, fontSize: 22, padding: 4 }}
          >‹</button>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: 0 }}>Notificações</h1>
        </div>

        <div style={{ backgroundColor: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 16 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, backgroundColor: `${GOLD}18`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22,
            }} aria-hidden>📱</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Notificações Push</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>
                Notificações push estão disponíveis no aplicativo móvel.
                As preferências abaixo controlam quais alertas você recebe na plataforma.
              </div>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          {NOTIF_ROWS.map((row, i) => (
            <div
              key={row.stateKey}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: 14,
                borderBottom: i < NOTIF_ROWS.length - 1 ? `1px solid ${BORDER}` : "none",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, backgroundColor: `${GOLD}18`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16,
                color: GOLD, fontWeight: 800,
              }} aria-hidden>{row.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>{row.label}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{row.sub}</div>
              </div>
              <Switch
                checked={prefs[row.stateKey]}
                onChange={() => toggle(row.stateKey)}
                label={`Alternar notificação: ${row.label}`}
              />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
