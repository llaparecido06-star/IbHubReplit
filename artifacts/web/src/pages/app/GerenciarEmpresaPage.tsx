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
  fetchWebCompanyMembers,
  addWebCompanyMember,
  updateWebCompanyMemberRole,
  removeWebCompanyMember,
  transferWebCompanyOwnership,
  searchWebProfiles,
  CompanyPageFull,
  WebCompanyMember,
  WebSearchProfile,
} from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";
const WHITE  = "#ffffff";
const RED    = "#dc3545";

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

const ROLE_OPTIONS = [
  { value: "editor",      label: "Editor",       desc: "Edita informações e publica conteúdo" },
  { value: "moderador",   label: "Moderador",     desc: "Publica conteúdo e modera comentários" },
  { value: "visualizador",label: "Visualizador",  desc: "Apenas visualiza o painel interno" },
];

const ROLE_LABELS: Record<string, string> = {
  owner:       "Proprietário",
  editor:      "Editor",
  moderador:   "Moderador",
  visualizador:"Visualizador",
};

const ROLE_COLORS: Record<string, string> = {
  owner:       "#722f37",
  editor:      "#1a56db",
  moderador:   "#8b5cf6",
  visualizador:"#7a8494",
};

function AvatarPreview({ src, name, size = 80 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: 12, objectFit: "cover", border: `3px solid ${WHITE}` }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: 12, backgroundColor: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 900, color: WHITE, border: `3px solid ${WHITE}` }}>
      {(name?.[0] ?? "E").toUpperCase()}
    </div>
  );
}

function MiniAvatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", backgroundColor: GOLD + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.42, fontWeight: 800, color: GOLD, flexShrink: 0 }}>
      {(name?.[0] ?? "?").toUpperCase()}
    </div>
  );
}

// ─── Membros Tab ──────────────────────────────────────────────────────────────

