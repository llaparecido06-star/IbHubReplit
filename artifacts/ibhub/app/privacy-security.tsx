import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { updateProfile, deleteAccount } from "@/services/api";
import { getSessionSafe } from "@/services/api/_shared";
import { useTranslation } from "react-i18next";

export default function PrivacySecurityScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const { t } = useTranslation();

  const [publicProfile, setPublicProfile]         = useState<boolean>(true);
  const [allowMessages, setAllowMessages]         = useState<boolean>(true);
  const [showConnections, setShowConnections]     = useState<boolean>(true);
  const [savingVisibility, setSavingVisibility]   = useState(false);
  const [savingMessages, setSavingMessages]       = useState(false);
  const [savingConnections, setSavingConnections] = useState(false);

  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [newPassword, setNewPassword]       = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw]             = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  useEffect(() => {
    if (profile) {
      setPublicProfile(profile.is_public !== false);
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
    try {
      const ok = await updateProfile(profile.id, { [field]: value } as any);
      if (!ok) {
        optimistic(prevValue);
        Alert.alert("Erro", "Não foi possível salvar a configuração. Tente novamente.");
      } else {
        await refreshProfile();
      }
    } catch {
      optimistic(prevValue);
      Alert.alert("Erro de Conexão", "Verifique sua conexão e tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert(t("common.attention"), t("privacy.pw_fill_both"));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t("common.attention"), t("privacy.pw_too_short"));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t("common.attention"), t("privacy.pw_mismatch"));
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPw(false);
    if (error) {
      Alert.alert(t("common.error"), error.message ?? t("privacy.pw_change_error"));
    } else {
      setPwModalVisible(false);
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert(t("common.success"), t("privacy.pw_changed"));
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("privacy.delete_title"),
      t("privacy.delete_msg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("privacy.delete_yes"),
          style: "destructive",
          onPress: () => {
            Alert.alert(
              t("privacy.delete_final_title"),
              t("privacy.delete_final_msg"),
              [
                { text: t("common.cancel"), style: "cancel" },
                {
                  text: t("privacy.delete_final_btn"),
                  style: "destructive",
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      const { data: sessionData } = await getSessionSafe();
                      const token = sessionData?.session?.access_token;
                      if (!token) {
                        Alert.alert(t("common.error"), t("privacy.session_invalid"));
                        return;
                      }
                      const result = await deleteAccount(token);
                      if (!result.success) {
                        Alert.alert(t("common.error"), result.error ?? t("privacy.delete_error"));
                        return;
                      }
                      if (result.warnings && result.warnings.length > 0) {
                        console.warn("[deleteAccount] partial cleanup warnings:", result.warnings);
                      }
                      await supabase.auth.signOut();
                      router.replace("/");
                    } finally {
                      setDeletingAccount(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("privacy.title")}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>

        {/* Visibilidade */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.sectionHead}>
            <Feather name="eye" size={15} color={colors.gold} />
            <Text style={[styles.sectionHeadText, { color: colors.navy }]}>{t("privacy.section_visibility")}</Text>
          </View>
          <View style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>{t("privacy.public_profile")}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {t("privacy.public_profile_sub")}
              </Text>
              {savingVisibility && (
                <Text style={[styles.rowSub, { color: colors.gold }]}>{t("common.saving")}</Text>
              )}
            </View>
            <Switch
              value={publicProfile}
              onValueChange={(v) => saveToggle("is_public", v, setPublicProfile, setSavingVisibility, publicProfile)}
              trackColor={{ false: colors.border, true: colors.navy }}
              thumbColor="#fff"
              disabled={savingVisibility}
            />
          </View>
        </View>

        {/* Controle Social */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.sectionHead}>
            <Feather name="users" size={15} color={colors.gold} />
            <Text style={[styles.sectionHeadText, { color: colors.navy }]}>{t("privacy.section_social")}</Text>
          </View>

          <View style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>{t("privacy.allow_messages")}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {t("privacy.allow_messages_sub")}
              </Text>
              {savingMessages && (
                <Text style={[styles.rowSub, { color: colors.gold }]}>{t("common.saving")}</Text>
              )}
            </View>
            <Switch
              value={allowMessages}
              onValueChange={(v) => saveToggle("allow_messages", v, setAllowMessages, setSavingMessages, allowMessages)}
              trackColor={{ false: colors.border, true: colors.navy }}
              thumbColor="#fff"
              disabled={savingMessages}
            />
          </View>

          <View style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>{t("privacy.show_connections")}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {t("privacy.show_connections_sub")}
              </Text>
              {savingConnections && (
                <Text style={[styles.rowSub, { color: colors.gold }]}>{t("common.saving")}</Text>
              )}
            </View>
            <Switch
              value={showConnections}
              onValueChange={(v) => saveToggle("show_connections", v, setShowConnections, setSavingConnections, showConnections)}
              trackColor={{ false: colors.border, true: colors.navy }}
              thumbColor="#fff"
              disabled={savingConnections}
            />
          </View>

          <TouchableOpacity
            style={[styles.arrowRow, { borderTopColor: colors.border }]}
            onPress={() => router.push("/blocked-users" as any)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>{t("privacy.blocked_users")}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{t("privacy.blocked_users_sub")}</Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowRow, { borderTopColor: colors.border }]}
            onPress={() => router.push("/my-reports" as any)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>{t("privacy.my_reports")}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>{t("privacy.my_reports_sub")}</Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
            <Feather name="flag" size={15} color={colors.mutedForeground} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>{t("privacy.how_to_report")}</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                {t("privacy.how_to_report_sub")}
              </Text>
            </View>
          </View>
        </View>

        {/* Segurança */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.sectionHead}>
            <Feather name="shield" size={15} color={colors.gold} />
            <Text style={[styles.sectionHeadText, { color: colors.navy }]}>{t("privacy.section_security")}</Text>
          </View>
          <TouchableOpacity
            style={[styles.arrowRow, { borderTopColor: colors.border }]}
            onPress={() => setPwModalVisible(true)}
          >
            <Text style={[styles.rowLabel, { color: colors.navy }]}>{t("privacy.change_password")}</Text>
            <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Zona de perigo */}
        <View style={[styles.dangerCard, { backgroundColor: "#fff5f5", borderColor: "#fecaca" }]}>
          <View style={styles.dangerHead}>
            <Feather name="trash-2" size={15} color="#dc2626" />
            <Text style={[styles.dangerTitle, { color: "#dc2626" }]}>{t("privacy.danger_zone")}</Text>
          </View>
          <Text style={[styles.dangerText, { color: colors.mutedForeground }]}>
            {t("privacy.danger_text")}
          </Text>
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: "#dc2626", opacity: deletingAccount ? 0.5 : 1 }]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Text style={[styles.deleteBtnText, { color: "#dc2626" }]}>{t("privacy.delete_account")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={pwModalVisible} transparent animationType="fade" onRequestClose={() => setPwModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: "#fff" }]}>
            <Text style={[styles.modalTitle, { color: colors.navy }]}>{t("privacy.modal_title")}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.navy }]}
              placeholder={t("privacy.new_password")}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.navy }]}
              placeholder={t("privacy.confirm_password")}
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => { setPwModalVisible(false); setNewPassword(""); setConfirmPassword(""); }}
                disabled={savingPw}
              >
                <Text style={[styles.modalBtnText, { color: colors.navy }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.navy, borderColor: colors.navy }]}
                onPress={handleChangePassword}
                disabled={savingPw}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {savingPw ? t("common.saving") : t("common.save")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:     { fontSize: 20, fontWeight: "700" },
  card:            { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  sectionHead:     { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  sectionHeadText: { fontSize: 15, fontWeight: "700" },
  row:             { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1 },
  arrowRow:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1 },
  infoRow:         { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: 1 },
  rowLabel:        { fontSize: 15, fontWeight: "600" },
  rowSub:          { fontSize: 12, marginTop: 2 },
  dangerCard:      { borderRadius: 12, borderWidth: 1.5, padding: 16, gap: 12 },
  dangerHead:      { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerTitle:     { fontSize: 15, fontWeight: "700" },
  dangerText:      { fontSize: 13, lineHeight: 20 },
  deleteBtn:       { alignItems: "center", paddingVertical: 14, borderRadius: 10, borderWidth: 1.5 },
  deleteBtnText:   { fontSize: 15, fontWeight: "600" },
  modalOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalBox:        { width: "100%", borderRadius: 16, padding: 24, gap: 14 },
  modalTitle:      { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  input:           { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalActions:    { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn:        { flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 10, borderWidth: 1.5 },
  modalBtnText:    { fontSize: 15, fontWeight: "600" },
});
