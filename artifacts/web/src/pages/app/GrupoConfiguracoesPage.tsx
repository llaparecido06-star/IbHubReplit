import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";
import { approveGroupMemberWeb, rejectGroupMemberWeb, leaveGroup } from "@/services/api";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

const CATEGORIES = ["Vinificação", "Exportação", "Enoturismo", "Varejo", "Negócios", "Educação", "Sommelier", "Outros"];

type MyRole = "owner" | "moderator" | "member" | null;
type ConfigTab = "membros" | "pendentes" | "convidar" | "link";

interface Member {
  user_id: string;
  role: "owner" | "member" | "moderator" | "admin" | "pending";
  profile?: { id: string; full_name: string | null; avatar_url: string | null; headline: string | null };
}

interface SearchUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
}

function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  const init = (name ?? "U").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: NAVY, color: WHITE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, flexShrink: 0 }}>
      {init}
    </div>
  );
}

export default function GrupoConfiguracoesPage() {
  const [, params]      = useRoute("/app/grupos/:id/configuracoes");
  const [, setLocation] = useLocation();
  const { profile, user, activeCompany } = useAuth();
  const groupId = params?.id;
  // group_members.user_id stores profiles.id (PK), not the auth UUID —
  // must match the mobile pattern: profile?.id first.
  const userId  = profile?.id ?? user?.id ?? "";

  const [activeTab, setActiveTab] = useState<ConfigTab>("membros");
  const [name, setName]           = useState("");
  const [desc, setDesc]           = useState("");
  const [access, setAccess]       = useState<"aberto" | "fechado" | "restrito">("aberto");
  const [category, setCategory]   = useState("");
  const [members, setMembers]     = useState<Member[]>([]);
  const [pending, setPending]     = useState<Member[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [myRole, setMyRole]       = useState<MyRole>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [isMuted, setIsMuted]     = useState(false);
  const [mutingGroup, setMutingGroup] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [clearDone, setClearDone] = useState(false);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOwner = myRole === "owner";
  const isMod   = myRole === "owner" || myRole === "moderator";

  const loadGroup = useCallback(async () => {
    if (!groupId || !userId) return;
    setLoading(true);
    const [{ data: grp }, { data: mems }, { data: muteRow }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase.from("group_members").select("user_id, role").eq("group_id", groupId),
      supabase.from("group_mutes").select("id").eq("group_id", groupId).eq("user_id", userId).maybeSingle(),
    ]);
    if (!grp) { setLocation("/app/mensagens"); return; }

    setName(grp.name ?? "");
    setDesc(grp.description ?? "");
    setAccess(grp.access ?? "aberto");
    setCategory(grp.category ?? "");
    setAvatarUrl(grp.avatar_url ?? null);
    setInviteLink(`${window.location.origin}/app/grupos/${groupId}`);
    setIsMuted(!!muteRow);

    const rawMems = mems ?? [];
    const me = rawMems.find((m: any) => m.user_id === userId);
    const rawRole = me?.role as string | undefined;
    // Accept legacy "admin" role (production trigger) as equivalent to "moderator".
    // Also treat the actual group owner (grp.owner_id) as "owner" regardless of
    // what group_members.role says, in case of legacy/inconsistent data.
    const isActualOwner = (grp as any).owner_id === userId;
    const role: MyRole =
      isActualOwner       ? "owner"     :
      rawRole === "owner" || rawRole === "moderator" || rawRole === "member" ? rawRole :
      rawRole === "admin" ? "moderator" : null;
    if (!role) { setLocation(`/app/grupos/${groupId}`); return; }
    setMyRole(role);

    const activeMems  = rawMems.filter((m: any) => m.role !== "pending");
    const pendingMems = rawMems.filter((m: any) => m.role === "pending");
    const allIds = rawMems.map((m: any) => m.user_id);

    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, headline")
        .in("id", allIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      setMembers(activeMems.map((m: any) => ({ user_id: m.user_id, role: m.role, profile: profileMap.get(m.user_id) })));
      setPending(pendingMems.map((m: any) => ({ user_id: m.user_id, role: "pending" as const, profile: profileMap.get(m.user_id) })));
    }
    setLoading(false);
  }, [groupId, userId]);

  useEffect(() => { loadGroup(); }, [loadGroup]);

  async function handleSave() {
    if (!groupId || saving) return;
    setSaving(true);
    try {
      await supabase.from("groups").update({ name, description: desc, access, category }).eq("id", groupId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveMember(targetUserId: string) {
    if (!groupId || removingId) return;
    if (!confirm("Remover este membro do grupo?")) return;
    setRemovingId(targetUserId);
    await Promise.all([
      supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", targetUserId),
      supabase.from("conversation_participants").delete().eq("conversation_id", groupId).eq("user_id", targetUserId),
    ]);
    setMembers(prev => prev.filter(m => m.user_id !== targetUserId));
    setRemovingId(null);
  }

  async function handleChangeRole(targetUserId: string, newRole: "member" | "moderator") {
    if (!groupId || changingRoleId) return;
    setChangingRoleId(targetUserId);
    await supabase
      .from("group_members")
      .update({ role: newRole })
      .eq("group_id", groupId)
      .eq("user_id", targetUserId);
    setMembers(prev => prev.map(m => m.user_id === targetUserId ? { ...m, role: newRole } : m));
    setChangingRoleId(null);
  }

  async function handleApprove(targetUserId: string) {
    if (!groupId || approvingId) return;
    setApprovingId(targetUserId);
    const ok = await approveGroupMemberWeb(groupId, targetUserId);
    if (ok) {
      const approved = pending.find(m => m.user_id === targetUserId);
      setPending(prev => prev.filter(m => m.user_id !== targetUserId));
      if (approved) setMembers(prev => [...prev, { ...approved, role: "member" }]);
    }
    setApprovingId(null);
  }

  async function handleReject(targetUserId: string) {
    if (!groupId || approvingId) return;
    setApprovingId(targetUserId);
    const ok = await rejectGroupMemberWeb(groupId, targetUserId);
    if (ok) setPending(prev => prev.filter(m => m.user_id !== targetUserId));
    setApprovingId(null);
  }

  async function handleAvatarUpload(file: File) {
    if (!groupId || avatarUploading) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `groups/${groupId}/${Date.now()}.${ext}`;
    const buf = await file.arrayBuffer();
    const { error } = await supabase.storage.from("avatars").upload(path, new Uint8Array(buf), { contentType: file.type, upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("groups").update({ avatar_url: url }).eq("id", groupId);
      setAvatarUrl(url);
    }
    setAvatarUploading(false);
  }

  async function handleDeleteGroup() {
    if (!groupId) return;
    if (!confirm("Tem certeza que deseja excluir este grupo? Todos os membros e mensagens serão removidos permanentemente.")) return;
    // Delete conversations first — its CASCADE removes conversation_participants
    // and messages. group_members is handled by the CASCADE on groups.
    // Both operations are independent so we can run them in parallel.
    await Promise.all([
      supabase.from("conversations").delete().eq("id", groupId),
      supabase.from("groups").delete().eq("id", groupId),
    ]);
    setLocation("/app/mensagens");
  }

  async function handleLeaveGroup() {
    if (!groupId || !userId || leavingGroup) return;
    if (!confirm("Tem certeza que deseja sair deste grupo?")) return;
    setLeavingGroup(true);
    const ok = await leaveGroup(groupId, userId, activeCompany?.id ?? null);
    if (ok) {
      setLocation("/app/mensagens");
    } else {
      alert("Não foi possível sair do grupo. Tente novamente.");
      setLeavingGroup(false);
    }
  }

  async function handleToggleMute() {
    if (!groupId || !userId || mutingGroup) return;
    setMutingGroup(true);
    try {
      if (isMuted) {
        await supabase.from("group_mutes").delete().eq("group_id", groupId).eq("user_id", userId);
        setIsMuted(false);
      } else {
        await supabase.from("group_mutes").upsert({ group_id: groupId, user_id: userId }, { onConflict: "user_id,group_id" });
        setIsMuted(true);
      }
    } finally {
      setMutingGroup(false);
    }
  }

  async function handleClearConversation() {
    if (!groupId || !userId) return;
    if (!confirm("Limpar sua visualização desta conversa? As mensagens serão ocultadas para você (outros membros continuam vendo).")) return;
    const clearedAt = new Date().toISOString();
    await supabase
      .from("group_message_clears")
      .upsert(
        { user_id: userId, conversation_id: groupId, cleared_at: clearedAt },
        { onConflict: "user_id,conversation_id" },
      );
    setClearDone(true);
    setTimeout(() => setClearDone(false), 2500);
  }

  async function searchUsers(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, headline")
      .ilike("full_name", `%${q}%`)
      .limit(8);
    const memberIds = new Set([...members.map(m => m.user_id), ...pending.map(m => m.user_id)]);
    setSearchResults(((data ?? []) as any[]).filter((p: any) => !memberIds.has(p.id)));
  }

  async function handleInvite(person: SearchUser) {
    if (!groupId || invitingId) return;
    setInvitingId(person.id);
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: person.id, role: "member" });
    if (!error) {
      // Grant chat access so the invited user can see group messages immediately.
      // Without this, the user appears in the member list but the conversation
      // remains invisible to them (conversation_participants controls chat access).
      await supabase
        .from("conversation_participants")
        .upsert(
          { conversation_id: groupId, user_id: person.id },
          { onConflict: "conversation_id,user_id,company_page_id", ignoreDuplicates: true },
        );
      setMembers(prev => [...prev, { user_id: person.id, role: "member", profile: { id: person.id, full_name: person.full_name, avatar_url: person.avatar_url, headline: person.headline } }]);
      setSearchResults(prev => prev.filter(p => p.id !== person.id));
    }
    setInvitingId(null);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (loading) {
    return <AppShell><div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: MUTED }}>Carregando...</div></AppShell>;
  }
  if (!myRole) return null;

  // ── Flat read-only layout for regular members (no mod/admin powers) ──
  if (!isMod) {
    const accessLabel = access === "aberto" ? "Aberto" : access === "fechado" ? "Fechado" : "Restrito";
    const accessColor = access === "aberto" ? "#16a34a" : access === "fechado" ? "#d97706" : "#7c3aed";
    const accessBg    = access === "aberto" ? "#dcfce7" : access === "fechado" ? "#fef3c7" : "#ede9fe";

    return (
      <AppShell>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 0 80px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <button onClick={() => setLocation(`/app/grupos/${groupId}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: NAVY, padding: 0 }}>←</button>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: 0 }}>Configurações do Grupo</h1>
          </div>

          {/* Group info card (read-only) */}
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar src={avatarUrl} name={name} size={52} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>{name}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20, backgroundColor: accessBg, color: accessColor }}>
                    {accessLabel}
                  </span>
                  {category && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, backgroundColor: `${GOLD}18`, color: GOLD }}>
                      {category}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {desc && (
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
                {desc}
              </div>
            )}
          </div>

          {/* Members list */}
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Membros ({members.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {members.map(m => {
                const isMe = m.user_id === userId;
                const goToMember = () => setLocation(isMe ? "/app/perfil" : `/app/usuario/${m.user_id}`);
                return (
                  <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span onClick={goToMember} style={{ cursor: "pointer", display: "inline-flex" }}>
                      <Avatar src={m.profile?.avatar_url} name={m.profile?.full_name ?? "?"} size={40} />
                    </span>
                    <div onClick={goToMember} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{m.profile?.full_name ?? "Usuário"}</div>
                      {m.profile?.headline && <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.profile.headline}</div>}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                      backgroundColor: m.role === "owner" ? `${GOLD}20` : (m.role === "moderator" || m.role === "admin") ? "#e0f2fe" : BG,
                      color: m.role === "owner" ? GOLD : (m.role === "moderator" || m.role === "admin") ? "#0369a1" : MUTED,
                    }}>
                      {m.role === "owner" ? "Owner" : (m.role === "moderator" || m.role === "admin") ? "Mod" : "Membro"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ações */}
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Ações</div>
            <button
              onClick={handleToggleMute}
              disabled={mutingGroup}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", backgroundColor: isMuted ? "#f1f5f9" : BG, border: `1px solid ${BORDER}`, borderRadius: 12, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: 18 }}>{isMuted ? "🔕" : "🔔"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{isMuted ? "Notificações silenciadas" : "Silenciar notificações"}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{isMuted ? "Toque para reativar" : "Parar de receber notificações deste grupo"}</div>
              </div>
            </button>
            <button
              onClick={handleClearConversation}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", backgroundColor: BG, border: `1px solid ${BORDER}`, borderRadius: 12, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: 18 }}>{clearDone ? "✅" : "🗑️"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{clearDone ? "Conversa limpa!" : "Limpar conversa"}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Oculta as mensagens antigas para você</div>
              </div>
            </button>
          </div>

          {/* Leave group */}
          <div style={{ backgroundColor: WHITE, border: "1px solid #fecaca", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Sair do grupo</div>
            <p style={{ fontSize: 13, color: MUTED, margin: "0 0 14px", lineHeight: 1.6 }}>Você perderá o acesso às mensagens e precisará ser convidado novamente para entrar.</p>
            <button
              onClick={handleLeaveGroup}
              disabled={leavingGroup}
              style={{ padding: "10px 20px", backgroundColor: "#dc2626", color: WHITE, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: leavingGroup ? "not-allowed" : "pointer", opacity: leavingGroup ? 0.7 : 1 }}
            >
              {leavingGroup ? "Saindo..." : "Sair do grupo"}
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const TABS: { key: ConfigTab; label: string; badge?: number }[] = [
    { key: "membros",   label: "Membros",   badge: members.length },
    ...(isMod ? [{ key: "pendentes" as ConfigTab, label: "Pendentes", badge: pending.length }] : []),
    ...(isMod ? [{ key: "convidar" as ConfigTab, label: "Convidar" }] : []),
    { key: "link",      label: "Link" },
  ];

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 0 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button onClick={() => setLocation(`/app/grupos/${groupId}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: NAVY, padding: 0 }}>←</button>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: 0 }}>Configurações do Grupo</h1>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, backgroundColor: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1, padding: "12px 8px", border: "none", cursor: "pointer", fontWeight: activeTab === t.key ? 800 : 500,
                backgroundColor: activeTab === t.key ? `${GOLD}15` : "transparent",
                color: activeTab === t.key ? GOLD : MUTED,
                borderBottom: activeTab === t.key ? `2px solid ${GOLD}` : "2px solid transparent",
                fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span style={{ backgroundColor: t.key === "pendentes" ? "#dc2626" : GOLD, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 800 }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Membros tab ── */}
        {activeTab === "membros" && (
          <>
            {/* Avatar — only owners can change */}
            {isOwner && (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Imagem do grupo</div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <Avatar src={avatarUrl} name={name} size={64} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarUploading}
                    style={{ padding: "9px 18px", backgroundColor: `${GOLD}18`, color: NAVY, border: `1px solid ${GOLD}`, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    {avatarUploading ? "Enviando..." : "Alterar foto"}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }} />
                </div>
              </div>
            )}

            {/* Info — editable for owners */}
            {isOwner ? (
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>Informações</div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Nome do grupo</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Descrição</label>
                  <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                    style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Categoria</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none", backgroundColor: WHITE }}>
                    <option value="">Selecione...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Tipo de acesso</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["aberto", "fechado", "restrito"] as const).map(a => (
                      <button key={a} onClick={() => setAccess(a)} style={{
                        flex: 1, padding: "9px 0", borderRadius: 10, border: `1.5px solid ${access === a ? GOLD : BORDER}`,
                        backgroundColor: access === a ? `${GOLD}15` : WHITE, color: access === a ? GOLD : MUTED,
                        fontWeight: access === a ? 700 : 500, fontSize: 13, cursor: "pointer", textTransform: "capitalize",
                      }}>{a}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
                    {access === "aberto" ? "Qualquer membro pode entrar" : access === "fechado" ? "Precisa de aprovação do owner" : "Apenas convidados"}
                  </div>
                </div>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: "12px 0", backgroundColor: GOLD, color: NAVY, border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                  {saved ? "✓ Salvo!" : saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            ) : (
              /* Read-only group info for members */
              <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
                <Avatar src={avatarUrl} name={name} size={52} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{name}</div>
                  {desc && <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>{desc}</div>}
                </div>
              </div>
            )}

            {/* Members list */}
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Membros ({members.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {members.map(m => {
                  const isMe = m.user_id === userId;
                  const goToMember = () => setLocation(isMe ? "/app/perfil" : `/app/usuario/${m.user_id}`);
                  return (
                    <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span onClick={goToMember} style={{ cursor: "pointer", display: "inline-flex" }}>
                        <Avatar src={m.profile?.avatar_url} name={m.profile?.full_name ?? "?"} size={40} />
                      </span>
                      <div onClick={goToMember} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{m.profile?.full_name ?? "Usuário"}</div>
                        {m.profile?.headline && <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.profile.headline}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {/* Role badge */}
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                          backgroundColor: m.role === "owner" ? `${GOLD}20` : (m.role === "moderator" || m.role === "admin") ? "#e0f2fe" : BG,
                          color: m.role === "owner" ? GOLD : (m.role === "moderator" || m.role === "admin") ? "#0369a1" : MUTED,
                        }}>
                          {m.role === "owner" ? "Owner" : (m.role === "moderator" || m.role === "admin") ? "Mod" : "Membro"}
                        </span>
                        {/* Owner-only: promote / demote / remove */}
                        {isOwner && !isMe && m.role !== "owner" && (
                          <>
                            {(m.role === "member") && (
                              <button
                                onClick={() => handleChangeRole(m.user_id, "moderator")}
                                disabled={changingRoleId === m.user_id}
                                title="Tornar moderador"
                                style={{ padding: "4px 10px", backgroundColor: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >
                                + Mod
                              </button>
                            )}
                            {(m.role === "moderator" || m.role === "admin") && (
                              <button
                                onClick={() => handleChangeRole(m.user_id, "member")}
                                disabled={changingRoleId === m.user_id}
                                title="Rebaixar para membro"
                                style={{ padding: "4px 10px", backgroundColor: BG, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >
                                − Mod
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveMember(m.user_id)}
                              disabled={removingId === m.user_id}
                              style={{ padding: "4px 10px", backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                            >
                              Remover
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions for all members */}
            <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Ações</div>

              {/* Mute */}
              <button
                onClick={handleToggleMute}
                disabled={mutingGroup}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", backgroundColor: isMuted ? "#f1f5f9" : BG, border: `1px solid ${BORDER}`, borderRadius: 12, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontSize: 18 }}>{isMuted ? "🔕" : "🔔"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{isMuted ? "Notificações silenciadas" : "Silenciar notificações"}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{isMuted ? "Toque para reativar" : "Parar de receber notificações deste grupo"}</div>
                </div>
                {mutingGroup && <span style={{ fontSize: 12, color: MUTED }}>...</span>}
              </button>

              {/* Clear conversation */}
              <button
                onClick={handleClearConversation}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", backgroundColor: BG, border: `1px solid ${BORDER}`, borderRadius: 12, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontSize: 18 }}>{clearDone ? "✅" : "🗑️"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{clearDone ? "Conversa limpa!" : "Limpar conversa"}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Oculta as mensagens antigas para você</div>
                </div>
              </button>
            </div>

            {/* Leave group — non-owners only */}
            {!isOwner && (
              <div style={{ backgroundColor: WHITE, border: "1px solid #fecaca", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Sair do grupo</div>
                <p style={{ fontSize: 13, color: MUTED, margin: "0 0 14px", lineHeight: 1.6 }}>Você perderá o acesso às mensagens e precisará ser convidado novamente para entrar.</p>
                <button
                  onClick={handleLeaveGroup}
                  disabled={leavingGroup}
                  style={{ padding: "10px 20px", backgroundColor: "#dc2626", color: WHITE, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: leavingGroup ? "not-allowed" : "pointer", opacity: leavingGroup ? 0.7 : 1 }}
                >
                  {leavingGroup ? "Saindo..." : "Sair do grupo"}
                </button>
              </div>
            )}

            {/* Danger — owners only */}
            {isOwner && (
              <div style={{ backgroundColor: WHITE, border: "1px solid #fecaca", borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Zona de perigo</div>
                <p style={{ fontSize: 13, color: MUTED, margin: "0 0 14px", lineHeight: 1.6 }}>Ao excluir o grupo, todos os membros e mensagens serão removidos permanentemente.</p>
                <button onClick={handleDeleteGroup}
                  style={{ padding: "10px 20px", backgroundColor: "#dc2626", color: WHITE, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  Excluir grupo
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Pendentes tab (owner/mod only) ── */}
        {activeTab === "pendentes" && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>
              Solicitações Pendentes ({pending.length})
            </div>
            {pending.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: MUTED }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 600 }}>Nenhuma solicitação pendente</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {pending.map(m => (
                  <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${BORDER}` }}>
                    <span onClick={() => setLocation(`/app/usuario/${m.user_id}`)} style={{ cursor: "pointer", display: "inline-flex" }}>
                      <Avatar src={m.profile?.avatar_url} name={m.profile?.full_name ?? "?"} size={44} />
                    </span>
                    <div onClick={() => setLocation(`/app/usuario/${m.user_id}`)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{m.profile?.full_name ?? "Usuário"}</div>
                      {m.profile?.headline && <div style={{ fontSize: 12, color: MUTED }}>{m.profile.headline}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleApprove(m.user_id)}
                        disabled={approvingId === m.user_id}
                        style={{ padding: "7px 14px", backgroundColor: "#dcfce7", color: "#16a34a", border: "1px solid #86efac", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      >
                        Aceitar
                      </button>
                      <button
                        onClick={() => handleReject(m.user_id)}
                        disabled={approvingId === m.user_id}
                        style={{ padding: "7px 14px", backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Convidar tab (owner only) ── */}
        {activeTab === "convidar" && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Convidar Membros</div>
            <input
              value={inviteQuery}
              onChange={e => { setInviteQuery(e.target.value); searchUsers(e.target.value); }}
              placeholder="Buscar por nome..."
              style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            />
            {searchResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {searchResults.map(person => (
                  <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                    <span onClick={() => setLocation(`/app/usuario/${person.id}`)} style={{ cursor: "pointer", display: "inline-flex" }}>
                      <Avatar src={person.avatar_url} name={person.full_name ?? "?"} size={40} />
                    </span>
                    <div onClick={() => setLocation(`/app/usuario/${person.id}`)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{person.full_name ?? "Usuário"}</div>
                      {person.username && <div style={{ fontSize: 12, color: MUTED }}>@{person.username}</div>}
                    </div>
                    <button
                      onClick={() => handleInvite(person)}
                      disabled={invitingId === person.id}
                      style={{ padding: "7px 14px", backgroundColor: GOLD, color: WHITE, border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    >
                      {invitingId === person.id ? "Adicionando..." : "Adicionar"}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {inviteQuery && searchResults.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 0", color: MUTED, fontSize: 14 }}>
                Nenhum usuário encontrado ou já é membro
              </div>
            )}
          </div>
        )}

        {/* ── Link tab (all members) ── */}
        {activeTab === "link" && (
          <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Link de Convite</div>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>Compartilhe este link para convidar pessoas para o grupo.</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={inviteLink}
                readOnly
                style={{ flex: 1, padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 13, outline: "none", backgroundColor: BG, color: NAVY }}
              />
              <button
                onClick={handleCopyLink}
                style={{ padding: "10px 18px", backgroundColor: linkCopied ? "#16a34a" : GOLD, color: WHITE, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {linkCopied ? "✓ Copiado!" : "Copiar"}
              </button>
            </div>
            {/* WhatsApp share */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Entre no grupo "${name}" no ibhub: ${inviteLink}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, padding: "10px 0", backgroundColor: "#dcfce7", color: "#16a34a", border: "1px solid #86efac", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none" }}
            >
              <span>📲</span> Compartilhar via WhatsApp
            </a>
          </div>
        )}
      </div>
    </AppShell>
  );
}