function MembrosTab({ companyId, ownerId, currentUserId }: { companyId: string; ownerId: string; currentUserId: string }) {
  const [members, setMembers] = useState<WebCompanyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<WebSearchProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("editor");

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [transferTarget, setTransferTarget] = useState<WebCompanyMember | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchWebCompanyMembers(companyId);
    setMembers(data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!query.trim()) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchWebProfiles(query, currentUserId, 8);
      setSearchResults(results);
      setSearching(false);
    }, 350);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [query, currentUserId]);

  const existingIds = new Set([ownerId, ...members.map(m => m.user_id)]);

  const handleAdd = async (profile: WebSearchProfile) => {
    if (existingIds.has(profile.id)) return;
    setAddingUserId(profile.id);
    const ok = await addWebCompanyMember(companyId, profile.id, newRole);
    setAddingUserId(null);
    if (ok) {
      setQuery("");
      setSearchResults([]);
      await load();
    } else {
      alert("Não foi possível adicionar o membro.");
    }
  };

  const handleRoleChange = async (member: WebCompanyMember, role: string) => {
    setUpdatingId(member.user_id);
    const ok = await updateWebCompanyMemberRole(companyId, member.user_id, role);
    setUpdatingId(null);
    if (ok) setMembers(prev => prev.map(m => m.user_id === member.user_id ? { ...m, role } : m));
    else alert("Não foi possível atualizar o papel.");
  };

  const handleRemove = async (member: WebCompanyMember) => {
    const name = member.profile?.full_name ?? "este membro";
    if (!confirm(`Remover ${name} da equipe?`)) return;
    setRemovingId(member.user_id);
    const ok = await removeWebCompanyMember(companyId, member.user_id);
    setRemovingId(null);
    if (ok) setMembers(prev => prev.filter(m => m.user_id !== member.user_id));
    else alert("Não foi possível remover o membro.");
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    const name = transferTarget.profile?.full_name ?? "este usuário";
    if (!confirm(`Transferir a propriedade da empresa para ${name}? Você perderá o papel de Proprietário e se tornará Editor.`)) return;
    setTransferring(true);
    setTransferError("");
    const res = await transferWebCompanyOwnership(companyId, transferTarget.user_id, currentUserId);
    setTransferring(false);
    if (res.ok) {
      alert("Propriedade transferida com sucesso. Recarregue a página.");
      window.location.reload();
    } else {
      setTransferError(res.error ?? "Erro ao transferir.");
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${BORDER}`,
    fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Add member */}
      <div style={{ backgroundColor: WHITE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: "0 0 14px" }}>➕ Adicionar membro</h3>

        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nome ou @usuário..."
              style={{ ...inputStyle, paddingRight: searching ? 36 : 14 }}
            />
            {searching && (
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, borderRadius: "50%", border: "2px solid #ccc", borderTopColor: GOLD, animation: "spin 0.7s linear infinite" }} />
            )}
          </div>

          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            style={{ ...inputStyle, width: "auto", minWidth: 140 }}
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Role description hint */}
        {(() => {
          const opt = ROLE_OPTIONS.find(r => r.value === newRole);
          return opt ? <p style={{ fontSize: 12, color: MUTED, margin: "0 0 12px" }}>💡 {opt.desc}</p> : null;
        })()}

        {/* Search results */}
        {searchResults.length > 0 && (
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
            {searchResults.map((p, i) => {
              const alreadyIn = existingIds.has(p.id);
              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    borderTop: i > 0 ? `1px solid ${BORDER}` : "none",
                    backgroundColor: alreadyIn ? "#f9f9f9" : WHITE,
                  }}
                >
                  <MiniAvatar src={p.avatar_url} name={p.full_name} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{p.full_name}</div>
                    {p.headline && <div style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.headline}</div>}
                  </div>
                  {alreadyIn ? (
                    <span style={{ fontSize: 12, color: MUTED, fontWeight: 600, flexShrink: 0 }}>Já é membro</span>
                  ) : (
                    <button
                      onClick={() => handleAdd(p)}
                      disabled={addingUserId === p.id}
                      style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 8, border: "none", backgroundColor: GOLD, color: WHITE, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                    >
                      {addingUserId === p.id ? "..." : `Adicionar como ${ROLE_LABELS[newRole]}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {query.trim() && !searching && searchResults.length === 0 && (
          <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>Nenhum usuário encontrado para "{query}".</p>
        )}
      </div>

      {/* Current members list */}
      <div style={{ backgroundColor: WHITE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: "0 0 14px" }}>
          👥 Equipe atual
          <span style={{ fontWeight: 500, color: MUTED, marginLeft: 8, fontSize: 13 }}>({members.length + 1} membro{members.length + 1 !== 1 ? "s" : ""})</span>
        </h3>

        {loading ? (
          <div style={{ textAlign: "center", padding: 24, color: MUTED }}>Carregando...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

            {/* Owner row (always first, not editable) */}
            <OwnerRow ownerId={ownerId} />

            {members.length === 0 && (
              <p style={{ fontSize: 13, color: MUTED, margin: "12px 0 0" }}>
                Nenhum outro membro ainda. Use a busca acima para adicionar alguém.
              </p>
            )}

            {members.map((m, i) => (
              <div
                key={m.user_id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  paddingTop: 12, marginTop: 12,
                  borderTop: `1px solid ${BORDER}`,
                  opacity: removingId === m.user_id ? 0.4 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                <MiniAvatar src={m.profile?.avatar_url} name={m.profile?.full_name ?? "?"} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
                    {m.profile?.full_name ?? "Usuário"}
                  </div>
                  {(m.profile?.position || m.profile?.company) && (
                    <div style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {[m.profile.position, m.profile.company].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>

                {/* Role selector */}
                <select
                  value={m.role}
                  disabled={updatingId === m.user_id}
                  onChange={e => handleRoleChange(m, e.target.value)}
                  style={{
                    padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${BORDER}`,
                    fontSize: 12, fontWeight: 700, color: ROLE_COLORS[m.role] ?? NAVY,
                    backgroundColor: WHITE, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>

                {/* Transfer ownership */}
                <button
                  onClick={() => setTransferTarget(m)}
                  title="Transferir propriedade para este membro"
                  style={{ padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${BORDER}`, background: WHITE, color: MUTED, fontSize: 12, cursor: "pointer", flexShrink: 0 }}
                >
                  👑
                </button>

                {/* Remove */}
                <button
                  onClick={() => handleRemove(m)}
                  disabled={removingId === m.user_id}
                  title="Remover membro"
                  style={{ padding: "5px 10px", borderRadius: 8, border: `1.5px solid #fcc`, backgroundColor: "#fff5f5", color: RED, fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                >
                  {removingId === m.user_id ? "..." : "✕"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role legend */}
      <div style={{ backgroundColor: WHITE, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: NAVY, margin: "0 0 10px" }}>📖 O que cada papel pode fazer</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["Papel", "Editar página", "Publicar", "Moderar", "Gerir membros"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { role: "owner",       edit: true,  publish: true,  mod: true,  admin: true  },
              { role: "editor",      edit: true,  publish: true,  mod: false, admin: false },
              { role: "moderador",   edit: false, publish: true,  mod: true,  admin: false },
              { role: "visualizador",edit: false, publish: false, mod: false, admin: false },
            ].map(row => (
              <tr key={row.role} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: "7px 8px" }}>
                  <span style={{ fontWeight: 700, color: ROLE_COLORS[row.role] ?? NAVY }}>
                    {ROLE_LABELS[row.role]}
                  </span>
                </td>
                {[row.edit, row.publish, row.mod, row.admin].map((v, i) => (
                  <td key={i} style={{ padding: "7px 8px", color: v ? "#2ecc71" : "#ccc", fontWeight: 700 }}>
                    {v ? "✓" : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transfer ownership modal */}
      {transferTarget && (
        <div
          onClick={() => { setTransferTarget(null); setTransferError(""); }}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: WHITE, borderRadius: 16, padding: 28, maxWidth: 420, width: "100%" }}
          >
            <h2 style={{ fontSize: 17, fontWeight: 800, color: NAVY, margin: "0 0 10px" }}>👑 Transferir Propriedade</h2>
            <p style={{ fontSize: 14, color: "#555", margin: "0 0 6px" }}>
              Você está prestes a transferir a propriedade para:
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", backgroundColor: "#f9f9f9", borderRadius: 10, marginBottom: 14 }}>
              <MiniAvatar src={transferTarget.profile?.avatar_url} name={transferTarget.profile?.full_name ?? "?"} size={40} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{transferTarget.profile?.full_name}</div>
                <div style={{ fontSize: 12, color: MUTED }}>Papel atual: {ROLE_LABELS[transferTarget.role] ?? transferTarget.role}</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: RED, fontWeight: 600, margin: "0 0 16px" }}>
              ⚠️ Você perderá o papel de Proprietário e se tornará Editor. Esta ação não pode ser desfeita por aqui.
            </p>
            {transferError && <p style={{ color: RED, fontSize: 13, margin: "0 0 12px" }}>{transferError}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setTransferTarget(null); setTransferError(""); }}
                style={{ padding: "10px 20px", borderRadius: 10, border: `1.5px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 14 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                style={{ padding: "10px 20px", borderRadius: 10, border: "none", backgroundColor: RED, color: WHITE, fontWeight: 700, cursor: transferring ? "default" : "pointer", fontSize: 14 }}
              >
                {transferring ? "Transferindo..." : "Confirmar transferência"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OwnerRow({ ownerId }: { ownerId: string }) {
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string | null; position: string | null; company: string | null } | null>(null);
  const { supabase: _supabase } = { supabase: null };

  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.from("profiles").select("full_name, avatar_url, position, company").eq("id", ownerId).maybeSingle()
        .then(({ data }) => { if (data) setProfile(data as any); });
    });
  }, [ownerId]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <MiniAvatar src={profile?.avatar_url} name={profile?.full_name ?? "P"} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{profile?.full_name ?? "Carregando..."}</div>
        {(profile?.position || profile?.company) && (
          <div style={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {[profile.position, profile.company].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
      <span style={{ padding: "4px 12px", borderRadius: 20, backgroundColor: ROLE_COLORS.owner + "18", color: ROLE_COLORS.owner, fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
        Proprietário
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GerenciarEmpresaPage() {
  const [, params] = useRoute("/app/empresa/:id/editar");
  const [, setLocation] = useLocation();
  const { profile, user } = useAuth();
  const companyId = params?.id;

  const [company, setCompany]   = useState<CompanyPageFull | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [isOwner, setIsOwner]   = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [tab, setTab]           = useState<"info" | "membros">("info");

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

  const canEdit = isOwner;

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
      const uploaded = await uploadCompanyLogoWeb(companyId, avatarFile, user?.id ?? "");
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
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <button onClick={() => setLocation(`/app/empresa/${companyId}`)} style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, fontWeight: 700, fontSize: 14 }}>
            ← Voltar
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 2 }}>✏️ Editar Página de Empresa</h1>
            {company && <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>{company.name}</p>}
          </div>
          {userRole && (
            <span style={{ fontSize: 12, fontWeight: 700, color: ROLE_COLORS[userRole] ?? GOLD, backgroundColor: (ROLE_COLORS[userRole] ?? GOLD) + "18", padding: "4px 10px", borderRadius: 100 }}>
              {ROLE_LABELS[userRole] ?? userRole}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `2px solid ${BORDER}` }}>
          {([
            { key: "info",    label: "📝 Informações" },
            { key: "membros", label: "👥 Membros e Funções" },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: "none", border: "none", padding: "10px 18px", cursor: "pointer",
                fontWeight: tab === t.key ? 800 : 500, fontSize: 14,
                color: tab === t.key ? GOLD : MUTED,
                borderBottom: tab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
                marginBottom: -2,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: MUTED }}>Carregando...</div>
        ) : !company ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <p style={{ color: MUTED }}>Empresa não encontrada.</p>
          </div>
        ) : tab === "membros" ? (
          <MembrosTab companyId={companyId!} ownerId={company.owner_id} currentUserId={user?.id ?? ""} />
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

              {/* Quick links */}
              <div style={{ paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: NAVY, margin: "0 0 10px" }}>Gerenciar conteúdo</h3>
                <p style={{ fontSize: 12, color: MUTED, margin: "0 0 12px" }}>
                  Portfólio, vagas e publicações são editados direto na página pública
                  (você verá os controles de adicionar/editar quando estiver logado como gestor).
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "portfolio", label: "Portfólio", icon: "🛒" },
                    { key: "vagas",     label: "Vagas",     icon: "💼" },
                    { key: "publicacoes", label: "Publicações", icon: "📝" },
                  ].map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setLocation(`/app/empresa/${companyId}?tab=${s.key}`)}
                      style={{ padding: "9px 14px", borderRadius: 10, border: `1.5px solid ${BORDER}`, backgroundColor: WHITE, color: NAVY, fontWeight: 700, cursor: "pointer", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}
                    >
                      <span aria-hidden>{s.icon}</span> {s.label} →
                    </button>
                  ))}
                </div>
              </div>

              {error && <p style={{ color: RED, fontSize: 13, fontWeight: 600, margin: 0 }}>{error}</p>}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AppShell>
  );
}
