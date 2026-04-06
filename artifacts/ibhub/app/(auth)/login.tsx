import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) { setError("Preencha todos os campos"); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) setError("Email ou senha incorretos");
    setLoading(false);
  };

  return (
    <View style={styles.root}>
      <Image
        source={require("@/assets/images/wine_social.png")}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <View style={[StyleSheet.absoluteFillObject, styles.overlay]} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoSection}>
            <Text style={styles.brand}>ibhub</Text>
            <Text style={styles.tagline}>REDE PROFISSIONAL DO VINHO</Text>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldWrap}>
              <Feather name="mail" size={17} color="#8fa3b8" style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="E-mail"
                placeholderTextColor="#8fa3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Feather name="lock" size={17} color="#8fa3b8" style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Senha"
                placeholderTextColor="#8fa3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#8fa3b8" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => router.push("/(auth)/forgot-password" as any)}
            >
              <Text style={styles.forgotText}>Esqueceu sua senha?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>{loading ? "Entrando..." : "Acessar"}</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn}>
                <Text style={styles.googleG}>G</Text>
                <Text style={styles.socialBtnText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn}>
                <Text style={styles.appleLogo}></Text>
                <Text style={styles.socialBtnText}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem conta? </Text>
            <Pressable onPress={() => router.push("/(auth)/register" as any)}>
              <Text style={styles.footerLink}>Cadastrar</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d1b2a" },
  overlay: { backgroundColor: "rgba(8, 18, 30, 0.72)" },
  scroll: { paddingHorizontal: 28, flexGrow: 1, justifyContent: "center" },
  logoSection: { alignItems: "center", marginBottom: 52 },
  brand: { fontSize: 38, fontWeight: "800", color: "#c9a84c", letterSpacing: -1, marginBottom: 6 },
  tagline: { fontSize: 11, fontWeight: "700", color: "#c9a84c", letterSpacing: 2.5 },
  form: { gap: 14 },
  errorBox: { backgroundColor: "rgba(231,76,60,0.15)", padding: 12, borderRadius: 10 },
  errorText: { color: "#e74c3c", fontSize: 13 },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    minHeight: 52,
  },
  fieldIcon: { marginRight: 10 },
  textInput: {
    flex: 1,
    color: "#f5f0e8",
    fontSize: 15,
    paddingVertical: Platform.OS === "android" ? 14 : 0,
  },
  eyeBtn: { padding: 4 },
  forgotRow: { alignSelf: "flex-end", marginTop: -4 },
  forgotText: { color: "#c9a84c", fontSize: 13, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: "#c9a84c",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#0d1b2a", fontSize: 16, fontWeight: "800" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 2,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.14)" },
  dividerText: { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  socialRow: { flexDirection: "row", gap: 12 },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingVertical: 14,
    gap: 8,
  },
  socialBtnText: { color: "#f5f0e8", fontSize: 14, fontWeight: "600" },
  googleG: { color: "#f5f0e8", fontSize: 16, fontWeight: "800" },
  appleLogo: { color: "#f5f0e8", fontSize: 18 },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 36,
  },
  footerText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  footerLink: { color: "#c9a84c", fontSize: 14, fontWeight: "800" },
});
