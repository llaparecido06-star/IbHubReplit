import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { uploadGroupAvatar, leaveGroup, approveGroupMember, rejectGroupMember } from "@/services/api";

type Tab = "membros" | "pendentes" | "convidar" | "link";

interface Member {
  id: string;
  name: string;
  avatar_url: string | null;
  role: "dono" | "admin" | "membro";
}

interface GroupData {
  name: string;
  avatar_url: string | null;
  owner_id: string;
  members: Member[];
  access: "aberto" | "fechado" | "restrito";
}

export default function GroupSettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const userId = profile?.id ?? user?.id ?? "";

  const TABS: { key: Tab; label: string }[] = [
    { key: "membros",   label: t("group_settings_screen.tab_members") },
    { key: "pendentes", label: t("group_settings_screen.tab_pending") },
    { key: "convidar",  label: t("group_settings_screen.tab_invite") },
    { key: "link",      label: t("group_settings_screen.tab_link") },
  ];

  const [activeTab, setActiveTab]       = useState<Tab>("membros");
  const [group, setGroup]               = useState<GroupData>({ name: "Grupo", avatar_url: null, owner_id: "", members: [], access: "aberto" });
  const [editAccess, setEditAccess]     = useState<"aberto" | "fechado" | "restrito">("aberto");
  const [savingAccess, setSavingAccess] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [updating, setUpdating]         = useState(false);
  const [pendingMembers, setPending]    = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
  const [approvingId, setApprovingId]   = useState<string | null>(null);
  const [isMuted, setIsMuted]           = useState(false);
  const [mutingGroup, setMutingGroup]   = useState(false);

  const [inviteQuery,   setInviteQuery]  = useState("");
  const [inviteResults, setInviteResults] = useState<{ id: string; full_name: string; avatar_url: string | null; headline: string | null }[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invitingId,    setInvitingId]   = useState<string | null>(null);
  const inviteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const isOwner = userId === group.owner_id;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [groupRes, membersRes, pendingRes, muteRes] = await Promise.all([
      supabase.from("groups").select("name, avatar_url, owner_id, access").eq("id", id).maybeSingle(),
      supabase.from("group_members").select("user_id, role").eq("group_id", id).neq("role", "pending"),
      supabase.from("group_members").select("user_id").eq("group_id", id).eq("role", "pending"),
      supabase.from("group_mutes").select("id").eq("group_id", id).eq("user_id", userId).maybeSingle(),
    ]);
    setIsMuted(!!muteRes.data);

    const groupData   = groupRes.data as any;
    const rawMembers  = (membersRes.data ?? []) as any[];
    const rawPending  = (pendingRes.data ?? []) as any[];

    if (!groupData) { setLoading(false); return; }

    const allIds = [...new Set([...rawMembers.map((m: any) => m.user_id), ...rawPending.map((m: any) => m.user_id)].filter(Boolean))];
    const { data: profiles } = allIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", allIds)
      : { data: [] };

    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

    const members: Member[] = rawMembers.map((m: any) => {
      const p = profileMap.get(m.user_id);
      const isGroupOwner = m.user_id === groupData.owner_id;
      return {
        id: m.user_id,
        name: p?.full_name ?? t("group_settings_screen.member_label"),
        avatar_url: p?.avatar_url ?? null,
        role: isGroupOwner ? "dono" : m.role === "admin" ? "admin" : "membro",
      };
    });

    members.sort((a, b) => {
      const rank = { dono: 0, admin: 1, membro: 2 };
      return rank[a.role] - rank[b.role];
    });

    const pending = rawPending.map((m: any) => {
      const p = profileMap.get(m.user_id);
      return { id: m.user_id, name: p?.full_name ?? t("group_settings_screen.user_label"), avatar_url: p?.avatar_url ?? null };
    });

    const currentAccess: "aberto" | "fechado" | "restrito" = groupData.access ?? "aberto";
    setGroup({ name: groupData.name, avatar_url: groupData.avatar_url, owner_id: groupData.owner_id, members, access: currentAccess });
    setEditAccess(currentAccess);
    setPending(pending);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleChangeAvatar = async () => {
    if (!isOwner) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("group_settings_screen.permission_title"), t("group_settings_screen.permission_gallery"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUpdating(true);
    const url = await uploadGroupAvatar(result.assets[0].uri, userId, id);
    if (url) {
      await supabase.from("groups").update({ avatar_url: url }).eq("id", id);
      setGroup(prev => ({ ...prev, avatar_url: url }));
    } else {
      Alert.alert(t("group_settings_screen.error_title"), t("group_settings_screen.error_update_avatar"));
    }
    setUpdating(false);
  };

  const handleRemoveMember = (member: Member) => {
    if (!isOwner || member.role === "dono") return;
    Alert.alert(
      t("group_settings_screen.remove_member_title"),
      t("group_settings_screen.remove_member_msg", { name: member.name }),
      [
        { text: t("group_settings_screen.cancel"), style: "cancel" },
        {
          text: t("group_settings_screen.remove_btn"), style: "destructive", onPress: async () => {
            const { error } = await supabase
              .from("group_members")
              .delete()
              .eq("group_id", id)
              .eq("user_id", member.id);
            if (!error) load();
            else Alert.alert(t("group_settings_screen.error_title"), t("group_settings_screen.error_remove_member"));
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      t("group_settings_screen.delete_group_title"),
      t("group_settings_screen.delete_group_msg"),
      [
        { text: t("group_settings_screen.cancel"), style: "cancel" },
        {
          text: t("group_settings_screen.delete_btn"), style: "destructive", onPress: async () => {
            const { error } = await supabase.from("groups").delete().eq("id", id);
            if (!error) {
              router.replace("/groups" as any);
            } else {
              Alert.alert(t("group_settings_screen.error_title"), t("group_settings_screen.error_delete_group"));
            }
          },
        },
      ]
    );
  };

  const handleApprove = (member: { id: string; name: string }) => {
    Alert.alert(
      t("group_settings_screen.approve_title"),
      t("group_settings_screen.approve_msg", { name: member.name }),
      [
        { text: t("group_settings_screen.cancel"), style: "cancel" },
        {
          text: t("group_settings_screen.approve_btn"), onPress: async () => {
            setApprovingId(member.id);
            const ok = await approveGroupMember(id, member.id);
            setApprovingId(null);
            if (ok) load();
            else Alert.alert(t("group_settings_screen.error_title"), t("group_settings_screen.error_approve"));
          },
        },
      ]
    );
  };

  const handleReject = (member: { id: string; name: string }) => {
    Alert.alert(
      t("group_settings_screen.reject_title"),
      t("group_settings_screen.reject_msg", { name: member.name }),
      [
        { text: t("group_settings_screen.cancel"), style: "cancel" },
        {
          text: t("group_settings_screen.reject_btn"), style: "destructive", onPress: async () => {
            setApprovingId(member.id);
            const ok = await rejectGroupMember(id, member.id);
            setApprovingId(null);
            if (ok) load();
            else Alert.alert(t("group_settings_screen.error_title"), t("group_settings_screen.error_reject"));
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert(
      t("group_settings_screen.leave_title"),
      t("group_settings_screen.leave_msg", { name: group.name }),
      [
        { text: t("group_settings_screen.cancel"), style: "cancel" },
        {
          text: t("group_settings_screen.leave_btn"), style: "destructive", onPress: async () => {
            const ok = await leaveGroup(id, userId);
            if (ok) router.replace("/groups" as any);
            else Alert.alert(t("group_settings_screen.error_title"), t("group_settings_screen.error_leave"));
          },
        },
      ]
    );
  };

  const handleSaveAccess = async () => {
    if (!isOwner || editAccess === group.access || savingAccess) return;
    setSavingAccess(true);
    const { error } = await supabase.from("groups").update({ access: editAccess }).eq("id", id);
    setSavingAccess(false);
    if (error) {
      Alert.alert(t("group_settings_screen.error_title"), "Não foi possível atualizar o tipo de acesso.");
    } else {
      setGroup(prev => ({ ...prev, access: editAccess }));
    }
  };

  const handleToggleMute = async () => {
    if (!id || !userId || mutingGroup) return;
    setMutingGroup(true);
    try {
      if (isMuted) {
        await supabase.from("group_mutes").delete().eq("group_id", id).eq("user_id", userId);
        setIsMuted(false);
      } else {
        await supabase.from("group_mutes").upsert({ group_id: id, user_id: userId }, { onConflict: "user_id,group_id" });
        setIsMuted(true);
      }
    } catch {
      Alert.alert(t("group_settings_screen.error_title"), t("group_settings_screen.error_mute"));
    } finally {
      setMutingGroup(false);
    }
  };

  const handleInviteSearch = (text: string) => {
    setInviteQuery(text);
    if (inviteTimer.current) clearTimeout(inviteTimer.current);
    if (!text.trim()) { setInviteResults([]); return; }
    setInviteLoading(true);
    inviteTimer.current = setTimeout(async () => {
      try {
        const memberIds = new Set(group.members.map(m => m.id));
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, headline")
          .ilike("full_name", `%${text.trim()}%`)
          .limit(20);
        const filtered = ((data ?? []) as any[]).filter(
          (p: any) => !memberIds.has(p.id) && p.id !== userId
        );
        setInviteResults(filtered.map((p: any) => ({
          id: p.id,
          full_name: p.full_name ?? t("group_settings_screen.user_label"),
          avatar_url: p.avatar_url ?? null,
          headline: p.headline ?? null,
        })));
      } finally {
        setInviteLoading(false);
      }
    }, 350);
  };

  const handleInvite = async (person: { id: string; full_name: string }) => {
    setInvitingId(person.id);
    try {
      const { error } = await supabase
        .from("group_members")
        .upsert({ group_id: id, user_id: person.id, role: "pending" }, { onConflict: "group_id,user_id" });
      if (error) throw error;
      Alert.alert(t("group_settings_screen.invite_sent_title"), t("group_settings_screen.invite_sent_msg", { name: person.full_name }));
      setInviteResults(prev => prev.filter(r => r.id !== person.id));
    } catch {
      Alert.alert(t("group_settings_screen.error_title"), t("group_settings_screen.error_invite"));
    } finally {
      setInvitingId(null);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "membros":
        return (
          <View style={{ gap: 10, padding: 16 }}>
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <TouchableOpacity onPress={handleChangeAvatar} disabled={!isOwner || updating} activeOpacity={isOwner ? 0.8 : 1}>
                {group.avatar_url ? (
                  <Image source={{ uri: group.avatar_url }} style={styles.groupAvatarLg} />
                ) : (
                  <Avatar name={group.name} size={72} />
                )}
                {isOwner && (
                  <View style={[styles.avatarEditBadge, { backgroundColor: colors.gold }]}>
                    {updating ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="camera" size={13} color="#fff" />}
                  </View>
                )}
              </TouchableOpacity>
              <Text style={[styles.groupNameText, { color: colors.navy }]}>{group.name}</Text>
              <Text style={[styles.memberCountText, { color: colors.mutedForeground }]}>
                {group.members.length} {group.members.length === 1 ? t("group_settings_screen.member_one") : t("group_settings_screen.member_many")}
              </Text>
            </View>

            {/* Access type section */}
            <View style={{ marginTop: 4, marginBottom: 4, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Feather name="shield" size={15} color={colors.navy} />
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.navy }}>Tipo de Acesso</Text>
              </View>
              {[
                { value: "aberto" as const, label: "Aberto", desc: "Aparece na busca · qualquer pessoa pode entrar", icon: "globe" as const },
                { value: "fechado" as const, label: "Fechado", desc: "Aparece na busca · entrada requer aprovação do admin", icon: "lock" as const },
                { value: "restrito" as const, label: "Restrito", desc: "Não aparece na busca · somente por convite do admin", icon: "shield" as const },
              ].map((opt) => {
                const isSelected = editAccess === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      padding: 10, borderRadius: 10, marginBottom: 6,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? colors.gold : colors.border,
                      backgroundColor: isSelected ? colors.gold + "10" : colors.background,
                      opacity: isOwner ? 1 : 0.6,
                    }}
                    onPress={() => isOwner && setEditAccess(opt.value)}
                    activeOpacity={isOwner ? 0.7 : 1}
                  >
                    <Feather name={opt.icon} size={16} color={isSelected ? colors.gold : colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: isSelected ? colors.navy : colors.foreground }}>{opt.label}</Text>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>{opt.desc}</Text>
                    </View>
                    {isSelected && <Feather name="check-circle" size={16} color={colors.gold} />}
                  </TouchableOpacity>
                );
              })}
              {isOwner && editAccess !== group.access && (
                <TouchableOpacity
                  style={{ marginTop: 4, backgroundColor: colors.gold, borderRadius: 10, paddingVertical: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
                  onPress={handleSaveAccess}
                  disabled={savingAccess}
                >
                  {savingAccess
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><Feather name="save" size={15} color="#fff" /><Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Salvar</Text></>
                  }
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <ActivityIndicator color={colors.gold} style={{ paddingTop: 20 }} />
            ) : (
              group.members.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.memberRow, { backgroundColor: "#fff", borderColor: colors.border }]}
                  onPress={() => router.push(`/profile/${member.id}` as any)}
                  onLongPress={() => handleRemoveMember(member)}
                  activeOpacity={0.7}
                >
                  <Avatar name={member.name} uri={member.avatar_url ?? undefined} size={42} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: colors.navy }]}>{member.name}</Text>
                    {member.role === "dono" && (
                      <View style={styles.roleRow}>
                        <Feather name="star" size={12} color={colors.gold} />
                        <Text style={[styles.roleText, { color: colors.gold }]}>{t("group_settings_screen.role_owner")}</Text>
                      </View>
                    )}
                    {member.role === "admin" && (
                      <Text style={[styles.roleText, { color: colors.mutedForeground }]}>{t("group_settings_screen.role_admin")}</Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))
            )}

            <View style={{ marginTop: 8, gap: 10 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: isMuted ? "#f1f5f9" : "#fff" }]}
                onPress={handleToggleMute}
                disabled={mutingGroup}
                activeOpacity={0.7}
              >
                {mutingGroup ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Feather name={isMuted ? "bell-off" : "bell"} size={16} color={isMuted ? colors.mutedForeground : colors.navy} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.actionBtnText, { color: isMuted ? colors.mutedForeground : colors.navy }]}>
                    {isMuted ? t("group_settings_screen.notifications_muted") : t("group_settings_screen.notifications_active")}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>
                    {isMuted ? t("group_settings_screen.tap_to_unmute") : t("group_settings_screen.tap_to_mute")}
                  </Text>
                </View>
              </TouchableOpacity>

              {!isOwner && (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: "#fca5a5", backgroundColor: "#fef2f2" }]}
                  onPress={handleLeave}
                >
                  <Feather name="log-out" size={16} color="#dc2626" />
                  <Text style={[styles.actionBtnText, { color: "#dc2626" }]}>{t("group_settings_screen.leave_group")}</Text>
                </TouchableOpacity>
              )}

              {isOwner && (
                <View style={[styles.dangerCard, { borderColor: "#fca5a5", backgroundColor: "#fef2f2" }]}>
                  <View style={styles.dangerHeader}>
                    <Feather name="alert-triangle" size={16} color="#dc2626" />
                    <Text style={[styles.dangerTitle, { color: "#dc2626" }]}>{t("group_settings_screen.danger_zone")}</Text>
                  </View>
                  <Text style={[styles.dangerDesc, { color: "#7f1d1d" }]}>
                    {t("group_settings_screen.danger_desc")}
                  </Text>
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Feather name="trash-2" size={16} color="#fff" />
                    <Text style={styles.deleteBtnText}>{t("group_settings_screen.delete_group_btn")}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );

      case "pendentes":
        if (loading) return <ActivityIndicator color={colors.gold} style={{ paddingTop: 40 }} />;
        if (pendingMembers.length === 0) {
          return (
            <View style={styles.emptyTab}>
              <Feather name="clock" size={36} color={colors.border} />
              <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
                {t("group_settings_screen.no_pending")}
              </Text>
            </View>
          );
        }
        return (
          <View style={{ gap: 10, padding: 16 }}>
            <Text style={[{ fontSize: 13, color: colors.mutedForeground, marginBottom: 4 }]}>
              {pendingMembers.length}{" "}
              {pendingMembers.length === 1 ? t("group_settings_screen.pending_one") : t("group_settings_screen.pending_many")}
            </Text>
            {pendingMembers.map((member) => (
              <View key={member.id} style={[styles.memberRow, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <TouchableOpacity
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
                  onPress={() => router.push(`/profile/${member.id}` as any)}
                  activeOpacity={0.7}
                >
                  <Avatar name={member.name} uri={member.avatar_url ?? undefined} size={42} />
                  <View>
                    <Text style={[styles.memberName, { color: colors.navy }]}>{member.name}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Feather name="clock" size={11} color="#d97706" />
                      <Text style={{ fontSize: 11, color: "#d97706" }}>{t("group_settings_screen.awaiting_approval")}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                {approvingId === member.id ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.approveBtn, { backgroundColor: "#dcfce7", borderColor: "#22c55e" }]}
                      onPress={() => handleApprove(member)}
                    >
                      <Feather name="check" size={15} color="#16a34a" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}
                      onPress={() => handleReject(member)}
                    >
                      <Feather name="x" size={15} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        );

      case "convidar":
        return (
          <View style={{ padding: 16, gap: 12 }}>
            <View style={[styles.searchBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.navy }]}
                placeholder={t("group_settings_screen.search_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                value={inviteQuery}
                onChangeText={handleInviteSearch}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {inviteLoading && <ActivityIndicator size="small" color={colors.gold} />}
            </View>

            {!inviteQuery.trim() ? (
              <View style={styles.emptyTab}>
                <Feather name="user-plus" size={36} color={colors.border} />
                <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
                  {t("group_settings_screen.search_hint")}
                </Text>
              </View>
            ) : inviteResults.length === 0 && !inviteLoading ? (
              <View style={styles.emptyTab}>
                <Feather name="users" size={36} color={colors.border} />
                <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
                  {t("group_settings_screen.no_results")}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {inviteResults.map(person => (
                  <View key={person.id} style={[styles.memberRow, { backgroundColor: "#fff", borderColor: colors.border }]}>
                    <Avatar name={person.full_name} uri={person.avatar_url ?? undefined} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: colors.navy }]}>{person.full_name}</Text>
                      {person.headline ? (
                        <Text style={[styles.roleText, { color: colors.mutedForeground }]} numberOfLines={1}>{person.headline}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[styles.inviteBtn, { backgroundColor: invitingId === person.id ? colors.border : colors.gold }]}
                      onPress={() => handleInvite(person)}
                      disabled={invitingId === person.id}
                    >
                      {invitingId === person.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.inviteBtnText}>{t("group_settings_screen.invite_btn")}</Text>}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      case "link": {
        const inviteLink = Linking.createURL(`group-chat/${id}`);
        const handleShare = async () => {
          try {
            await Share.share({
              message: t("group_settings_screen.share_group_msg", { name: group.name, link: inviteLink }),
              url: inviteLink,
            });
          } catch {
            Alert.alert(t("group_settings_screen.error_title"), t("group_settings_screen.error_share"));
          }
        };
        return (
          <View style={[styles.linkTab, { padding: 16 }]}>
            <Text style={[{ fontSize: 13, color: colors.mutedForeground, marginBottom: 8 }]}>
              {t("group_settings_screen.share_link_hint")}
            </Text>
            <View style={[styles.linkBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Feather name="link-2" size={18} color={colors.gold} />
              <Text style={[styles.linkText, { color: colors.navy }]} numberOfLines={1}>{inviteLink}</Text>
            </View>
            <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.gold }]} onPress={handleShare}>
              <Feather name="share-2" size={16} color="#fff" />
              <Text style={styles.copyBtnText}>{t("group_settings_screen.share_link_btn")}</Text>
            </TouchableOpacity>
          </View>
        );
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("group_settings_screen.header_title")}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{group.name}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const label = tab.key === "membros"
            ? `${t("group_settings_screen.tab_members")} (${group.members.length})`
            : tab.label;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, isActive && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabLabel, { color: isActive ? colors.gold : colors.mutedForeground }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {renderTab()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backRow:           { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle:       { fontSize: 20, fontWeight: "800" },
  headerSubtitle:    { fontSize: 13, marginTop: 2 },
  tabBar:            { flexDirection: "row", borderBottomWidth: 1 },
  tabItem:           { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabLabel:          { fontSize: 12, fontWeight: "600" },
  groupAvatarLg:     { width: 72, height: 72, borderRadius: 36 },
  avatarEditBadge:   { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  groupNameText:     { fontSize: 18, fontWeight: "800", marginTop: 10 },
  memberCountText:   { fontSize: 13, marginTop: 3 },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  memberName: { fontSize: 15, fontWeight: "700" },
  roleRow:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  roleText:   { fontSize: 12 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderWidth: 1, paddingVertical: 14, borderRadius: 10,
  },
  actionBtnText: { fontSize: 15, fontWeight: "700" },
  dangerCard:    { borderWidth: 1, borderRadius: 12, padding: 16, gap: 10, marginTop: 4 },
  dangerHeader:  { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerTitle:   { fontSize: 15, fontWeight: "700" },
  dangerDesc:    { fontSize: 13, lineHeight: 18 },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#dc2626", paddingVertical: 14, borderRadius: 10, marginTop: 4,
  },
  deleteBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptyTab:      { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTabText:  { fontSize: 14 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  searchInput:   { flex: 1, fontSize: 15, paddingVertical: 0 },
  inviteBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, alignItems: "center", justifyContent: "center",
    minWidth: 80,
  },
  inviteBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  approveBtn: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  linkTab:       { gap: 12 },
  linkBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 10, borderWidth: 1,
  },
  linkText:     { flex: 1, fontSize: 13 },
  copyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 10,
  },
  copyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
