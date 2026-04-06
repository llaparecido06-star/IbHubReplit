import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const { resetPassword } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (!email) {
      setError("Informe seu email");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await resetPassword(email);
    if (err) {
      setError(err);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={{ color: colors.gold, fontSize: 16, fontWeight: "600" }}>← Voltar</Text>
        </Pressable>

        {sent ? (
          <View style={styles.sentContainer}>
            <View style={[styles.icon, { backgroundColor: colors.gold + "20" }]}>
              <Text style={{ fontSize: 32, color: colors.gold }}>✓</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Email enviado!</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
            </Text>
            <Button
              title="Voltar ao Login"
              onPress={() => router.replace("/(auth)/login" as any)}
              variant="gold"
              size="lg"
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={[styles.title, { color: colors.foreground }]}>Recuperar senha</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Insira seu email e enviaremos um link para redefinir sua senha.
            </Text>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15" }]}>
                <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text>
              </View>
            )}

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              leftIcon="mail"
              placeholder="seu@email.com"
            />

            <Button
              title="Enviar link de recuperação"
              onPress={handleReset}
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
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, gap: 24 },
  back: { marginBottom: 8 },
  form: { gap: 16 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  errorBox: { padding: 12, borderRadius: 8 },
  sentContainer: { gap: 16, alignItems: "center" },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
});
