import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { createPortalSession } from "@/services/stripe";
import { AppShell } from "@/components/layout/AppShell";
import { getEntitlementStatus } from "@/utils/entitlement";
import { supabase } from "@/lib/supabase";
import { usePlans, formatPlanPrice } from "@/hooks/usePlans";

const NAVY  = "#0d1b2a";
const GOLD  = "#c9a84c";
const WHITE = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";
const BG    = "#f5f5f0";

const PLAN_LABELS: Record<string, string> = {
  gratuito:     "Gratuito",
  profissional: "Profissional",
  empresas:     "Empresas",
  premium:      "Premium",
  basico:       "Básico",
  exclusive:    "Exclusive",
  business:     "Business",
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Ativo",               color: "#059669", bg: "#d1fae5" },
  trialing:  { label: "Período de teste",    color: "#2563eb", bg: "#dbeafe" },
  past_due:  { label: "Pagamento pendente",  color: "#d97706", bg: "#fef3c7" },
  canceled:  { label: "Cancelado",           color: "#dc2626", bg: "#fee2e2" },
  inactive:  { label: "Gratuito",            color: "#6b7280", bg: "#f3f4f6" },
};

type Section = "perfil" | "assinatura" | "seguranca" | "notificacoes" | "privacidade";

const SECTIONS: { key: Section; label: string; emoji: string }[] = [
  { key: "perfil",         label: "Perfil",          emoji: "👤" },
  { key: "assinatura",     label: "Assinatura",       emoji: "⭐" },
  { key: "notificacoes",   label: "Notificações",     emoji: "🔔" },
  { key: "privacidade",    label: "Privacidade",      emoji: "🔒" },
  { key: "seguranca",      label: "Segurança",        emoji: "🛡️" },
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: WHITE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: "24px", marginBottom: 20 }}>
      {children}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 20, marginTop: 0 }}>{title}</h2>;
}

