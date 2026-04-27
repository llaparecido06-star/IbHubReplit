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

export default function PrivacySecurityScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();

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
      Alert.alert("Atenção", "Preencha os dois campos.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Atenção", "A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Atenção", "As senhas não coincidem.");
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPw(false);
    if (error) {
      Alert.alert("Erro", error.message ?? "Não foi possível alterar a senha.");
    } else {
      setPwModalVisible(false);
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Sucesso", "Senha alterada com sucesso!");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Excluir conta",
      "Esta ação é permanente. Todos os seus dados (perfil, posts, mensagens, adega) serão removidos definitivamente. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sim, quero excluir",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirmação final",
              "Você tem certeza? Após a exclusão, sua conta e todos os dados associados serão APAGADOS PERMANENTEMENTE e não poderão ser recuperados.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Excluir definitivamente",
                  style: "destructive",
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      const { data: sessionData } = await supabase.auth.getSession();
                      const token = sessionData?.session?.access_token;
                      if (!token) {
                        Alert.alert("Erro", "Sessão inválida. Faça login novamente.");
                        return;
                      }
                      const result = await deleteAccount(token);
                      if (!result.success) {
                        Alert.alert("Erro", result.error ?? "Não foi possível excluir a conta.");
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
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Privacidade e Segurança</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>

        {/* Visibilidade */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.sectionHead}>
            <Feather name="eye" size={15} color={colors.gold} />
            <Text style={[styles.sectionHeadText, { color: colors.navy }]}>Visibilidade do Perfil</Text>
          </View>
          <View style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>Perfil Público</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Qualquer pessoa pode ver seu perfil e publicações
              </Text>
              {savingVisibility && (
                <Text style={[styles.rowSub, { color: colors.gold }]}>Salvando...</Text>
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
            <Text style={[styles.sectionHeadText, { color: colors.navy }]}>Controle Social</Text>
          </View>

          <View style={[styles.row, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>Permitir mensagens</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Não-conexões podem te enviar mensagens diretas
              </Text>
              {savingMessages && (
                <Text style={[styles.rowSub, { color: colors.gold }]}>Salvando...</Text>
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
              <Text style={[styles.rowLabel, { color: colors.navy }]}>Mostrar conexões</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Sua rede de conexões é visível no seu perfil
              </Text>
              {savingConnections && (
                <Text style={[styles.rowSub, { color: colors.gold }]}>Salvando...</Text>
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
              <Text style={[styles.rowLabel, { color: colors.navy }]}>Usuários Bloqueados</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Ver e gerenciar bloqueios</Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.arrowRow, { borderTopColor: colors.border }]}
            onPress={() => router.push("/my-reports" as any)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>Minhas Denúncias</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>Ver histórico de denúncias enviadas</Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={[styles.infoRow, { borderTopColor: colors.border }]}>
            <Feather name="flag" size={15} color={colors.mutedForeground} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.navy }]}>Como denunciar</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Use o menu "⋯" em qualquer post ou perfil para denunciar conteúdo inadequado.
              </Text>
            </View>
          </View>
        </View>

        {/* Segurança */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.sectionHead}>
            <Feather name="shield" size={15} color={colors.gold} />
            <Text style={[styles.sectionHeadText, { color: colors.navy }]}>Segurança</Text>
          </View>
          <TouchableOpacity
            style={[styles.arrowRow, { borderTopColor: colors.border }]}
            onPress={() => setPwModalVisible(true)}
          >
            <Text style={[styles.rowLabel, { color: colors.navy }]}>Alterar senha</Text>
            <Feather name="arrow-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Zona de perigo */}
        <View style={[styles.dangerCard, { backgroundColor: "#fff5f5", borderColor: "#fecaca" }]}>
          <View style={styles.dangerHead}>
            <Feather name="trash-2" size={15} color="#dc2626" />
            <Text style={[styles.dangerTitle, { color: "#dc2626" }]}>Zona de Perigo</Text>
          </View>
          <Text style={[styles.dangerText, { color: colors.mutedForeground }]}>
            Ao excluir sua conta, todos os seus dados (perfil, posts, mensagens, adega) serão permanentemente removidos. Esta ação não pode ser desfeita.
          </Text>
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: "#dc2626", opacity: deletingAccount ? 0.5 : 1 }]}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Text style={[styles.deleteBtnText, { color: "#dc2626" }]}>Excluir minha conta</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={pwModalVisible} transparent animationType="fade" onRequestClose={() => setPwModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: "#fff" }]}>
            <Text style={[styles.modalTitle, { color: colors.navy }]}>Alterar Senha</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.navy }]}
              placeholder="Nova senha"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.navy }]}
              placeholder="Confirmar nova senha"
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
                <Text style={[styles.modalBtnText, { color: colors.navy }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.navy, borderColor: colors.navy }]}
                onPress={handleChangePassword}
                disabled={savingPw}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {savingPw ? "Salvando..." : "Salvar"}
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
