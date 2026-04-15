import React, { useCallback, useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallPage } from "@/components/PaywallPage";
import { AppShell } from "@/components/layout/AppShell";
import { fetchWebCompanyPageById, updateCompanyPage, CompanyPageFull } from "@/services/api";

const GOLD = "#c9a84c";
const NAVY = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED = "#7a8494";

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

export default function GerenciarEmpresaPage() {
  const [, params] = useRoute("/app/empresa/:id/editar");
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const companyId = params?.id;

  const [company, setCompany] = useState<CompanyPageFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    username: "",
    bio: "",
    website: "",
    industry: "",
    location: "",
  });

  const load = useCallback(async () => {
    if (!companyId) return;
    const c = await fetchWebCompanyPageById(companyId);
    setCompany(c);
    if (c) {
      setForm({
        name: c.name ?? "",
        username: c.username ?? "",
        bio: c.bio ?? "",
        website: c.website ?? "",
        industry: c.industry ?? "",
        location: c.location ?? "",
      });
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const { hasFeature, isLoading: permLoading } = usePermissions();

  if (!permLoading && !hasFeature("Criar Página Empresa")) {
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

  if (!loading && company && company.owner_id !== profile?.id) {
    return (
      <AppShell>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
          <p style={{ color: MUTED }}>Você não tem permissão para editar esta empresa.</p>
        </div>
      </AppShell>
    );
  }

  const handleSave = async () => {
    if (!companyId || !company) return;
    if (!form.name.trim()) { setError("Nome da empresa é obrigatório."); return; }
    setError("");
    setSaving(true);
    const ok = await updateCompanyPage(companyId, {
      name: form.name.trim(),
      username: form.username.trim() || undefined,
      bio: form.bio.trim() || undefined,
      website: form.website.trim() || undefined,
      industry: form.industry || undefined,
      location: form.location.trim() || undefined,
    });
    setSaving(false);
    if (ok) {
      setSaved(true);
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <button onClick={() => setLocation(`/app/empresa/${companyId}`)} style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontWeight: 700, fontSize: 14 }}>
            ← Voltar
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 2 }}>✏️ Editar Página de Empresa</h1>
            {company && <p style={{ color: MUTED, fontSize: 13 }}>{company.name}</p>}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando...</div>
        ) : !company ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <p style={{ color: MUTED }}>Empresa não encontrada.</p>
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 7 }}>
                  Bio / Descrição
                </label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="Descreva sua empresa, missão, produtos e diferenciais..."
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>

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

              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: NAVY, display: "block", marginBottom: 7 }}>Setor / Segmento</label>
                <select
                  value={form.industry}
                  onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                  style={{ ...inputStyle, backgroundColor: "#fff" }}
                >
                  <option value="">Selecione um setor...</option>
                  {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>

              {error && <p style={{ color: "#dc3545", fontSize: 13, fontWeight: 600 }}>{error}</p>}
              {saved && <p style={{ color: "#28a745", fontSize: 13, fontWeight: 700 }}>✅ Alterações salvas com sucesso!</p>}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                <button
                  onClick={() => setLocation(`/app/empresa/${companyId}`)}
                  style={{ padding: "11px 22px", borderRadius: 10, border: `1.5px solid ${BORDER}`, backgroundColor: "#fff", color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: "11px 28px", borderRadius: 10, border: "none", backgroundColor: saving ? BORDER : GOLD, color: saving ? MUTED : "#fff", fontWeight: 700, cursor: saving ? "default" : "pointer", fontSize: 14 }}
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
