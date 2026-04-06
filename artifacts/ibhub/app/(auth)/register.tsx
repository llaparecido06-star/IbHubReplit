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
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function RegisterScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setError("Preencha todos os campos");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: err } = await signUp(email, password, fullName);
    if (err) {
      setError(err);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <View style={[styles.container, styles.successContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.successIcon, { backgroundColor: colors.gold + "20" }]}>
          <Text style={{ fontSize: 40 }}>✓</Text>
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>Conta criada!</Text>
        <Text style={[styles.successText, { color: colors.mutedForeground }]}>
          Verifique seu email para confirmar seu cadastro.
        </Text>
        <Button
          title="Ir para o Login"
          onPress={() => router.replace("/(auth)/login" as any)}
          variant="gold"
          size="lg"
          fullWidth
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Criar conta</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Junte-se à maior rede de profissionais do vinho
          </Text>
        </View>

        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15" }]}>
            <Text style={{ color: colors.destructive, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Input
            label="Nome completo"
            value={fullName}
            onChangeText={setFullName}
            leftIcon="user"
            placeholder="Seu nome completo"
            autoCapitalize="words"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
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
            placeholder="Mínimo 6 caracteres"
          />
          <Input
            label="Confirmar senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            leftIcon="lock"
            placeholder="Repita a senha"
          />

          <Button
            title="Criar conta"
            onPress={handleRegister}
            loading={loading}
            variant="gold"
            size="lg"
            fullWidth
            style={{ marginTop: 8 }}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Já tem uma conta?{" "}
          </Text>
          <Pressable onPress={() => router.replace("/(auth)/login" as any)}>
            <Text style={[styles.footerLink, { color: colors.gold }]}>Entrar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, gap: 16 },
  header: { gap: 6, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15 },
  errorBox: { padding: 12, borderRadius: 8 },
  form: { gap: 14 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: "700" },
  successContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 24, fontWeight: "800" },
  successText: { fontSize: 15, textAlign: "center" },
});
