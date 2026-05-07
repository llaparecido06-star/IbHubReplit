import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ResetPasswordScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { t } = useTranslation();
  const { updatePassword, clearRecovery, mustChangePassword } = useAuth();

  const [password, setPassword]         = useState("");
  const [confirm, setConfirm]           = useState("");
  const [showPass, setShowPass]         = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [done, setDone]                 = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError(t("auth.reset_password.error_short"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.reset_password.error_match"));
      return;
    }
    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setDone(true);
    }
  };

  const handleContinue = () => {
    clearRecovery();
    router.replace("/(tabs)" as any);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>

        {done ? (
          <View style={styles.centeredBox}>
            <View style={[styles.iconCircle, { backgroundColor: colors.gold + "20" }]}>
              <Text style={{ fontSize: 36 }}>✓</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("auth.reset_password.success_title")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t("auth.reset_password.success_subtitle")}
            </Text>
            <Button
              title={t("auth.reset_password.back_to_login")}
              onPress={handleContinue}
              variant="gold"
              size="lg"
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.centeredBox}>
              <View style={[styles.iconCircle, { backgroundColor: colors.navy + "15" }]}>
                <Text style={{ fontSize: 36 }}>🔐</Text>
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>{t("auth.reset_password.title")}</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {t("auth.reset_password.subtitle")}
              </Text>
            </View>

            {mustChangePassword && (
              <View style={{ backgroundColor: "#fffbeb", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#fde68a", marginBottom: 8, flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#92400e" }}>Troca obrigatória</Text>
                  <Text style={{ fontSize: 12, color: "#78350f", marginTop: 2, lineHeight: 18 }}>
                    O administrador criou uma senha temporária para sua conta. Crie uma nova senha para continuar.
                  </Text>
                </View>
              </View>
            )}

            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15" }]}>
                <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text>
              </View>
            )}

            <Input
              label={t("auth.reset_password.new_password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              leftIcon="lock"
              rightIcon={showPass ? "eye-off" : "eye"}
              onRightIconPress={() => setShowPass(v => !v)}
              placeholder={t("auth.reset_password.new_password_placeholder")}
            />

            <Input
              label={t("auth.reset_password.confirm_password")}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              leftIcon="lock"
              rightIcon={showConfirm ? "eye-off" : "eye"}
              onRightIconPress={() => setShowConfirm(v => !v)}
              placeholder={t("auth.reset_password.confirm_password_placeholder")}
            />

            <Button
              title={t("auth.reset_password.save_btn")}
              onPress={handleSubmit}
              loading={loading}
              variant="gold"
              size="lg"
              fullWidth
              style={{ marginTop: 8 }}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  content:     { flex: 1, paddingHorizontal: 24, justifyContent: "center" },
  centeredBox: { alignItems: "center", gap: 12, marginBottom: 24 },
  iconCircle:  { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title:       { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  subtitle:    { fontSize: 15, lineHeight: 22, textAlign: "center" },
  form:        { gap: 16 },
  errorBox:    { padding: 12, borderRadius: 8 },
});
