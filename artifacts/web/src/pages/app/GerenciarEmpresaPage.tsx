import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallPage } from "@/components/PaywallPage";
import { AppShell } from "@/components/layout/AppShell";
import {
  fetchWebCompanyPageById,
  updateCompanyPage,
  uploadCompanyLogoWeb,
  checkUserCompanyRole,
  CompanyPageFull,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const WHITE  = "#ffffff";

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

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  editor: "Editor",
  moderador: "Moderador",
  visualizador: "Visualizador",
};

function AvatarPreview({ src, name, size = 80 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: 12, objectFit: "cover", border: `3px solid ${WHITE}` }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: 12, backgroundColor: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 900, color: WHITE, border: `3px solid ${WHITE}` }}>
      {(name?.[0] ?? "E").toUpperCase()}
    </div>
  );
}

export default function GerenciarEmpresaPage() {
  const [, params] = useRoute("/app/empresa/:id/editar");
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const companyId = params?.id;

  const [company, setCompany]   = useState<CompanyPageFull | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [isOwner, setIsOwner]   = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name:     "",
    username: "",
    bio:      "",
    website:  "",
    industry: "",
    location: "",
  });

  const load = useCallback(async () => {
    if (!companyId || !profile?.id) return;
    const [c, roleInfo] = await Promise.all([
      fetchWebCompanyPageById(companyId),
      checkUserCompanyRole(companyId, profile.id),
    ]);
    setCompany(c);
    setIsOwner(roleInfo.isOwner);
    setUserRole(roleInfo.isOwner ? "owner" : roleInfo.role);
    if (c) {
      setForm({
        name:     c.name ?? "",
        username: c.username ?? "",
        bio:      c.bio ?? "",
        website:  c.website ?? "",
        industry: c.industry ?? "",
        location: c.location ?? "",
      });
      setAvatarPreview(c.avatar_url ?? null);
    }
    setLoading(false);
  }, [companyId, profile?.id]);

  useEffect(() => { load(); }, [load]);

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

  if (!hasFeature("Criar Página Empresa")) {
    return (
      <AppShell>
        <PaywallPage
          featureName="Criar e Gerir Página de Empresa"
          description="Publique uma página profissional para sua empresa no ibhub e gerencie sua equipe."
          requiredPlan="Empresarial"
        />
      </AppShell>
    );
  }

  const canEdit = isOwner || userRole === "editor" || userRole === "moderador";

  if (!loading && company && !canEdit) {
    return (
      <AppShell>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>Acesso restrito</h2>
          <p style={{ color: MUTED }}>
            {userRole
              ? `Seu papel de "${ROLE_LABELS[userRole] ?? userRole}" não permite editar esta página.`
              : "Você não tem permissão para editar esta empresa."}
          </p>
          <button
            onClick={() => setLocation(`/app/empresa/${companyId}`)}
            style={{ marginTop: 20, padding: "10px 24px", backgroundColor: GOLD, color: WHITE, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Ver página da empresa
          </button>
        </div>
      </AppShell>
    );
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!companyId || !company) return;
    if (!form.name.trim()) { setError("Nome da empresa é obrigatório."); return; }
    setError("");
    setSaving(true);

    let avatar_url = company.avatar_url;
    if (avatarFile) {
      setUploadingLogo(true);
      const uploaded = await uploadCompanyLogoWeb(companyId, avatarFile);
      setUploadingLogo(false);
      if (uploaded) {
        avatar_url = uploaded;
        setAvatarPreview(uploaded);
        setAvatarFile(null);
      }
    }

    const ok = await updateCompanyPage(companyId, {
      name:      form.name.trim(),
      username:  form.username.trim() || undefined,
      bio:       form.bio.trim() || undefined,
      website:   form.website.trim() || undefined,
      industry:  form.industry || undefined,
      location:  form.location.trim() || undefined,
      avatar_url: avatar_url ?? undefined,
    });

    setSaving(false);
    if (ok) {
      setSaved(true);
      setCompany(prev => prev ? { ...prev, ...form, avatar_url: avatar_url ?? prev.avatar_url } : prev);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError("Erro ao salvar. Tente novamente.");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${BORDER}`,
    fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none",
  };

  return (
    <AppShell>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <button onClick={() => setLocation(`/app/empresa/${companyId}`)} style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontWeight: 700, fontSize: 14 }}>
            ← Voltar
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 2 }}>✏️ Editar Página de Empresa</h1>
            {company && <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>{company.name}</p>}
          </div>
          {userRole && (
            <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, backgroundColor: GOLD + "18", padding: "4px 10px", borderRadius: 100 }}>
              {ROLE_LABELS[userRole] ?? userRole}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando...</div>
        ) : !company ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <p style={{ color: MUTED }}>Empresa não encontrada.</p>
          </div>
        ) : (
          <div style={{ backgroundColor: WHITE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Logo / Avatar */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 10 }}>
                  Logo da empresa
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <AvatarPreview src={avatarPreview} name={form.name || company.name} size={80} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: "9px 18px", borderRadius: 10, border: `1.5px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                    >
                      {uploadingLogo ? "Enviando..." : "Trocar logo"}
                    </button>
                    <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>PNG, JPG ou WEBP. Será cortado em quadrado.</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleAvatarChange}
                  />
                </div>
                {avatarFile && (
                  <p style={{ fontSize: 12, color: GOLD, fontWeight: 600, marginTop: 6 }}>
                    ✓ Nova imagem selecionada — será enviada ao salvar.
                  </p>
                )}
              </div>

              {/* Name */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 7 }}>
                  Nome da empresa *
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nome da sua empresa"
                  style={inputStyle}
                />
              </div>

              {/* Username */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 7 }}>
                  Username da página
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: MUTED, fontSize: 14 }}>@</span>
                  <input
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") }))}
                    placeholder="usuario_empresa"
                    style={{ ...inputStyle, paddingLeft: 30 }}
                  />
                </div>
                <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Somente letras minúsculas, números, ponto e underscore.</p>
              </div>

              {/* Bio */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 7 }}>
                  Bio / Descrição
                </label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Descreva sua empresa, missão, produtos e diferenciais..."
                  rows={4}
                  maxLength={500}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
                <p style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{form.bio.length}/500</p>
              </div>

              {/* Website + Location */}
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 7 }}>Website</label>
                  <input
                    value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                    placeholder="https://suaempresa.com.br"
                    style={inputStyle}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 7 }}>Localização</label>
                  <input
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Ex: São Paulo, SP"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Industry */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 7 }}>Setor / Segmento</label>
                <select
                  value={form.industry}
                  onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                  style={{ ...inputStyle, backgroundColor: WHITE }}
                >
                  <option value="">Selecione um setor...</option>
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>

              {error && <p style={{ color: "#dc3545", fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}
              {saved && <p style={{ color: "#28a745", fontSize: 13, fontWeight: 700, margin: 0 }}>✅ Alterações salvas com sucesso!</p>}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                <button
                  onClick={() => setLocation(`/app/empresa/${companyId}`)}
                  style={{ padding: "11px 22px", borderRadius: 10, border: `1.5px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: "11px 28px", borderRadius: 10, border: "none", backgroundColor: saving ? BORDER : GOLD, color: saving ? MUTED : WHITE, fontWeight: 700, cursor: saving ? "default" : "pointer", fontSize: 14 }}
                >
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
