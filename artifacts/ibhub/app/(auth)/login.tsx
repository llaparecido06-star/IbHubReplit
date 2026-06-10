import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useTranslation } from "react-i18next";
import { Feather } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("account_suspended").then((val) => {
      if (val === "true") {
        setError(t("auth.login.suspended"));
        AsyncStorage.removeItem("account_suspended");
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!email || !password) { setError(t("auth.login.error_empty")); return; }
    console.log("[Login] handleLogin — calling signIn");
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    if (err) {
      console.error("[Login] signIn returned error:", err);
      setError(err.toLowerCase().includes("suspensa") || err.toLowerCase().includes("suspen")
        ? err
        : t("auth.login.error_invalid"));
      setLoading(false);
      return;
    }
    // signIn returned OK — navigation is driven by RootLayoutNav's useEffect
    // after onAuthStateChange(SIGNED_IN) fires. Keep loading=true so the button
    // stays disabled until AuthenticatedLayout replaces the screen.
    console.log("[Login] signIn OK — handing off to RootLayoutNav for navigation");
  };

  return (
    <View style={styles.root}>
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

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("auth.login.title")}</Text>

            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color="#c0392b" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t("auth.login.email_label")}</Text>
              <View style={styles.fieldWrap}>
                <Feather name="mail" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t("auth.login.email_placeholder")}
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
                <Text style={styles.fieldLabel}>{t("auth.login.password_label")}</Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password" as any)}>
                  <Text style={styles.forgotText}>{t("auth.login.forgot_password")}</Text>
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
              <Text style={styles.primaryBtnText}>
                {loading ? t("auth.login.logging_in") : t("auth.login.login_btn")}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t("auth.login.no_account")} </Text>
            <Pressable onPress={() => router.push("/(auth)/register" as any)}>
              <Text style={styles.footerLink}>{t("auth.login.register")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f5f7" },
  topBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#c9a84c",
  },
  scroll: { paddingHorizontal: 24, flexGrow: 1, justifyContent: "center" },
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 28,
  },
  footerText: { color: "#8fa3b8", fontSize: 14 },
  footerLink: { color: "#0d1b2a", fontSize: 14, fontWeight: "800" },
});
