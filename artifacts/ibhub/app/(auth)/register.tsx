import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { Feather } from "@/components/ui/Icon";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { applyReferralCode, ensureReferralCode } from "@/services/api";
import { usePlans, formatPlanPrice, formatOriginalPrice, calcDiscount } from "@/hooks/usePlans";

const TOTAL_STEPS = 3;

interface Country {
  flag: string;
  name: string;
  ddi: string;
  placeholder: string;
}

const COUNTRIES: Country[] = [
  { flag: "🇧🇷", name: "Brasil",          ddi: "+55",  placeholder: "(11) 99999-9999" },
  { flag: "🇺🇸", name: "Estados Unidos",  ddi: "+1",   placeholder: "(555) 000-0000" },
  { flag: "🇵🇹", name: "Portugal",        ddi: "+351", placeholder: "912 345 678" },
  { flag: "🇦🇷", name: "Argentina",       ddi: "+54",  placeholder: "11 1234-5678" },
  { flag: "🇨🇱", name: "Chile",           ddi: "+56",  placeholder: "9 1234 5678" },
  { flag: "🇺🇾", name: "Uruguai",         ddi: "+598", placeholder: "9123 4567" },
  { flag: "🇵🇾", name: "Paraguai",        ddi: "+595", placeholder: "981 234 567" },
  { flag: "🇧🇴", name: "Bolívia",         ddi: "+591", placeholder: "7123 4567" },
  { flag: "🇵🇪", name: "Peru",            ddi: "+51",  placeholder: "912 345 678" },
  { flag: "🇨🇴", name: "Colômbia",        ddi: "+57",  placeholder: "312 345 6789" },
  { flag: "🇲🇽", name: "México",          ddi: "+52",  placeholder: "55 1234 5678" },
  { flag: "🇪🇸", name: "Espanha",         ddi: "+34",  placeholder: "612 345 678" },
  { flag: "🇫🇷", name: "França",          ddi: "+33",  placeholder: "06 12 34 56 78" },
  { flag: "🇮🇹", name: "Itália",          ddi: "+39",  placeholder: "312 345 6789" },
  { flag: "🇩🇪", name: "Alemanha",        ddi: "+49",  placeholder: "1512 3456789" },
  { flag: "🇬🇧", name: "Reino Unido",     ddi: "+44",  placeholder: "7911 123456" },
  { flag: "🇨🇳", name: "China",           ddi: "+86",  placeholder: "138 0013 8000" },
  { flag: "🇯🇵", name: "Japão",           ddi: "+81",  placeholder: "90-1234-5678" },
  { flag: "🇦🇺", name: "Austrália",       ddi: "+61",  placeholder: "0412 345 678" },
  { flag: "🇿🇦", name: "África do Sul",   ddi: "+27",  placeholder: "71 234 5678" },
];

const AREAS = [
  // Produção
  "Viticultor", "Produtor", "Enólogo", "Adega / Cave",
  // Comércio exterior & distribuição
  "Importador", "Exportador", "Distribuidor", "Atacadista", "Representante Comercial",
  // Varejo & ponto de venda
  "Loja Especializada", "Supermercado", "E-commerce", "Adega",
  // Hospitalidade & serviço
  "Sommelier", "Restaurante", "Hotelaria", "Bar / Bistrô",
  // Experiências & comunicação
  "Enoturismo", "Eventos", "Marketing", "Jornalismo", "Educação",
  // Negócios & outros
  "Consultoria", "Comprador", "Investidor", "Entusiasta", "Outros",
];


type ValidationState = "idle" | "checking" | "available" | "taken" | "invalid";

function ValidationIcon({ state }: { state: ValidationState }) {
  if (state === "checking")
    return <ActivityIndicator size="small" color="#8fa3b8" style={{ marginLeft: 4 }} />;
  if (state === "available")
    return <Feather name="check-circle" size={18} color="#2ecc71" style={{ marginLeft: 4 }} />;
  if (state === "taken" || state === "invalid")
    return <Feather name="x-circle" size={18} color="#e74c3c" style={{ marginLeft: 4 }} />;
  return null;
}

