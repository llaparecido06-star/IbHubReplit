import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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

const TOTAL_STEPS = 3;

const AREAS = [
  "Sommelier",
  "Comprador",
  "Importador",
  "Produtor",
  "Enólogo",
  "Consultor",
  "Investidor",
  "Entusiasta",
  "Outros",
];

const PLANS = [
  {
    key: "gratuito",
    name: "Gratuito",
    price: "GRÁTIS",
    subtitle: "Para iniciantes",
    popular: false,
    features: ["Perfil básico", "Feed de publicações", "5 conexões/mês"],
  },
  {
    key: "basico",
    name: "Básico",
    price: "R$ 149/mês",
    subtitle: "Para profissionais",
    popular: true,
    features: ["Tudo do Gratuito", "Conexões ilimitadas", "Marketplace", "Dados de mercado"],
  },
  {
    key: "executivo",
    name: "Executivo",
    price: "R$ 499/mês",
    subtitle: "Business completo",
    popular: false,
    features: [
      "Tudo do Básico",
      "Inteligência de mercado",
      "Vagas de emprego",
      "Suporte prioritário",
    ],
  },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  const [selectedPlan, setSelectedPlan] = useState("gratuito");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const goBack = () => {
    if (step === 1) {
      router.back();
    } else {
      setStep((s) => s - 1);
    }
  };

  const validateStep1 = (): string | null => {
    if (!fullName.trim()) return "Informe seu nome completo";
    if (!username.trim()) return "Informe um username";
    if (!email.trim() || !email.includes("@")) return "Informe um email válido";
    if (!password || password.length < 6) return "A senha deve ter ao menos 6 caracteres";
    if (password !== confirmPassword) return "As senhas não coincidem";
    if (!termsAccepted) return "Aceite os Termos de Uso para continuar";
    return null;
  };

  const validateStep2 = (): string | null => {
    if (selectedAreas.length === 0) return "Selecione ao menos uma área de atuação";
    return null;
  };

  const nextStep = async () => {
    setError(null);
    if (step === 1) {
      const err = validateStep1();
      if (err) { setError(err); return; }
      setStep(2);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) { setError(err); return; }
      setStep(3);
    } else {
      setLoading(true);
      const { error: err } = await signUp(email, password, fullName);
      setLoading(false);
      if (err) {
        setError(err);
      } else {
        Alert.alert(
          "Conta criada!",
          "Verifique seu email para ativar a conta.",
          [{ text: "OK", onPress: () => router.replace("/(auth)/login" as any) }]
        );
      }
    }
  };

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: "#0d1b2a" }]}>
      <View style={[styles.headerBar, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#f5f0e8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cadastro</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressBar,
              { backgroundColor: i < step ? "#c9a84c" : "rgba(255,255,255,0.18)" },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Seus dados pessoais</Text>

              <TouchableOpacity style={styles.avatarPicker} onPress={pickAvatar}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Feather name="camera" size={28} color="#8fa3b8" />
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Feather name="camera" size={13} color="#0d1b2a" />
                </View>
              </TouchableOpacity>

              <FormField
                icon="user"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Nome completo"
              />
              <FormField
                icon="at-sign"
                value={username}
                onChangeText={setUsername}
                placeholder="Username"
                autoCapitalize="none"
              />
              <FormField
                icon="mail"
                value={email}
                onChangeText={setEmail}
                placeholder="E-mail"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.phoneRow}>
                <View style={[styles.fieldWrap, styles.countryCode]}>
                  <Text style={styles.flag}>🇧🇷</Text>
                  <Text style={styles.countryCodeText}>+55</Text>
                </View>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor="#8fa3b8"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.fieldWrap}>
                <Feather name="lock" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Senha"
                  placeholderTextColor="#8fa3b8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#8fa3b8" />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldWrap}>
                <Feather name="lock" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Confirme a senha"
                  placeholderTextColor="#8fa3b8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity onPress={() => setShowConfirm((v) => !v)}>
                  <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color="#8fa3b8" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setTermsAccepted((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
                  {termsAccepted && <Feather name="check" size={12} color="#0d1b2a" />}
                </View>
                <Text style={styles.termsText}>
                  Li e concordo com os{" "}
                  <Text style={styles.termsLink}>Termos de Uso</Text> e a{" "}
                  <Text style={styles.termsLink}>Política de Privacidade</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Área de atuação</Text>
              <Text style={styles.stepSubtitle}>
                Selecione suas áreas para networking qualificado
              </Text>

              <View style={styles.areasGrid}>
                {AREAS.map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={[
                      styles.areaChip,
                      selectedAreas.includes(area) && styles.areaChipActive,
                    ]}
                    onPress={() => toggleArea(area)}
                  >
                    <Text
                      style={[
                        styles.areaChipText,
                        selectedAreas.includes(area) && styles.areaChipTextActive,
                      ]}
                    >
                      {area}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FormField
                icon={undefined}
                value={company}
                onChangeText={setCompany}
                placeholder="Empresa"
              />
              <FormField
                icon={undefined}
                value={role}
                onChangeText={setRole}
                placeholder="Cargo"
              />
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Escolha seu plano</Text>
              <Text style={styles.stepSubtitle}>
                Selecione o plano perfeito para suas necessidades
              </Text>

              <View style={styles.plansContainer}>
                {PLANS.map((plan) => (
                  <TouchableOpacity
                    key={plan.key}
                    style={[
                      styles.planCard,
                      selectedPlan === plan.key && styles.planCardActive,
                    ]}
                    onPress={() => setSelectedPlan(plan.key)}
                    activeOpacity={0.8}
                  >
                    {plan.popular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>POPULAR</Text>
                      </View>
                    )}
                    <View style={styles.planHeader}>
                      <View>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                      </View>
                      <Text style={[styles.planPrice, plan.key === "gratuito" && { color: "#c9a84c" }]}>
                        {plan.price}
                      </Text>
                    </View>
                    <View style={styles.planFeatures}>
                      {plan.features.map((feat) => (
                        <View key={feat} style={styles.planFeatureRow}>
                          <Feather name="check" size={14} color="#c9a84c" />
                          <Text style={styles.planFeatureText}>{feat}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.continueBtn, loading && { opacity: 0.7 }]}
            onPress={nextStep}
            disabled={loading}
          >
            <Text style={styles.continueBtnText}>
              {loading
                ? "Criando conta..."
                : step === TOTAL_STEPS
                ? "Finalizar cadastro"
                : `Continuar  →`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FormField({
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: {
  icon?: keyof typeof Feather.glyphMap;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      {icon && <Feather name={icon} size={16} color="#8fa3b8" style={styles.fieldIcon} />}
      <TextInput
        style={[styles.textInput, !icon && { paddingLeft: 0 }]}
        placeholder={placeholder}
        placeholderTextColor="#8fa3b8"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "words"}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: { width: 32, height: 32, justifyContent: "center" },
  headerTitle: {
    color: "#f5f0e8",
    fontSize: 17,
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  errorBox: {
    backgroundColor: "rgba(231,76,60,0.15)",
    padding: 12,
    borderRadius: 10,
  },
  errorText: { color: "#e74c3c", fontSize: 13 },
  stepContainer: { gap: 14 },
  stepTitle: {
    color: "#f5f0e8",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    color: "#8fa3b8",
    fontSize: 14,
    lineHeight: 20,
    marginTop: -6,
  },
  avatarPicker: {
    alignSelf: "center",
    position: "relative",
    marginBottom: 4,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#c9a84c",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0d1b2a",
  },
  fieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 0,
    minHeight: 52,
  },
  fieldIcon: { marginRight: 10 },
  textInput: {
    flex: 1,
    color: "#f5f0e8",
    fontSize: 15,
    paddingVertical: Platform.OS === "android" ? 14 : 0,
  },
  phoneRow: { flexDirection: "row", gap: 10 },
  countryCode: {
    flex: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  flag: { fontSize: 18 },
  countryCodeText: { color: "#f5f0e8", fontSize: 15, fontWeight: "600" },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxActive: {
    backgroundColor: "#c9a84c",
    borderColor: "#c9a84c",
  },
  termsText: {
    color: "#8fa3b8",
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  termsLink: {
    color: "#c9a84c",
    fontWeight: "600",
  },
  areasGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  areaChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  areaChipActive: {
    borderColor: "#c9a84c",
    backgroundColor: "rgba(201,168,76,0.12)",
  },
  areaChipText: {
    color: "#8fa3b8",
    fontSize: 14,
    fontWeight: "500",
  },
  areaChipTextActive: {
    color: "#c9a84c",
    fontWeight: "700",
  },
  plansContainer: { gap: 12 },
  planCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18,
    gap: 14,
    position: "relative",
  },
  planCardActive: {
    borderColor: "#c9a84c",
    backgroundColor: "rgba(201,168,76,0.06)",
  },
  popularBadge: {
    position: "absolute",
    top: -1,
    right: 14,
    backgroundColor: "#c9a84c",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  popularBadgeText: {
    color: "#0d1b2a",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planName: {
    color: "#f5f0e8",
    fontSize: 18,
    fontWeight: "800",
  },
  planSubtitle: {
    color: "#8fa3b8",
    fontSize: 12,
    marginTop: 2,
  },
  planPrice: {
    color: "#f5f0e8",
    fontSize: 16,
    fontWeight: "800",
  },
  planFeatures: { gap: 8 },
  planFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planFeatureText: {
    color: "#c9d4de",
    fontSize: 14,
  },
  continueBtn: {
    backgroundColor: "#c9a84c",
    borderRadius: 10,
    paddingVertical: 17,
    alignItems: "center",
    marginTop: 8,
  },
  continueBtnText: {
    color: "#0d1b2a",
    fontSize: 16,
    fontWeight: "800",
  },
});
