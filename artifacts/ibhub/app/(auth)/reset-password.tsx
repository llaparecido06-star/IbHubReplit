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
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ResetPasswordScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { updatePassword, clearRecovery } = useAuth();

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
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
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
          /* ── Success state ─────────────────────────────────── */
          <View style={styles.centeredBox}>
            <View style={[styles.iconCircle, { backgroundColor: colors.gold + "20" }]}>
              <Text style={{ fontSize: 36 }}>✓</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Senha alterada!</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Sua senha foi redefinida com sucesso. Você já pode usar a nova senha para entrar.
            </Text>
            <Button
              title="Ir para o app"
              onPress={handleContinue}
              variant="gold"
              size="lg"
              fullWidth
            />
          </View>
        ) : (
          /* ── Form state ────────────────────────────────────── */
          <View style={styles.form}>
            {/* Lock icon */}
            <View style={styles.centeredBox}>
              <View style={[styles.iconCircle, { backgroundColor: colors.navy + "15" }]}>
                <Text style={{ fontSize: 36 }}>🔐</Text>
              </View>
              <Text style={[styles.title, { color: colors.foreground }]}>Nova senha</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Escolha uma senha segura de pelo menos 6 caracteres.
              </Text>
            </View>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15" }]}>
                <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text>
              </View>
            )}

            <Input
              label="Nova senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              leftIcon="lock"
              rightIcon={showPass ? "eye-off" : "eye"}
              onRightIconPress={() => setShowPass(v => !v)}
              placeholder="Mínimo 6 caracteres"
            />

            <Input
              label="Confirmar senha"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              leftIcon="lock"
              rightIcon={showConfirm ? "eye-off" : "eye"}
              onRightIconPress={() => setShowConfirm(v => !v)}
              placeholder="Repita a nova senha"
            />

            <Button
              title="Salvar nova senha"
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
