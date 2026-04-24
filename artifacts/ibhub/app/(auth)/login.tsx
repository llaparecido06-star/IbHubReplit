import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";

function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError]               = useState<string | null>(null);

  // Show suspension message when redirected here after forced sign-out
  useEffect(() => {
    AsyncStorage.getItem("account_suspended").then((val) => {
      if (val === "true") {
        setError("Sua conta foi suspensa. Entre em contato com o suporte.");
        AsyncStorage.removeItem("account_suspended");
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!email || !password) { setError("Preencha todos os campos"); return; }
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError(err.toLowerCase().includes("suspensa") || err.toLowerCase().includes("suspen")
        ? err
        : "Email ou senha incorretos");
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setSocialLoading("google");
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) setError(err);
    setSocialLoading(null);
  };

  const handleApple = async () => {
    setSocialLoading("apple");
    setError(null);
    const { error: err } = await signInWithApple();
    if (err) setError(err);
    setSocialLoading(null);
  };

  return (
    <View style={styles.root}>
      {/* Decorative top band */}
      <View style={styles.topBand} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 40 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo + tagline */}
          <View style={styles.logoSection}>
            <Image
              source={require("@/assets/images/logo_dark.png")}
              style={styles.logoImage}
              contentFit="contain"
            />
            <View style={styles.taglineWrap}>
              <Text style={styles.tagline}>REDE PROFISSIONAL DO VINHO</Text>
            </View>
          </View>

          {/* Card form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Entrar na sua conta</Text>

            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color="#c0392b" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>E-mail</Text>
              <View style={styles.fieldWrap}>
                <Feather name="mail" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="seu@email.com"
                  placeholderTextColor="#b0bec5"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Senha</Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as any)}>
                  <Text style={styles.forgotText}>Esqueceu?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.fieldWrap}>
                <Feather name="lock" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••"
                  placeholderTextColor="#b0bec5"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={17} color="#8fa3b8" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>{loading ? "Entrando..." : "Acessar"}</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou continue com</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialBtn, socialLoading === "google" && { opacity: 0.6 }]}
                onPress={handleGoogle}
                disabled={!!socialLoading}
              >
                {socialLoading === "google"
                  ? <ActivityIndicator size="small" color="#4285F4" />
                  : <GoogleLogo size={18} />
                }
                <Text style={styles.socialBtnText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.socialBtn, styles.socialBtnApple, socialLoading === "apple" && { opacity: 0.6 }]}
                onPress={handleApple}
                disabled={!!socialLoading}
              >
                {socialLoading === "apple"
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="logo-apple" size={18} color="#fff" />
                }
                <Text style={[styles.socialBtnText, { color: "#fff" }]}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Não tem conta? </Text>
            <Pressable onPress={() => router.push("/(auth)/register" as any)}>
              <Text style={styles.footerLink}>Criar conta grátis</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f5f7" },

  /* Thin navy band at the very top — just a tasteful accent */
  topBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#c9a84c",
  },

  scroll: { paddingHorizontal: 24, flexGrow: 1, justifyContent: "center" },

  /* Logo */
  logoSection: { alignItems: "center", marginBottom: 32 },
  logoImage:   { width: 160, height: 64 },
  taglineWrap: {
    marginTop: 8,
    backgroundColor: "#0d1b2a",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tagline: { fontSize: 9.5, fontWeight: "800", color: "#c9a84c", letterSpacing: 2.5 },

  /* Card */
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    gap: 16,
    shadowColor: "#0d1b2a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: "800", color: "#0d1b2a", marginBottom: 2 },

  /* Error */
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fdecea",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f5c6cb",
  },
  errorText: { color: "#c0392b", fontSize: 13, flex: 1 },

  /* Fields */
  fieldGroup: { gap: 6 },
  labelRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: "#0d1b2a" },
  forgotText: { fontSize: 13, color: "#c9a84c", fontWeight: "600" },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f5f7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dde1e7",
    paddingHorizontal: 14,
    minHeight: 50,
  },
  fieldIcon: { marginRight: 10 },
  textInput: {
    flex: 1,
    color: "#0d1b2a",
    fontSize: 15,
    paddingVertical: Platform.OS === "android" ? 12 : 0,
  },
  eyeBtn: { padding: 4 },

  /* Primary button */
  primaryBtn: {
    backgroundColor: "#c9a84c",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    shadowColor: "#c9a84c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: { color: "#0d1b2a", fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },

  /* Divider */
  dividerRow:  { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#dde1e7" },
  dividerText: { color: "#8fa3b8", fontSize: 12, fontWeight: "500" },

  /* Social buttons */
  socialRow: { flexDirection: "row", gap: 12 },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f5f7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dde1e7",
    paddingVertical: 13,
    gap: 8,
  },
  socialBtnApple: {
    backgroundColor: "#0d1b2a",
    borderColor: "#0d1b2a",
  },
  socialBtnText: { color: "#0d1b2a", fontSize: 14, fontWeight: "600" },
  googleG:       { color: "#4285F4", fontSize: 15, fontWeight: "800" },

  /* Footer */
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  footerText: { color: "#8fa3b8", fontSize: 14 },
  footerLink: { color: "#0d1b2a", fontSize: 14, fontWeight: "800" },
});
