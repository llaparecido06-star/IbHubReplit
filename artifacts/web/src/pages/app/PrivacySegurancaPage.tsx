import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { deleteOwnAccount, updateProfileFields } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 46, height: 26, borderRadius: 13, border: "none",
        backgroundColor: checked ? NAVY : "#d1d5db",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
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

export default function PrivacySegurancaPage() {
  const [, setLocation] = useLocation();
  const { profile, refreshProfile, signOut } = useAuth();

  const [publicProfile,   setPublicProfile]   = useState(true);
  const [allowMessages,   setAllowMessages]   = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [savingVisibility,   setSavingVisibility]   = useState(false);
  const [savingMessages,     setSavingMessages]     = useState(false);
  const [savingConnections,  setSavingConnections]  = useState(false);
  const [toggleError,        setToggleError]        = useState<string | null>(null);

  const [pwOpen, setPwOpen]                 = useState(false);
  const [newPassword, setNewPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw]             = useState(false);
  const [pwError, setPwError]               = useState<string | null>(null);
  const [pwSuccess, setPwSuccess]           = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setPublicProfile((profile as any).is_public !== false);
      setAllowMessages((profile as any).allow_messages !== false);
      setShowConnections((profile as any).show_connections !== false);
    }
  }, [profile?.id]);

  const saveToggle = async (
    field: "is_public" | "allow_messages" | "show_connections",
    value: boolean,
    optimistic: (v: boolean) => void,
    setSaving: (b: boolean) => void,
    prevValue: boolean,
  ) => {
    if (!profile?.id) return;
    optimistic(value);
    setSaving(true);
    setToggleError(null);
    try {
      const ok = await updateProfileFields(profile.id, { [field]: value });
      if (!ok) {
        optimistic(prevValue);
        setToggleError("Não foi possível salvar a configuração. Tente novamente.");
      } else {
        await refreshProfile();
      }
    } catch {
      optimistic(prevValue);
      setToggleError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError(null);
    setPwSuccess(false);
    if (!newPassword || !confirmPassword) { setPwError("Preencha os dois campos."); return; }
    if (newPassword.length < 6)            { setPwError("A senha deve ter pelo menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword)   { setPwError("As senhas não coincidem."); return; }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPw(false);
    if (error) {
      setPwError(error.message ?? "Não foi possível alterar a senha.");
    } else {
      setPwSuccess(true);
      setNewPassword(""); setConfirmPassword("");
      setTimeout(() => { setPwOpen(false); setPwSuccess(false); }, 1400);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    if (!confirm("Esta ação é PERMANENTE. Todos os seus dados (perfil, posts, mensagens, adega) serão removidos definitivamente. Deseja continuar?")) return;
    if (!confirm("Confirmação final: você tem certeza? Após a exclusão, sua conta não poderá ser recuperada.")) return;
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { setDeleteError("Sessão inválida. Faça login novamente."); setDeleting(false); return; }
      const result = await deleteOwnAccount(token);
      if (!result.success) {
        setDeleteError(result.error ?? "Não foi possível excluir a conta.");
        setDeleting(false);
        return;
      }
      if (result.warnings && result.warnings.length > 0) {
        console.warn("[deleteAccount] partial cleanup warnings:", result.warnings);
      }
      await signOut();
      setLocation("/");
    } catch (e: any) {
      setDeleteError(e?.message ?? "Erro inesperado.");
      setDeleting(false);
    }
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
          <h1 style={{ fontSize: 20, fontWeight: 800, color: NAVY, margin: 0 }}>Privacidade e Segurança</h1>
        </div>

        {toggleError && (
          <div role="alert" style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
            {toggleError}
          </div>
        )}

        {/* Visibilidade */}
        <Section title="👁️ Visibilidade do Perfil">
          <ToggleRow
            label="Perfil Público"
            sub="Qualquer pessoa pode ver seu perfil e publicações"
            saving={savingVisibility}
            value={publicProfile}
            onChange={(v) => saveToggle("is_public", v, setPublicProfile, setSavingVisibility, publicProfile)}
          />
        </Section>

        {/* Controle Social */}
        <Section title="👥 Controle Social">
          <ToggleRow
            label="Permitir mensagens"
            sub="Não-conexões podem te enviar mensagens diretas"
            saving={savingMessages}
            value={allowMessages}
            onChange={(v) => saveToggle("allow_messages", v, setAllowMessages, setSavingMessages, allowMessages)}
          />
          <ToggleRow
            label="Mostrar conexões"
            sub="Sua rede de conexões é visível no seu perfil"
            saving={savingConnections}
            value={showConnections}
            onChange={(v) => saveToggle("show_connections", v, setShowConnections, setSavingConnections, showConnections)}
          />
          <NavRow label="Usuários Bloqueados" sub="Ver e gerenciar bloqueios" onClick={() => setLocation("/app/bloqueados")} />
          <NavRow label="Minhas Denúncias"    sub="Ver histórico de denúncias enviadas" onClick={() => setLocation("/app/configuracoes/denuncias")} />
          <div style={{ padding: 14, borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span aria-hidden style={{ color: MUTED, fontSize: 16 }}>🚩</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>Como denunciar</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                Use o menu "⋯" em qualquer post ou perfil para denunciar conteúdo inadequado.
              </div>
            </div>
          </div>
        </Section>

        {/* Segurança */}
        <Section title="🛡️ Segurança">
          {!pwOpen ? (
            <NavRow label="Alterar senha" onClick={() => setPwOpen(true)} />
          ) : (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Nova senha</div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                style={inputStyle}
              />
              {newPassword.length > 0 && (() => {
                const rules = [
                  { ok: newPassword.length >= 6 && newPassword.length <= 8, label: "6 a 8 caracteres" },
                  { ok: /[A-Z]/.test(newPassword), label: "1 letra maiúscula" },
                  { ok: /[a-z]/.test(newPassword), label: "1 letra minúscula" },
                  { ok: /[0-9]/.test(newPassword), label: "1 número" },
                  { ok: /[.!@]/.test(newPassword), label: "1 caractere especial (. ! @)" },
                ];
                return (
                  <div style={{ padding: "10px 12px", background: "#f4f5f7", borderRadius: 8, display: "flex", flexDirection: "column", gap: 5, marginTop: -4 }}>
                    {rules.map((r) => (
                      <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                        <span style={{ fontSize: 11, color: r.ok ? "#16a34a" : "#aab4c0" }}>{r.ok ? "✔" : "○"}</span>
                        <span style={{ color: r.ok ? "#16a34a" : "#7a8494", fontWeight: r.ok ? 600 : 400 }}>{r.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmar nova senha"
                autoComplete="new-password"
                style={inputStyle}
              />
              {pwError && <div style={{ fontSize: 13, color: "#dc2626" }}>{pwError}</div>}
              {pwSuccess && <div style={{ fontSize: 13, color: "#16a34a" }}>Senha alterada com sucesso!</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => { setPwOpen(false); setNewPassword(""); setConfirmPassword(""); setPwError(null); }}
                  disabled={savingPw}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1.5px solid ${BORDER}`, background: WHITE, color: NAVY, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={savingPw}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: NAVY, color: WHITE, fontWeight: 700, cursor: savingPw ? "default" : "pointer", opacity: savingPw ? 0.6 : 1 }}
                >
                  {savingPw ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* Zona de Perigo */}
        <div style={{
          backgroundColor: "#fff5f5", border: "1.5px solid #fecaca", borderRadius: 12, padding: 16,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden style={{ fontSize: 16 }}>🗑️</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626" }}>Zona de Perigo</div>
          </div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>
            Ao excluir sua conta, todos os seus dados (perfil, posts, mensagens, adega) serão permanentemente removidos. Esta ação não pode ser desfeita.
          </div>
          {deleteError && <div style={{ fontSize: 13, color: "#dc2626" }}>{deleteError}</div>}
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleting}
            style={{
              padding: "13px 0", borderRadius: 10, border: "1.5px solid #dc2626",
              background: WHITE, color: "#dc2626", fontWeight: 700, fontSize: 15,
              cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? "Excluindo…" : "Excluir minha conta"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: WHITE, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
      <div style={{ padding: 14, fontSize: 15, fontWeight: 700, color: NAVY }}>{title}</div>
      <div style={{ borderTop: `1px solid ${BORDER}` }}>{children}</div>
    </div>
  );
}

function ToggleRow({ label, sub, saving, value, onChange }: { label: string; sub?: string; saving?: boolean; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</div>}
        {saving && <div style={{ fontSize: 12, color: GOLD, marginTop: 2 }}>Salvando…</div>}
      </div>
      <Switch checked={value} onChange={() => onChange(!value)} disabled={saving} label={`Alternar: ${label}`} />
    </div>
  );
}

function NavRow({ label, sub, onClick }: { label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14,
        borderBottom: `1px solid ${BORDER}`, fontFamily: "inherit",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: NAVY }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</div>}
      </div>
      <span aria-hidden style={{ color: MUTED, fontSize: 18 }}>›</span>
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  border: `1px solid ${BORDER}`, borderRadius: 10,
  padding: "11px 14px", fontSize: 14, fontFamily: "inherit", outline: "none",
};
