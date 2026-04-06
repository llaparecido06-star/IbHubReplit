import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Preencha todos os campos");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError("Email ou senha incorretos");
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoMark, { backgroundColor: colors.navy }]}>
            <Text style={[styles.logoText, { color: colors.gold }]}>IB</Text>
          </View>
          <Text style={[styles.brand, { color: colors.navy }]}>ibhub</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Rede do Vinho
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.title, { color: colors.foreground }]}>Bem-vindo de volta</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Entre na sua conta para continuar
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
            autoCorrect={false}
            leftIcon="mail"
            placeholder="seu@email.com"
          />

          <Input
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            leftIcon="lock"
            rightIcon={showPassword ? "eye-off" : "eye"}
            onRightIconPress={() => setShowPassword((v) => !v)}
            placeholder="••••••••"
          />

          <Pressable
            style={styles.forgotPassword}
            onPress={() => router.push("/(auth)/forgot-password" as any)}
          >
            <Text style={[styles.forgotText, { color: colors.gold }]}>Esqueceu a senha?</Text>
          </Pressable>

          <Button
            title="Entrar"
            onPress={handleLogin}
            loading={loading}
            variant="gold"
            size="lg"
            fullWidth
            style={{ marginTop: 8 }}
          />

          <Divider label="ou" style={{ marginVertical: 20 }} />

          <Button
            title="Continuar com Google"
            onPress={() => {}}
            variant="outline"
            size="lg"
            fullWidth
          />
          <Button
            title="Continuar com Apple"
            onPress={() => {}}
            variant="primary"
            size="lg"
            fullWidth
            style={{ marginTop: 10 }}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Não tem uma conta?{" "}
          </Text>
          <Pressable onPress={() => router.replace("/(auth)/register" as any)}>
            <Text style={[styles.footerLink, { color: colors.gold }]}>Cadastre-se</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, gap: 0 },
  logoSection: { alignItems: "center", marginBottom: 36, gap: 6 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  logoText: { fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  brand: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  tagline: { fontSize: 14, letterSpacing: 2, textTransform: "uppercase" },
  form: { gap: 14 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginBottom: 4 },
  errorBox: { padding: 12, borderRadius: 8 },
  forgotPassword: { alignSelf: "flex-end" },
  forgotText: { fontSize: 13, fontWeight: "600" },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: "700" },
});
