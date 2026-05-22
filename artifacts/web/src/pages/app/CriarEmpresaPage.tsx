import React, { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallPage } from "@/components/PaywallPage";
import { AppShell } from "@/components/layout/AppShell";
import { createCompanyPage, uploadCompanyLogoWeb } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";

const INDUSTRIES = [
  "Vinícola / Adega",
  "Distribuição de Vinhos",
  "Importação / Exportação",
  "Enologia / Consultoria",
  "Restaurante / Bar",
  "Enoturismo",
  "Educação Enológica",
  "Tecnologia para Vinícolas",
  "Comunicação / Marketing",
  "Outro",
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: `1.5px solid ${BORDER}`,
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
  color: NAVY,
  backgroundColor: WHITE,
};

function AvatarPreview({ src, name, size = 80 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, borderRadius: 12, objectFit: "cover", border: `3px solid ${WHITE}` }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      backgroundColor: GOLD + "22", border: `2px dashed ${GOLD}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: 900, color: GOLD,
    }}>
      {(name?.[0] ?? "E").toUpperCase()}
    </div>
  );
}

export default function CriarEmpresaPage() {
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const { hasFeature, isLoading: permLoading } = usePermissions();

  const [form, setForm] = useState({
    name: "",
    username: "",
    industry: "",
    location: "",
    bio: "",
    website: "",
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (permLoading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #c9a84c", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        </div>
      </AppShell>
    );
  }

  if (!hasFeature("Criar Página Empresa")) {
    return (
      <AppShell>
        <PaywallPage
          featureName="Criar Página Empresarial"
          description="Publique uma página profissional para sua empresa no ibhub, gerencie vagas, produtos e sua equipe."
          requiredPlan="Empresarial"
        />
      </AppShell>
    );
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!profile?.id) return;
    if (!form.name.trim()) { setError("Nome da empresa é obrigatório."); return; }
    setError("");
    setSaving(true);

    const page = await createCompanyPage(profile.id, {
      name:     form.name.trim(),
      username: form.username.trim() || undefined,
      industry: form.industry || undefined,
      location: form.location.trim() || undefined,
      bio:      form.bio.trim() || undefined,
      website:  form.website.trim() || undefined,
    });

    if (!page) {
      setError("Erro ao criar a página. Verifique se o username já está em uso ou tente novamente.");
      setSaving(false);
      return;
    }

    if (avatarFile) {
      await uploadCompanyLogoWeb(page.id, avatarFile);
    }

    setSaving(false);
    setLocation(`/app/empresa/${page.id}/editar`);
  };

  const Field = ({
    label,
    hint,
    required,
    children,
  }: {
    label: string;
    hint?: string;
    required?: boolean;
    children: React.ReactNode;
  }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
        {label}{required && <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>{hint}</p>}
    </div>
  );

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setLocation("/app/configuracoes")}
            style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontWeight: 700, fontSize: 14, flexShrink: 0 }}
          >
            ← Voltar
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, margin: 0 }}>🏢 Criar Página Empresarial</h1>
            <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 0" }}>
              Crie a presença da sua empresa no ibhub
            </p>
          </div>
        </div>

        {/* Form card */}
        <div style={{ backgroundColor: WHITE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 28, display: "flex", flexDirection: "column", gap: 22 }}>

          {/* Logo */}
          <Field label="Logo da empresa" hint="PNG, JPG ou WEBP. Pode ser adicionada depois.">
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <AvatarPreview src={avatarPreview} name={form.name || "E"} size={72} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: "9px 18px", borderRadius: 10,
                    border: `1.5px solid ${BORDER}`, backgroundColor: WHITE,
                    color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 13,
                    fontFamily: "inherit",
                  }}
                >
                  {avatarFile ? "✓ Imagem selecionada" : "Selecionar logo"}
                </button>
                {avatarFile && (
                  <button
                    type="button"
                    onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, fontSize: 12, textAlign: "left", padding: 0 }}
                  >
                    Remover
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </div>
          </Field>

          <div style={{ borderTop: `1px solid ${BORDER}` }} />

          {/* Name */}
          <Field label="Nome da empresa" required>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Vinícola Exemplo"
              style={inputStyle}
              maxLength={100}
            />
          </Field>

          {/* Username */}
          <Field
            label="Username da página"
            hint="Endereço único da sua página. Apenas letras minúsculas, números e traços."
          >
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 14, color: MUTED, pointerEvents: "none",
              }}>@</span>
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                placeholder="nome-da-empresa"
                style={{ ...inputStyle, paddingLeft: 28 }}
                maxLength={50}
              />
            </div>
          </Field>

          {/* Industry */}
          <Field label="Setor">
            <select
              value={form.industry}
              onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
              style={{ ...inputStyle, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%237a8494' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", backgroundSize: 12, paddingRight: 36, color: form.industry ? NAVY : MUTED }}
            >
              <option value="">Selecione o setor</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>

          {/* Location */}
          <Field label="Localização">
            <input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Ex: São Paulo, SP"
              style={inputStyle}
              maxLength={100}
            />
          </Field>

          {/* Bio */}
          <Field label="Descrição" hint="Apresente brevemente sua empresa.">
            <textarea
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Descreva sua empresa, missão e diferenciais…"
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
              maxLength={500}
            />
            <div style={{ fontSize: 11, color: MUTED, textAlign: "right", marginTop: -2 }}>{form.bio.length}/500</div>
          </Field>

          {/* Website */}
          <Field label="Website">
            <input
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://suaempresa.com.br"
              style={inputStyle}
              type="url"
              maxLength={200}
            />
          </Field>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            backgroundColor: "#fef2f2", border: "1px solid #fca5a5",
            borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#dc2626",
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Info banner */}
        <div style={{
          backgroundColor: GOLD + "10", border: `1px solid ${GOLD}30`,
          borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 3 }}>Você poderá completar mais tarde</div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
              Após criar a página, você será redirecionado para as configurações onde poderá adicionar logo, equipe, produtos e publicar vagas.
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => setLocation("/app/configuracoes")}
            style={{
              flex: 1, padding: "14px 0", borderRadius: 12, border: `1.5px solid ${BORDER}`,
              backgroundColor: WHITE, color: NAVY, fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={saving || !form.name.trim()}
            style={{
              flex: 2, padding: "14px 0", borderRadius: 12, border: "none",
              backgroundColor: saving || !form.name.trim() ? BG : NAVY,
              color: saving || !form.name.trim() ? MUTED : WHITE,
              fontSize: 15, fontWeight: 800, cursor: saving || !form.name.trim() ? "default" : "pointer",
              fontFamily: "inherit", transition: "background 0.15s",
            }}
          >
            {saving ? "Criando página…" : "🏢 Criar Página"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