function Toggle({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${BORDER}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
          backgroundColor: value ? GOLD : "#d1d5db",
          position: "relative", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: "50%", backgroundColor: WHITE,
          position: "absolute", top: 3, transition: "left 0.2s",
          left: value ? 23 : 3,
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}

export default function MinhaContaPage() {
  const { session, profile, signOut, patchProfile } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<Section>("perfil");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Subscription
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError]     = useState<string | null>(null);

  // Profile editing
  const [fullName,  setFullName]  = useState(profile?.full_name ?? "");
  const [bio,       setBio]       = useState((profile as any)?.bio ?? "");
  const [headline,  setHeadline]  = useState((profile as any)?.headline ?? "");
  const [position,  setPosition]  = useState((profile as any)?.position ?? "");
  const [company,   setCompany]   = useState((profile as any)?.company ?? "");
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName((profile as any).full_name ?? "");
      setBio((profile as any).bio ?? "");
      setHeadline((profile as any).headline ?? "");
      setPosition((profile as any).position ?? "");
      setCompany((profile as any).company ?? "");
    }
  }, [profile]);

  // Notifications
  const [notifFeed,    setNotifFeed]    = useState(true);
  const [notifMsgs,    setNotifMsgs]    = useState(true);
  const [notifOport,   setNotifOport]   = useState(true);
  const [notifEmail,   setNotifEmail]   = useState(false);

  // Privacy
  const [pubPerfil,    setPubPerfil]    = useState(true);
  const [showConex,    setShowConex]    = useState(true);
  const [allowMsg,     setAllowMsg]     = useState(true);

  const { paidPlans, getPlanLabel } = usePlans();
  const plan          = profile?.plan ?? "gratuito";
  const entitleStatus = getEntitlementStatus(profile);
  const stripeStatus  = profile?.stripe_subscription_status ?? null;
  const periodEnd     = profile?.stripe_current_period_end ?? null;
  const status        = stripeStatus ? STATUS_LABELS[stripeStatus] ?? STATUS_LABELS.inactive : STATUS_LABELS.inactive;
  const hasActiveSub  = entitleStatus === "active" || entitleStatus === "trialing" || entitleStatus === "courtesy";
  const isPastDue     = entitleStatus === "past_due";
  const currentPlanData = paidPlans.find(p => p.id === plan);

  async function handlePortal() {
    if (!session) return;
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { url } = await createPortalSession(session.access_token);
      window.location.href = url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao abrir portal de assinatura.";
      setPortalError(message);
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!profile?.id || avatarUploading) return;
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${profile.id}/${Date.now()}.${ext}`;
    setAvatarUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, bytes, { contentType: file.type, upsert: true });
      if (upErr) { console.error("avatar upload:", upErr); return; }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: publicUrl }).or(`id.eq.${profile.id},user_id.eq.${profile.id}`);
      patchProfile({ avatar_url: publicUrl });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSavePerfil() {
    if (!profile?.id) return;
    setSaving(true);
    const patch = { full_name: fullName, bio, headline, position, company };
    const { error } = await supabase.from("profiles").update(patch).or(`id.eq.${profile.id},user_id.eq.${profile.id}`);
    setSaving(false);
    if (!error) {
      patchProfile(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  function renderSection() {
    switch (activeSection) {

      case "perfil": return (
        <Card>
          <SectionTitle title="Informações de Perfil" />
          {/* Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", backgroundColor: "#722f37", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: WHITE, flexShrink: 0 }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (profile?.full_name ?? "U")[0].toUpperCase()
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                style={{ fontSize: 13, fontWeight: 700, color: GOLD, backgroundColor: `${GOLD}12`, border: `1px solid ${GOLD}40`, borderRadius: 8, padding: "7px 16px", cursor: avatarUploading ? "not-allowed" : "pointer", opacity: avatarUploading ? 0.6 : 1 }}
              >
                {avatarUploading ? "Enviando…" : "Alterar foto"}
              </button>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>JPG, PNG ou GIF • Max 5 MB</div>
            </div>
          </div>

          {[
            { label: "Nome completo *",  value: fullName,  setter: setFullName,  placeholder: "Seu nome" },
            { label: "Título / Headline", value: headline,  setter: setHeadline,  placeholder: "Ex: Sommelier WSET Level 3 | Consultor" },
            { label: "Cargo",             value: position,  setter: setPosition,  placeholder: "Ex: Diretor Comercial" },
            { label: "Empresa",           value: company,   setter: setCompany,   placeholder: "Ex: Vinícola Aurora" },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 5 }}>{label}</label>
              <input value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit" }} />
            </div>
          ))}

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 5 }}>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Conte um pouco sobre você e sua experiência no mundo do vinho..." rows={4} style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", resize: "none", fontFamily: "inherit" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={handleSavePerfil} disabled={saving} style={{ backgroundColor: GOLD, color: NAVY, fontWeight: 800, fontSize: 14, border: "none", borderRadius: 10, padding: "12px 28px", cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Salvando…" : saved ? "✓ Salvo!" : "Salvar alterações"}
            </button>
            {saved && <span style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>Perfil atualizado com sucesso</span>}
          </div>
        </Card>
      );

      case "assinatura": return (
        <div>
          {/* Current plan card */}
          <Card>
            <SectionTitle title="Meu plano" />

            {/* Plan info row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: NAVY }}>
                  {getPlanLabel(plan) || PLAN_LABELS[plan] || plan}
                </div>
                {currentPlanData && (
                  <div style={{ fontSize: 13, color: GOLD, fontWeight: 700, marginTop: 2 }}>
                    {formatPlanPrice(currentPlanData).main}
                    {formatPlanPrice(currentPlanData).period && (
                      <span style={{ fontWeight: 400, color: MUTED }}>{formatPlanPrice(currentPlanData).period}</span>
                    )}
                  </div>
                )}
                {periodEnd && (
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
                    {hasActiveSub ? "🔄 Renova em" : "⏹ Encerra em"}: <strong>{new Date(periodEnd).toLocaleDateString("pt-BR")}</strong>
                  </div>
                )}
              </div>
              <div style={{ backgroundColor: status.bg, color: status.color, fontWeight: 700, fontSize: 12, padding: "6px 16px", borderRadius: 100, whiteSpace: "nowrap" }}>
                {status.label}
              </div>
            </div>

            {/* Features of current plan */}
            {currentPlanData && currentPlanData.features.filter(f => !f.startsWith("mercado:")).length > 0 && (
              <div style={{ backgroundColor: BG, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Recursos do seu plano
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {currentPlanData.features.filter(f => !f.startsWith("mercado:")).map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: NAVY }}>
                      <span style={{ color: "#059669", fontSize: 14 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagamento pendente */}
            {isPastDue && (
              <div style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "#92400e", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span>⚠️</span>
                <span>Seu pagamento está pendente. Clique em <strong>Gerenciar assinatura</strong> para atualizar seu cartão e manter o acesso.</span>
              </div>
            )}

            {/* CTA buttons */}
            {(plan === "gratuito" || plan === "basico") && !hasActiveSub ? (
              <button onClick={() => setLocation("/assinar")} style={{ width: "100%", backgroundColor: GOLD, color: NAVY, border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                ⚡ Fazer upgrade de plano
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(hasActiveSub || isPastDue) && (
                  <button onClick={handlePortal} disabled={portalLoading} style={{ width: "100%", backgroundColor: NAVY, color: WHITE, border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: portalLoading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span>⚙️</span>
                    <span>{portalLoading ? "Abrindo portal…" : "Gerenciar assinatura"}</span>
                  </button>
                )}
                {!hasActiveSub && (
                  <button onClick={() => setLocation("/assinar")} style={{ width: "100%", backgroundColor: GOLD, color: NAVY, border: "none", borderRadius: 10, padding: "14px 0", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                    🔄 Reativar assinatura
                  </button>
                )}
                {hasActiveSub && (
                  <button onClick={() => setLocation("/assinar")} style={{ width: "100%", backgroundColor: "transparent", color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                    Ver outros planos
                  </button>
                )}
              </div>
            )}

            {portalError && (
              <p style={{ fontSize: 13, color: "#dc2626", marginTop: 12, textAlign: "center", backgroundColor: "#fef2f2", padding: "10px", borderRadius: 8 }}>
                ⚠️ {portalError}
              </p>
            )}
          </Card>

          {/* Portal Stripe explanation card */}
          {(hasActiveSub || isPastDue) && (
            <Card>
              <SectionTitle title="Portal de assinatura Stripe" />
              <p style={{ fontSize: 13, color: MUTED, margin: "0 0 16px", lineHeight: 1.6 }}>
                Ao clicar em <strong>Gerenciar assinatura</strong>, você é redirecionado para o portal seguro do Stripe, onde pode realizar as ações abaixo sem precisar entrar em contato com o suporte:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
                {[
                  { emoji: "💳", title: "Trocar cartão", desc: "Atualize o método de pagamento cadastrado" },
                  { emoji: "🧾", title: "Ver faturas", desc: "Acesse e baixe todas as suas faturas" },
                  { emoji: "📋", title: "Histórico", desc: "Veja o histórico completo de pagamentos" },
                  { emoji: "🔄", title: "Trocar de plano", desc: "Faça upgrade ou downgrade do seu plano" },
                  { emoji: "❌", title: "Cancelar", desc: "Cancele sua assinatura quando quiser" },
                ].map(item => (
                  <div key={item.title} style={{ backgroundColor: BG, borderRadius: 10, padding: "14px 12px" }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{item.emoji}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
              <button onClick={handlePortal} disabled={portalLoading} style={{ width: "100%", backgroundColor: NAVY, color: WHITE, border: "none", borderRadius: 10, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: portalLoading ? 0.7 : 1 }}>
                {portalLoading ? "Abrindo portal…" : "Abrir portal de assinatura →"}
              </button>
            </Card>
          )}
        </div>
      );

      case "notificacoes": return (
        <Card>
          <SectionTitle title="Notificações" />
          <Toggle label="Novas publicações no feed"   desc="Avisar quando conexões postarem"          value={notifFeed}   onChange={setNotifFeed} />
          <Toggle label="Mensagens diretas"           desc="Notificar quando receber mensagens"        value={notifMsgs}   onChange={setNotifMsgs} />
          <Toggle label="Novas oportunidades"         desc="Vagas e eventos do setor"                  value={notifOport}  onChange={setNotifOport} />
          <Toggle label="Notificações por e-mail"     desc="Receber resumo semanal por e-mail"          value={notifEmail}  onChange={setNotifEmail} />
          <p style={{ fontSize: 12, color: MUTED, marginTop: 0 }}>As preferências de notificação são salvas localmente. Integração com push notifications em breve.</p>
        </Card>
      );

      case "privacidade": return (
        <Card>
          <SectionTitle title="Privacidade" />
          <Toggle label="Perfil público"              desc="Qualquer pessoa pode ver seu perfil"         value={pubPerfil}  onChange={setPubPerfil} />
          <Toggle label="Mostrar conexões"            desc="Suas conexões ficam visíveis no perfil"      value={showConex}  onChange={setShowConex} />
          <Toggle label="Permitir mensagens"          desc="Qualquer membro pode te enviar mensagem"     value={allowMsg}   onChange={setAllowMsg} />
          <p style={{ fontSize: 12, color: MUTED, marginTop: 0 }}>As configurações de privacidade serão aplicadas em breve. Estamos implementando controles avançados.</p>
        </Card>
      );

      case "seguranca": return (
        <Card>
          <SectionTitle title="Segurança" />
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: NAVY, marginBottom: 4 }}>E-mail da conta</div>
            <div style={{ fontSize: 14, color: MUTED, backgroundColor: BG, padding: "10px 14px", borderRadius: 10 }}>
              {session?.user?.email ?? "—"}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 6 }}>Alterar senha</div>
            <p style={{ fontSize: 13, color: MUTED, margin: "0 0 12px" }}>Enviaremos um link de redefinição de senha para o seu e-mail.</p>
            <button
              onClick={async () => {
                if (!session?.user?.email) return;
                await supabase.auth.resetPasswordForEmail(session.user.email, { redirectTo: `${window.location.origin}/redefinir-senha` });
                alert("E-mail de redefinição enviado!");
              }}
              style={{ backgroundColor: NAVY, color: WHITE, fontWeight: 700, fontSize: 14, border: "none", borderRadius: 10, padding: "11px 24px", cursor: "pointer" }}
            >
              Enviar link de redefinição
            </button>
          </div>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>Encerrar sessão</div>
            <button
              onClick={async () => { await signOut(); setLocation("/"); }}
              style={{ width: "100%", backgroundColor: "transparent", color: "#dc2626", border: `1px solid #fee2e2`, borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Sair da conta
            </button>
          </div>
        </Card>
      );

      default: return null;
    }
  }

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "8px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: NAVY, marginBottom: 20 }}>Configurações</h1>

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              style={{
                padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: activeSection === s.key ? 700 : 500,
                border: `1px solid ${activeSection === s.key ? GOLD : BORDER}`,
                backgroundColor: activeSection === s.key ? `${GOLD}12` : WHITE,
                color: activeSection === s.key ? GOLD : MUTED,
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
              }}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        {renderSection()}
      </div>
    </AppShell>
  );
}