function validationHint(field: "username" | "email", state: ValidationState): string | null {
  if (field === "username") {
    if (state === "available") return "Username disponível";
    if (state === "taken") return "Username já está em uso";
    if (state === "invalid") return "Apenas letras, números, . e _ (mín. 3 chars)";
  }
  if (field === "email") {
    if (state === "available") return "E-mail disponível";
    if (state === "taken") return "Este e-mail já está cadastrado";
    if (state === "invalid") return "Formato de e-mail inválido";
  }
  return null;
}

const USERNAME_RE = /^[a-zA-Z0-9._]{3,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, refreshProfileByUserId, clearProfileCompletion } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [inviteCode, setInviteCode] = useState("");

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  const [usernameState, setUsernameState] = useState<ValidationState>("idle");
  const [emailState, setEmailState] = useState<ValidationState>("idle");

  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [certInput, setCertInput] = useState("");
  const certInputRef = useRef<TextInput>(null);

  const [selectedPlan, setSelectedPlan] = useState("gratuito");
  const { paidPlans, freePlan, loading: plansLoading } = usePlans();
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Criando conta...");
  const [error, setError] = useState<string | null>(null);

  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill invite code saved by a referral deep link (ibhub://cadastro?ref=CODE)
  useEffect(() => {
    AsyncStorage.getItem("pending_invite_code").then((code) => {
      if (code && code.trim()) setInviteCode(code.trim().toUpperCase());
    }).catch(() => {});
  }, []);

  const checkUsername = useCallback(async (value: string) => {
    if (!value) { setUsernameState("idle"); return; }
    if (!USERNAME_RE.test(value)) { setUsernameState("invalid"); return; }
    setUsernameState("checking");
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", value.toLowerCase())
        .maybeSingle();
      setUsernameState(data ? "taken" : "available");
    } catch {
      setUsernameState("idle");
    }
  }, []);

  const checkEmail = useCallback(async (value: string) => {
    if (!value) { setEmailState("idle"); return; }
    if (!EMAIL_RE.test(value)) { setEmailState("invalid"); return; }
    setEmailState("checking");
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", value.toLowerCase())
        .maybeSingle();
      setEmailState(data ? "taken" : "available");
    } catch {
      setEmailState("available");
    }
  }, []);

  const onUsernameChange = (val: string) => {
    setUsername(val);
    setUsernameState(val ? "checking" : "idle");
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(() => checkUsername(val.trim()), 600);
  };

  const onEmailChange = (val: string) => {
    setEmail(val);
    setEmailState(val ? "checking" : "idle");
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(() => checkEmail(val.trim()), 600);
  };

  const filteredCountries = useMemo(
    () =>
      countrySearch.trim()
        ? COUNTRIES.filter(
            (c) =>
              c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
              c.ddi.includes(countrySearch)
          )
        : COUNTRIES,
    [countrySearch]
  );

  const pickAvatar = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à sua galeria para você escolher uma foto de perfil.",
          [{ text: "OK" }],
        );
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const uploadAvatarToStorage = async (userId: string, localUri: string): Promise<{ url: string | null; error: string | null }> => {
    try {
      const rawExt = (localUri.split(".").pop() ?? "jpg").split("?")[0].toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
      const contentType = safeExt === "jpg" || safeExt === "jpeg" ? "image/jpeg" : `image/${safeExt}`;
      const filePath = `${userId}/avatar.${safeExt}`;
      const response = await fetch(localUri);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, bytes, { upsert: true, contentType });
      if (error) { console.warn("Avatar upload:", error.message); return { url: null, error: error.message }; }
      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      return { url: data.publicUrl ?? null, error: null };
    } catch (e) {
      console.warn("Avatar upload error:", e);
      return { url: null, error: "Falha ao enviar foto" };
    }
  };

  const toggleArea = (area: string) =>
    setSelectedAreas((prev) => {
      if (prev.includes(area)) return prev.filter((a) => a !== area);
      if (prev.length >= 3) return prev;
      return [...prev, area];
    });

  const addCertification = () => {
    const trimmed = certInput.trim();
    setCertInput("");
    if (!trimmed || certifications.includes(trimmed)) return;
    setCertifications((prev) => [...prev, trimmed]);
    // Keep keyboard open so the user can quickly type the next certification
    setTimeout(() => certInputRef.current?.focus(), 50);
  };

  const removeCertification = (cert: string) =>
    setCertifications((prev) => prev.filter((c) => c !== cert));

  const goBack = () => {
    if (step === 1) router.back();
    else setStep((s) => s - 1);
  };

  const validateStep1 = (): string | null => {
    if (!fullName.trim()) return "Informe seu nome completo";
    if (!username.trim()) return "Informe um username";
    if (usernameState === "invalid") return "Username inválido (mín. 3 chars, use letras, números, . e _)";
    if (usernameState === "taken") return "Esse username já está em uso";
    if (usernameState === "checking") return "Aguarde a verificação do username";
    if (!email.trim()) return "Informe um e-mail";
    if (emailState === "invalid") return "Formato de e-mail inválido";
    if (emailState === "taken") return "Esse e-mail já está cadastrado";
    if (emailState === "checking") return "Aguarde a verificação do e-mail";
    if (!password) return "Informe uma senha";
    if (password.length < 6) return "A senha deve ter no mínimo 6 caracteres";
    if (password !== confirmPassword) return "As senhas não coincidem";
    if (!termsAccepted) return "Aceite os Termos de Uso para continuar";
    if (!ageConfirmed) return "Confirme que você tem 18 anos ou mais";
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
      setLoadingMsg("Criando conta...");

      // Persist invite code before sign-up so AuthContext can apply it
      // even if email confirmation is required (fires on SIGNED_IN event).
      if (inviteCode.trim()) {
        await AsyncStorage.setItem("pending_invite_code", inviteCode.trim().toUpperCase());
      } else {
        await AsyncStorage.removeItem("pending_invite_code");
      }

      // 1. Criar conta no Supabase Auth
      const { error: err } = await signUp(email, password, fullName);
      if (err) {
        setLoading(false);
        setError(err);
        return;
      }

      // Immediately clear the profile-completion flag so the layout guard
      // doesn't redirect this email/password sign-up to the social-complete screen
      // before the profile upsert below (step 4) finishes.
      clearProfileCompletion();

      // 2. Obter o usuário recém-criado
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (currentUser) {
        // 3. Upload da foto de perfil (se escolhida)
        let avatarUrl: string | null = null;
        if (avatarUri) {
          setLoadingMsg("Enviando foto de perfil...");
          const result = await uploadAvatarToStorage(currentUser.id, avatarUri);
          avatarUrl = result.url;
          if (result.error) {
            Alert.alert("Aviso", `Foto não foi salva: ${result.error}. Você pode adicionar depois no perfil.`);
          }
        }

        // 4. Salvar todos os campos do formulário no perfil
        setLoadingMsg("Finalizando perfil...");
        const phoneWithDDI = phone.trim()
          ? `${selectedCountry.ddi}${phone.trim().replace(/\D/g, "")}`
          : null;

        const { error: upsertError } = await supabase.from("profiles").upsert({
          id:                 currentUser.id,
          full_name:          fullName.trim(),
          username:           username.toLowerCase().trim(),
          phone:              phoneWithDDI,
          areas_of_expertise: selectedAreas,
          bio:                bio.trim() || null,
          company:            company.trim() || null,
          position:           role.trim() || null,
          certifications:     certifications.length > 0 ? certifications : [],
          // Always start as gratuito — paid plans are activated via Stripe
          // after the user completes payment in the subscription screen.
          plan:               "gratuito",
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        }, { onConflict: "id" });

        if (upsertError) {
          setLoading(false);
          setError(`Erro ao salvar perfil: ${upsertError.message}`);
          return;
        }

        // Atribuir código de convite determinístico ao novo usuário
        await ensureReferralCode(currentUser.id);

        // Apply invite code if provided
        if (inviteCode.trim()) {
          await applyReferralCode(currentUser.id, inviteCode.trim());
        }

        // Reload profile so avatar appears immediately in header/tabs
        await refreshProfileByUserId(currentUser.id);

        setLoading(false);

        // Paid plans must go through Stripe — redirect to subscription page
        // so the user can complete payment and activate the plan.
        if (selectedPlan !== "gratuito") {
          router.replace("/subscription" as any);
        } else {
          router.replace("/(tabs)" as any);
        }
        return;
      }

      setLoading(false);
      router.replace("/(tabs)" as any);
    }
  };

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <View style={styles.root}>
      <View style={[styles.headerBar, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#f5f0e8" />
        </TouchableOpacity>
        <Image
          source={require("@/assets/images/logo_light.png")}
          style={{ width: 90, height: 36 }}
          contentFit="contain"
        />
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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

              <FormField icon="user" value={fullName} onChangeText={setFullName} placeholder="Nome completo" />

              <View>
                <View style={styles.fieldWrap}>
                  <Feather name="at-sign" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Username"
                    placeholderTextColor="#8fa3b8"
                    value={username}
                    onChangeText={onUsernameChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <ValidationIcon state={usernameState} />
                </View>
                {validationHint("username", usernameState) && (
                  <Text style={[
                    styles.fieldHint,
                    usernameState === "available" ? styles.hintSuccess : styles.hintError,
                  ]}>
                    {validationHint("username", usernameState)}
                  </Text>
                )}
              </View>

              <View>
                <View style={styles.fieldWrap}>
                  <Feather name="mail" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="E-mail"
                    placeholderTextColor="#8fa3b8"
                    value={email}
                    onChangeText={onEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <ValidationIcon state={emailState} />
                </View>
                {validationHint("email", emailState) && (
                  <Text style={[
                    styles.fieldHint,
                    emailState === "available" ? styles.hintSuccess : styles.hintError,
                  ]}>
                    {validationHint("email", emailState)}
                  </Text>
                )}
              </View>

              <View style={styles.phoneRow}>
                <TouchableOpacity
                  style={styles.countryBtn}
                  onPress={() => { setCountrySearch(""); setShowCountryPicker(true); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryDdi}>{selectedCountry.ddi}</Text>
                  <Feather name="chevron-down" size={14} color="#8fa3b8" />
                </TouchableOpacity>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={selectedCountry.placeholder}
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

              {/* Optional invite code */}
              <View style={styles.fieldWrap}>
                <Feather name="gift" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Código de convite (opcional)"
                  placeholderTextColor="#8fa3b8"
                  value={inviteCode}
                  onChangeText={v => setInviteCode(v.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.termsRow}>
                <TouchableOpacity
                  onPress={() => setTermsAccepted((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, termsAccepted && styles.checkboxActive]}>
                    {termsAccepted && <Feather name="check" size={12} color="#0d1b2a" />}
                  </View>
                </TouchableOpacity>
                <Text style={styles.termsText} onPress={() => setTermsAccepted((v) => !v)}>
                  Li e concordo com os{" "}
                  <Text style={styles.termsLink} onPress={() => router.push("/terms-of-use")}>Termos de Uso</Text>
                  {" "}e a{" "}
                  <Text style={styles.termsLink} onPress={() => router.push("/privacy-policy")}>Política de Privacidade</Text>
                </Text>
              </View>

              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAgeConfirmed((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, ageConfirmed && styles.checkboxActive]}>
                  {ageConfirmed && <Feather name="check" size={12} color="#0d1b2a" />}
                </View>
                <Text style={styles.termsText}>
                  Confirmo que tenho{" "}
                  <Text style={{ fontWeight: "700", color: "#c9a84c" }}>18 anos ou mais</Text>
                  {" "}e estou ciente de que o ibhub é uma plataforma para profissionais do setor vitivinícola.
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Perfil profissional</Text>
              <Text style={styles.stepSubtitle}>
                Selecione suas áreas para networking qualificado (máx. 3)
              </Text>
              <View style={styles.areasGrid}>
                {AREAS.map((area) => (
                  <TouchableOpacity
                    key={area}
                    style={[styles.areaChip, selectedAreas.includes(area) && styles.areaChipActive]}
                    onPress={() => toggleArea(area)}
                  >
                    <Text style={[styles.areaChipText, selectedAreas.includes(area) && styles.areaChipTextActive]}>
                      {area}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FormField icon={undefined} value={company} onChangeText={setCompany} placeholder="Empresa (opcional)" />
              <FormField icon={undefined} value={role} onChangeText={setRole} placeholder="Cargo (opcional)" />

              {/* Bio */}
              <View style={styles.bioWrap}>
                <View style={styles.fieldWrap}>
                  <Feather name="file-text" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                  <TextInput
                    style={[styles.textInput, { flex: 1, height: 80, textAlignVertical: "top", paddingTop: 10 }]}
                    placeholder="Bio — fale sobre você (opcional)"
                    placeholderTextColor="#8fa3b8"
                    value={bio}
                    onChangeText={(v) => { if (v.length <= 200) setBio(v); }}
                    multiline
                    maxLength={200}
                  />
                </View>
                <Text style={styles.bioCount}>{bio.length}/200</Text>
              </View>

              {/* Certificações */}
              <View style={{ gap: 8 }}>
                <Text style={styles.certLabel}>Certificações (opcional)</Text>
                <View style={styles.certInputRow}>
                  <View style={[styles.fieldWrap, { flex: 1 }]}>
                    <Feather name="award" size={16} color="#8fa3b8" style={styles.fieldIcon} />
                    <TextInput
                      ref={certInputRef}
                      style={styles.textInput}
                      placeholder="Ex: WSET Level 3"
                      placeholderTextColor="#8fa3b8"
                      value={certInput}
                      onChangeText={setCertInput}
                      onSubmitEditing={addCertification}
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>
                  <TouchableOpacity style={styles.certAddBtn} onPress={addCertification} activeOpacity={0.75}>
                    <Feather name="plus" size={18} color="#0d1b2a" />
                  </TouchableOpacity>
                </View>
                {/* Chips rendered BELOW the input so they appear in viewport even with keyboard open */}
                {certifications.length > 0 && (
                  <View style={styles.certChips}>
                    {certifications.map((cert) => (
                      <View key={cert} style={styles.certChipItem}>
                        <Text style={styles.certChipLabel} numberOfLines={1}>{cert}</Text>
                        <TouchableOpacity
                          onPress={() => removeCertification(cert)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel={`Remover ${cert}`}
                        >
                          <Feather name="x" size={13} color="#8fa3b8" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Invista na sua carreira</Text>
              <Text style={styles.stepSubtitle}>
                Escolha um plano para desbloquear o ibhub completo
              </Text>

              {plansLoading ? (
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <ActivityIndicator color="#c9a84c" />
                  <Text style={{ color: "#8fa3b8", fontSize: 13, marginTop: 8 }}>Carregando planos...</Text>
                </View>
              ) : (
                <View style={styles.plansContainer}>
                  {paidPlans.map((plan, idx) => {
                    const isSelected    = selectedPlan === plan.id;
                    const isPopular     = idx === 0;
                    const price         = formatPlanPrice(plan);
                    const originalPrice = formatOriginalPrice(plan);
                    const discount      = calcDiscount(plan);
                    const generalFeats  = plan.features.filter(f => !f.startsWith("mercado:"));

                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={[styles.planCard, isSelected && styles.planCardActive]}
                        onPress={() => setSelectedPlan(plan.id)}
                        activeOpacity={0.8}
                      >
                        {isPopular && !isSelected && (
                          <View style={styles.popularBadge}>
                            <Text style={styles.popularBadgeText}>MAIS POPULAR</Text>
                          </View>
                        )}
                        {isSelected && (
                          <View style={[styles.popularBadge, { backgroundColor: "#c9a84c" }]}>
                            <Text style={styles.popularBadgeText}>✓ SELECIONADO</Text>
                          </View>
                        )}
                        <View style={styles.planHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.planName}>{plan.name}</Text>
                            <Text style={styles.planSubtitle2}>{plan.subtitle}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            {originalPrice && (
                              <Text style={{ fontSize: 11, color: "#8fa3b8", textDecorationLine: "line-through" }}>
                                De: {originalPrice}
                              </Text>
                            )}
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                              <Text style={styles.planPrice}>{price.main}</Text>
                              {discount && (
                                <View style={{ backgroundColor: "#d1fae5", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 }}>
                                  <Text style={{ fontSize: 9, fontWeight: "800", color: "#065f46" }}>-{discount}%</Text>
                                </View>
                              )}
                            </View>
                            {price.period && <Text style={{ color: "#8fa3b8", fontSize: 11 }}>{price.period}</Text>}
                          </View>
                        </View>
                        {plan.description && (
                          <Text style={{ fontSize: 12, color: "#8fa3b8", fontStyle: "italic", marginBottom: 6, lineHeight: 17 }}>
                            {plan.description}
                          </Text>
                        )}
                        {generalFeats.length > 0 && (
                          <View style={styles.planFeatures}>
                            {generalFeats.map((feat) => (
                              <View key={feat} style={styles.planFeatureRow}>
                                <Feather name="check" size={13} color="#c9a84c" />
                                <Text style={styles.planFeatureText}>{feat}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {selectedPlan !== "gratuito" && (
                <View style={styles.paymentNotice}>
                  <Feather name="credit-card" size={14} color="#c9a84c" />
                  <Text style={styles.paymentNoticeText}>
                    Após criar sua conta, você será direcionado para concluir o pagamento e ativar o plano selecionado.
                  </Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.continueBtn, loading && { opacity: 0.7 }]}
            onPress={nextStep}
            disabled={loading}
          >
            {loading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color="#0d1b2a" />
                <Text style={[styles.continueBtnText, { fontSize: 14 }]}>{loadingMsg}</Text>
              </View>
            ) : (
              <Text style={styles.continueBtnText}>
                {step === TOTAL_STEPS
                  ? (selectedPlan !== "gratuito" ? "Criar conta e ir para pagamento  →" : "Finalizar cadastro")
                  : "Continuar  →"
                }
              </Text>
            )}
          </TouchableOpacity>

          {/* Discreet free plan option — bottom of step 3 */}
          {step === TOTAL_STEPS && (
            <TouchableOpacity
              style={{ paddingVertical: 14, alignItems: "center" }}
              onPress={() => { setSelectedPlan("gratuito"); nextStep(); }}
              disabled={loading}
            >
              <Text style={{ color: "#8fa3b8", fontSize: 13, textDecorationLine: "underline" }}>
                {freePlan
                  ? `Continuar com o plano ${freePlan.name} (grátis)`
                  : "Continuar gratuitamente"
                }
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showCountryPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Selecionar país</Text>
            <TouchableOpacity onPress={() => setShowCountryPicker(false)} style={styles.pickerClose}>
              <Feather name="x" size={22} color="#f5f0e8" />
            </TouchableOpacity>
          </View>

          <View style={styles.pickerSearch}>
            <Feather name="search" size={16} color="#8fa3b8" />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Buscar país ou código..."
              placeholderTextColor="#8fa3b8"
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoFocus
            />
            {countrySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCountrySearch("")}>
                <Feather name="x" size={16} color="#8fa3b8" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.ddi + item.name}
            renderItem={({ item }) => {
              const isSelected = item.name === selectedCountry.name;
              return (
                <TouchableOpacity
                  style={[styles.pickerRow, isSelected && styles.pickerRowActive]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setPhone("");
                    setShowCountryPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerFlag}>{item.flag}</Text>
                  <Text style={styles.pickerCountryName}>{item.name}</Text>
                  <Text style={styles.pickerDdi}>{item.ddi}</Text>
                  {isSelected && <Feather name="check" size={18} color="#c9a84c" />}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
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
        style={[styles.textInput, !icon && { paddingLeft: 2 }]}
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
  root: { flex: 1, backgroundColor: "#0d1b2a" },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: { width: 32, height: 32, justifyContent: "center" },
  headerTitle: { color: "#f5f0e8", fontSize: 17, fontWeight: "700" },
  progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 20, marginBottom: 4 },
  progressBar: { flex: 1, height: 3, borderRadius: 2 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  errorBox: { backgroundColor: "rgba(231,76,60,0.15)", padding: 12, borderRadius: 10 },
  errorText: { color: "#e74c3c", fontSize: 13 },
  stepContainer: { gap: 14 },
  stepTitle: { color: "#f5f0e8", fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  stepSubtitle: { color: "#8fa3b8", fontSize: 14, lineHeight: 20, marginTop: -6 },
  avatarPicker: { alignSelf: "center", position: "relative", marginBottom: 4 },
  avatarPlaceholder: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarEditBadge: {
    position: "absolute", bottom: 2, right: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#c9a84c",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#0d1b2a",
  },
  fieldWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14, minHeight: 52,
  },
  fieldIcon: { marginRight: 10 },
  textInput: {
    flex: 1, color: "#f5f0e8", fontSize: 15,
    paddingVertical: Platform.OS === "android" ? 14 : 0,
  },
  fieldHint: { fontSize: 12, marginTop: 5, marginLeft: 4 },
  hintSuccess: { color: "#2ecc71" },
  hintError: { color: "#e74c3c" },
  phoneRow: { flexDirection: "row", gap: 10 },
  countryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12, paddingVertical: 14, minHeight: 52,
  },
  countryFlag: { fontSize: 22 },
  countryDdi: { color: "#f5f0e8", fontSize: 14, fontWeight: "600" },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 4 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center", justifyContent: "center",
    marginTop: 1, flexShrink: 0,
  },
  checkboxActive: { backgroundColor: "#c9a84c", borderColor: "#c9a84c" },
  termsText: { color: "#8fa3b8", fontSize: 13, lineHeight: 19, flex: 1 },
  termsLink: { color: "#c9a84c", fontWeight: "600" },
  areasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  areaChip: {
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 8, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  areaChipActive: { borderColor: "#c9a84c", backgroundColor: "rgba(201,168,76,0.12)" },
  areaChipText: { color: "#8fa3b8", fontSize: 14, fontWeight: "500" },
  areaChipTextActive: { color: "#c9a84c", fontWeight: "700" },
  plansContainer: { gap: 12 },
  planCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18, gap: 14, position: "relative",
  },
  planCardActive: { borderColor: "#c9a84c", backgroundColor: "rgba(201,168,76,0.06)" },
  popularBadge: {
    position: "absolute", top: -1, right: 14,
    backgroundColor: "#c9a84c",
    paddingHorizontal: 10, paddingVertical: 4,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
  },
  popularBadgeText: { color: "#0d1b2a", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planName: { color: "#f5f0e8", fontSize: 18, fontWeight: "800" },
  planSubtitle2: { color: "#8fa3b8", fontSize: 12, marginTop: 2 },
  planPrice: { color: "#f5f0e8", fontSize: 16, fontWeight: "800" },
  planFeatures: { gap: 8 },
  planFeatureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  planFeatureText: { color: "#c9d4de", fontSize: 14 },
  continueBtn: {
    backgroundColor: "#c9a84c", borderRadius: 10,
    paddingVertical: 17, alignItems: "center", marginTop: 8,
  },
  continueBtnText: { color: "#0d1b2a", fontSize: 16, fontWeight: "800" },
  pickerModal: { flex: 1, backgroundColor: "#0d1b2a" },
  pickerHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingTop: Platform.OS === "android" ? 20 : 24,
    paddingHorizontal: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)",
    position: "relative",
  },
  pickerTitle: { color: "#f5f0e8", fontSize: 17, fontWeight: "700" },
  pickerClose: {
    position: "absolute", right: 20,
    top: Platform.OS === "android" ? 18 : 22, padding: 4,
  },
  pickerSearch: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 16, backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14, paddingVertical: 11,
  },
  pickerSearchInput: { flex: 1, color: "#f5f0e8", fontSize: 15 },
  pickerRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 15, gap: 14,
  },
  pickerRowActive: { backgroundColor: "rgba(201,168,76,0.08)" },
  pickerFlag: { fontSize: 26 },
  pickerCountryName: { flex: 1, color: "#f5f0e8", fontSize: 15, fontWeight: "500" },
  pickerDdi: { color: "#8fa3b8", fontSize: 14, fontWeight: "600", marginRight: 4 },
  pickerSeparator: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: 20 },
  paymentNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "rgba(201,168,76,0.1)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(201,168,76,0.25)",
    padding: 12, marginTop: 4,
  },
  paymentNoticeText: { flex: 1, color: "#c9a84c", fontSize: 13, lineHeight: 18 },
  bioWrap: { gap: 4 },
  bioCount: { color: "#8fa3b8", fontSize: 11, textAlign: "right", marginTop: 2 },
  certLabel: { color: "#8fa3b8", fontSize: 13, fontWeight: "600", marginBottom: 0 },
  certChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  certChipItem: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(201,168,76,0.1)", borderWidth: 1,
    borderColor: "rgba(201,168,76,0.3)", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  certChipLabel: { color: "#c9a84c", fontSize: 13, fontWeight: "600" },
  certInputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  certAddBtn: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: "#c9a84c",
    alignItems: "center", justifyContent: "center",
  },
});
