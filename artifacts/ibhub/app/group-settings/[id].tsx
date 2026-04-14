import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { uploadGroupAvatar, leaveGroup } from "@/services/api";

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
}

const TABS: { key: Tab; label: string }[] = [
  { key: "membros",   label: "Membros" },
  { key: "pendentes", label: "Pendentes" },
  { key: "convidar",  label: "Convidar" },
  { key: "link",      label: "Link" },
];

export default function GroupSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const userId = profile?.id ?? user?.id ?? "";

  const [activeTab, setActiveTab] = useState<Tab>("membros");
  const [group, setGroup]         = useState<GroupData>({ name: "Grupo", avatar_url: null, owner_id: "", members: [] });
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const isOwner = userId === group.owner_id;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [groupRes, membersRes] = await Promise.all([
      supabase.from("groups").select("name, avatar_url, owner_id").eq("id", id).maybeSingle(),
      supabase.from("group_members").select("user_id, role").eq("group_id", id),
    ]);

    const groupData = groupRes.data as any;
    const rawMembers = (membersRes.data ?? []) as any[];

    if (!groupData) { setLoading(false); return; }

    // Fetch profiles for all members
    const memberIds = rawMembers.map((m: any) => m.user_id).filter(Boolean);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", memberIds);

    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

    const members: Member[] = rawMembers.map((m: any) => {
      const p = profileMap.get(m.user_id);
      const isGroupOwner = m.user_id === groupData.owner_id;
      return {
        id: m.user_id,
        name: p?.full_name ?? "Membro",
        avatar_url: p?.avatar_url ?? null,
        role: isGroupOwner ? "dono" : m.role === "admin" ? "admin" : "membro",
      };
    });

    // Sort: owner first, then admins, then members
    members.sort((a, b) => {
      const rank = { dono: 0, admin: 1, membro: 2 };
      return rank[a.role] - rank[b.role];
    });

    setGroup({ name: groupData.name, avatar_url: groupData.avatar_url, owner_id: groupData.owner_id, members });
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleChangeAvatar = async () => {
    if (!isOwner) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita acesso à galeria de fotos.");
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
      Alert.alert("Erro", "Não foi possível atualizar a foto do grupo.");
    }
    setUpdating(false);
  };

  const handleRemoveMember = (member: Member) => {
    if (!isOwner || member.role === "dono") return;
    Alert.alert(
      "Remover membro",
      `Remover ${member.name} do grupo?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover", style: "destructive", onPress: async () => {
            const { error } = await supabase
              .from("group_members")
              .delete()
              .eq("group_id", id)
              .eq("user_id", member.id);
            if (!error) load();
            else Alert.alert("Erro", "Não foi possível remover o membro.");
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Excluir grupo",
      "Ao excluir o grupo, todos os membros serão removidos e as mensagens serão apagadas permanentemente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir", style: "destructive", onPress: async () => {
            const { error } = await supabase.from("groups").delete().eq("id", id);
            if (!error) {
              router.replace("/groups" as any);
            } else {
              Alert.alert("Erro", "Não foi possível excluir o grupo.");
            }
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert(
      "Sair do grupo",
      `Tem certeza que deseja sair de "${group.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair", style: "destructive", onPress: async () => {
            const ok = await leaveGroup(id, userId);
            if (ok) router.replace("/groups" as any);
            else Alert.alert("Erro", "Não foi possível sair do grupo.");
          },
        },
      ]
    );
  };

  const renderTab = () => {
    switch (activeTab) {
      case "membros":
        return (
          <View style={{ gap: 10, padding: 16 }}>
            {/* Group avatar (owner can edit) */}
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
                {group.members.length} {group.members.length === 1 ? "membro" : "membros"}
              </Text>
            </View>

            {/* Member list */}
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
                        <Text style={[styles.roleText, { color: colors.gold }]}>Dono</Text>
                      </View>
                    )}
                    {member.role === "admin" && (
                      <Text style={[styles.roleText, { color: colors.mutedForeground }]}>Admin</Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))
            )}

            {/* Actions */}
            <View style={{ marginTop: 8, gap: 10 }}>
              {!isOwner && (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: "#fca5a5", backgroundColor: "#fef2f2" }]}
                  onPress={handleLeave}
                >
                  <Feather name="log-out" size={16} color="#dc2626" />
                  <Text style={[styles.actionBtnText, { color: "#dc2626" }]}>Sair do grupo</Text>
                </TouchableOpacity>
              )}

              {isOwner && (
                <View style={[styles.dangerCard, { borderColor: "#fca5a5", backgroundColor: "#fef2f2" }]}>
                  <View style={styles.dangerHeader}>
                    <Feather name="alert-triangle" size={16} color="#dc2626" />
                    <Text style={[styles.dangerTitle, { color: "#dc2626" }]}>Zona de Perigo</Text>
                  </View>
                  <Text style={[styles.dangerDesc, { color: "#7f1d1d" }]}>
                    Ao excluir o grupo, todos os membros serão removidos e as mensagens serão apagadas permanentemente.
                  </Text>
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Feather name="trash-2" size={16} color="#fff" />
                    <Text style={styles.deleteBtnText}>Excluir Grupo</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        );

      case "pendentes":
        return (
          <View style={styles.emptyTab}>
            <Feather name="clock" size={36} color={colors.border} />
            <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
              Nenhuma solicitação pendente
            </Text>
          </View>
        );

      case "convidar":
        return (
          <View style={styles.emptyTab}>
            <Feather name="user-plus" size={36} color={colors.border} />
            <Text style={[styles.emptyTabText, { color: colors.mutedForeground }]}>
              Pesquise usuários para convidar
            </Text>
          </View>
        );

      case "link":
        return (
          <View style={[styles.linkTab, { padding: 16 }]}>
            <View style={[styles.linkBox, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Feather name="link-2" size={18} color={colors.gold} />
              <Text style={[styles.linkText, { color: colors.navy }]} numberOfLines={1}>
                ibhub.app/grupo/{id}
              </Text>
            </View>
            <TouchableOpacity style={[styles.copyBtn, { backgroundColor: colors.gold }]}>
              <Feather name="copy" size={16} color="#fff" />
              <Text style={styles.copyBtnText}>Copiar link</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.navy }]}>Configurações</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{group.name}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const label = tab.key === "membros"
            ? `Membros (${group.members.length})`
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
