import React, { useEffect, useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/lib/supabase";

const GOLD   = "#c9a84c";
const NAVY   = "#0d1b2a";
const WHITE  = "#ffffff";
const BG     = "#f5f5f0";
const BORDER = "#e8e8e3";
const MUTED  = "#7a8494";

interface Member {
  user_id: string;
  role: "owner" | "member" | "moderator";
  profile?: { id: string; full_name: string | null; avatar_url: string | null; headline: string | null };
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
  const [, params] = useRoute("/app/grupos/:id/configuracoes");
  const [, setLocation] = useLocation();
  const { profile } = useAuth();
  const groupId = params?.id;
  const userId = profile?.id;

  const [name, setName]       = useState("");
  const [desc, setDesc]       = useState("");
  const [access, setAccess]   = useState<"aberto" | "fechado" | "restrito">("aberto");
  const [category, setCategory] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      setLoading(true);
      const [{ data: grp }, { data: mems }] = await Promise.all([
        supabase.from("groups").select("*").eq("id", groupId).single(),
        supabase.from("group_members").select("user_id, role").eq("group_id", groupId),
      ]);
      if (!grp) { setLocation("/app/mensagens"); return; }

      setName(grp.name ?? "");
      setDesc(grp.description ?? "");
      setAccess(grp.access ?? "aberto");
      setCategory(grp.category ?? "");
      setAvatarUrl(grp.avatar_url ?? null);

      const myRole = (mems ?? []).find((m: any) => m.user_id === userId)?.role;
      if (myRole !== "owner") { setLocation(`/app/grupos/${groupId}`); return; }
      setIsOwner(true);

      const memberIds = (mems ?? []).map((m: any) => m.user_id);
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_id, full_name, avatar_url, headline")
          .in("user_id", memberIds);
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
        const enriched: Member[] = (mems ?? []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          profile: profileMap.get(m.user_id) ?? undefined,
        }));
        setMembers(enriched);
      }
      setLoading(false);
    })();
  }, [groupId, userId]);

  async function handleSave() {
    if (!groupId || saving) return;
    setSaving(true);
    await supabase.from("groups").update({ name, description: desc, access, category }).eq("id", groupId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleRemoveMember(targetUserId: string) {
    if (!groupId || removingId) return;
    if (!confirm("Remover este membro do grupo?")) return;
    setRemovingId(targetUserId);
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", targetUserId);
    setMembers(prev => prev.filter(m => m.user_id !== targetUserId));
    setRemovingId(null);
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
    if (!confirm("Tem certeza que deseja excluir este grupo? Esta ação é irreversível.")) return;
    await supabase.from("group_members").delete().eq("group_id", groupId);
    await supabase.from("groups").delete().eq("id", groupId);
    setLocation("/app/mensagens");
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: MUTED }}>Carregando...</div>
      </AppShell>
    );
  }

  if (!isOwner) return null;

  const CATEGORIES = ["Vinificação", "Exportação", "Enoturismo", "Varejo", "Negócios", "Educação", "Sommelier", "Outros"];

  return (
    <AppShell>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 0 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => setLocation("/app/mensagens")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: NAVY, padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: NAVY, margin: 0 }}>Configurações do Grupo</h1>
        </div>

        {/* Avatar */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Imagem do grupo</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar src={avatarUrl} name={name} size={64} />
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={avatarUploading}
                style={{ padding: "9px 18px", backgroundColor: `${GOLD}18`, color: NAVY, border: `1px solid ${GOLD}`, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                {avatarUploading ? "Enviando..." : "Alterar foto"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); e.target.value = ""; }} />
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 2 }}>Informações</div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Nome do grupo</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Descrição</label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Categoria</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", backgroundColor: WHITE }}
            >
              <option value="">Selecione...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: NAVY, display: "block", marginBottom: 6 }}>Tipo de acesso</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["aberto", "fechado", "restrito"] as const).map(a => (
                <button
                  key={a}
                  onClick={() => setAccess(a)}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, border: `1.5px solid ${access === a ? GOLD : BORDER}`,
                    backgroundColor: access === a ? `${GOLD}15` : WHITE,
                    color: access === a ? GOLD : MUTED,
                    fontWeight: access === a ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                    textTransform: "capitalize",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>
              {access === "aberto" ? "Qualquer membro pode entrar" : access === "fechado" ? "Precisa de aprovação do owner" : "Apenas convidados"}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: "12px 0", backgroundColor: GOLD, color: NAVY, border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saved ? "✓ Salvo!" : saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>

        {/* Members */}
        <div style={{ backgroundColor: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, marginBottom: 14 }}>Membros ({members.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.map(m => {
              const isMe = m.user_id === userId;
              return (
                <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar src={m.profile?.avatar_url} name={m.profile?.full_name ?? "?"} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: NAVY }}>{m.profile?.full_name ?? "Usuário"}</div>
                    {m.profile?.headline && <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.profile.headline}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, backgroundColor: m.role === "owner" ? `${GOLD}20` : BG, color: m.role === "owner" ? GOLD : MUTED }}>
                      {m.role === "owner" ? "Owner" : m.role === "moderator" ? "Mod" : "Membro"}
                    </span>
                    {!isMe && m.role !== "owner" && (
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        disabled={removingId === m.user_id}
                        style={{ padding: "4px 10px", backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ backgroundColor: WHITE, border: "1px solid #fecaca", borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Zona de perigo</div>
          <p style={{ fontSize: 13, color: MUTED, margin: "0 0 14px", lineHeight: 1.6 }}>Ao excluir o grupo, todos os membros e mensagens serão removidos permanentemente.</p>
          <button
            onClick={handleDeleteGroup}
            style={{ padding: "10px 20px", backgroundColor: "#dc2626", color: WHITE, border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Excluir grupo
          </button>
        </div>
      </div>
    </AppShell>
  );
}
