import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionsContext";
import { PaywallScreen } from "@/components/ui/PaywallScreen";
import { createOpportunity, uploadOpportunityImage } from "@/services/api";
import { maskDate, maskCurrency, CURRENCIES, type Currency } from "@/utils/masks";
import { useTranslation } from "react-i18next";

type Mode = "marketplace" | "vaga";

const MARKET_CATS   = ["Vinho", "Insumo", "Equipamento", "Serviço", "Outros"];
const JOB_CATS      = ["Sommelier", "Enólogo", "Gerência", "Marketing", "Vendas", "Exportação", "Produção", "Outros"];
const CONTRACT_TYPES = ["CLT", "PJ", "Freelancer", "Estágio"];

export default function NewOpportunityScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, activeCompany } = useAuth();
  const { t } = useTranslation();
  const { hasFeature, isLoading: permLoading } = usePermissions();
  const isEmpresa = !!activeCompany;

  const [mode, setMode]         = useState<Mode>("vaga");
  const [title, setTitle]       = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [desc, setDesc]         = useState("");
  const [price, setPrice]       = useState("");
  const [priceCurrency, setPriceCurrency] = useState<Currency>("R$");
  const [location, setLocation] = useState("");
  const [expiry, setExpiry]     = useState("");
  const [email, setEmail]       = useState("");
  const [company, setCompany]   = useState("");
  const [salary, setSalary]     = useState("");
  const [contract, setContract] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const canPublish = title.trim().length > 0 && category !== null;

  const pickCoverImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Autorize o acesso à galeria para selecionar uma imagem.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const handlePublish = async () => {
    if (!user?.id) { Alert.alert(t("common.error"), t("opportunity.errors.not_logged")); return; }
    if (!isEmpresa) {
      Alert.alert(
        t("opportunity.errors.company_only_title"),
        t("opportunity.errors.company_only_msg"),
      );
      return;
    }
    if (!canPublish) { Alert.alert(t("common.attention"), t("opportunity.errors.fill_required")); return; }

    setPublishing(true);
    try {
      let coverImageUrl: string | null = null;
      if (coverUri && mode === "marketplace") {
        coverImageUrl = await uploadOpportunityImage(coverUri, user.id);
      }

      const companyName = isEmpresa ? activeCompany!.name : (company.trim() || null);

      const result = await createOpportunity(
        {
          created_by: user.id,
          type: mode === "vaga" ? "vaga" : "marketplace",
          title: title.trim(),
          description: desc.trim() || null,
          category,
          location: location.trim() || null,
          price: mode === "marketplace" ? (price.trim() ? `${priceCurrency} ${price.trim()}` : null) : null,
          cover_image_url: coverImageUrl,
          company: mode === "vaga" ? (companyName ?? null) : null,
          company_page_id: activeCompany?.id ?? null,
          contract_type: mode === "vaga" ? (contract ?? null) : null,
          salary: mode === "vaga" ? (salary.trim() || null) : null,
          contact_email: email.trim() || null,
          expires_at: expiry.trim() ? parseExpiry(expiry) : null,
        },
        user.id,
      );

      if (result) {
        Alert.alert(
          mode === "marketplace" ? t("opportunity.errors.published_ad") : t("opportunity.errors.published_job"),
          `"${title}" ${t("opportunity.errors.published_msg")}`,
          [{ text: t("opportunity.errors.view_post"), onPress: () => router.replace(`/opportunity/${result.id}` as any) }],
        );
      } else {
        Alert.alert(t("common.error"), t("opportunity.errors.error_publish"));
      }
    } finally {
      setPublishing(false);
    }
  };

  const ChipSelector = ({
    options, selected, onSelect,
  }: { options: string[]; selected: string | null; onSelect: (v: string) => void }) => (
    <View style={styles.chipWrap}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[
            styles.chip,
            { borderColor: selected === opt ? colors.gold : colors.border,
              backgroundColor: selected === opt ? colors.gold + "18" : colors.background },
          ]}
          onPress={() => onSelect(opt)}
        >
          <Text style={[styles.chipText, { color: selected === opt ? colors.gold : colors.foreground, fontWeight: selected === opt ? "700" : "400" }]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const CurrencyDropdown = ({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) => (
    <View style={styles.currencyRow}>
      {CURRENCIES.map((c) => (
        <TouchableOpacity
          key={c}
          style={[
            styles.currencyBtn,
            { borderColor: value === c ? colors.gold : colors.border,
              backgroundColor: value === c ? colors.gold + "18" : colors.card },
          ]}
          onPress={() => onChange(c)}
        >
          <Text style={[styles.currencyText, { color: value === c ? colors.gold : colors.mutedForeground, fontWeight: value === c ? "700" : "400" }]}>
            {c}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const kavBehavior = Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined;

  if (permLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!hasFeature("Publicar Vagas")) {
    return (
      <PaywallScreen
        featureName="Publicar Vagas e Ofertas"
        description="Publique vagas de emprego e ofertas no marketplace do ibhub para alcançar profissionais do vinho."
        requiredPlan="Profissional"
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={kavBehavior}
    >
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>{t("opportunity.cancel")}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("opportunity.screen_title")}</Text>
        <TouchableOpacity
          style={[styles.publishBtn, { backgroundColor: canPublish && !publishing ? colors.gold : colors.border }]}
          onPress={handlePublish}
          disabled={publishing || !canPublish}
        >
          <Text style={[styles.publishBtnText, { color: canPublish && !publishing ? "#fff" : colors.mutedForeground }]}>
            {publishing ? t("opportunity.publishing") : t("opportunity.publish")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Mode toggle */}
        <View style={[styles.toggle, { backgroundColor: colors.secondary, borderRadius: 12, padding: 4 }]}>
          {(["vaga", "marketplace"] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, { backgroundColor: mode === m ? colors.gold : "transparent" }]}
              onPress={() => { setMode(m); setCategory(null); setCoverUri(null); }}
            >
              <Text style={[styles.toggleText, { color: mode === m ? "#fff" : colors.mutedForeground }]}>
                {m === "marketplace" ? t("opportunity.mode_marketplace") : t("opportunity.mode_job")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Vaga de Emprego ── */}
        {mode === "vaga" && (
          <>
            <Field label={t("opportunity.fields.job_title")} colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.job_title_placeholder")} placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
            </Field>
            <Field label={t("opportunity.fields.category")} colors={colors}>
              <ChipSelector options={JOB_CATS} selected={category} onSelect={setCategory} />
            </Field>
            <Field label={t("opportunity.fields.company")} colors={colors}>
              {isEmpresa ? (
                <View style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 8 }]}>
                  <Feather name="briefcase" size={14} color={colors.gold} />
                  <Text style={{ color: colors.navy, fontSize: 14, fontWeight: "600", flex: 1 }}>
                    {activeCompany!.name}
                  </Text>
                  <Feather name="lock" size={12} color={colors.mutedForeground} />
                </View>
              ) : (
                <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.company_placeholder")} placeholderTextColor={colors.mutedForeground} value={company} onChangeText={setCompany} />
              )}
            </Field>
            <Field label={t("opportunity.fields.contract_type")} colors={colors}>
              <ChipSelector options={CONTRACT_TYPES} selected={contract} onSelect={setContract} />
            </Field>
            <Field label={t("opportunity.fields.salary")} colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.salary_placeholder")} placeholderTextColor={colors.mutedForeground} value={salary} onChangeText={setSalary} />
            </Field>
            <Field label={t("opportunity.fields.location")} colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.location_placeholder")} placeholderTextColor={colors.mutedForeground} value={location} onChangeText={setLocation} />
            </Field>
            <Field label={t("opportunity.fields.description")} colors={colors}>
              <TextInput style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.description_placeholder_job")} placeholderTextColor={colors.mutedForeground} value={desc} onChangeText={setDesc} multiline numberOfLines={5} textAlignVertical="top" />
            </Field>
            <Field label={t("opportunity.fields.expiry")} colors={colors}>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder={t("opportunity.fields.expiry_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                value={expiry}
                onChangeText={(v) => setExpiry(maskDate(v))}
                keyboardType="numeric"
                maxLength={10}
              />
            </Field>
            <Field label={t("opportunity.fields.email")} colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.email_placeholder_job")} placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </Field>
          </>
        )}

        {/* ── Marketplace ── */}
        {mode === "marketplace" && (
          <>
            {/* Cover image picker */}
            <TouchableOpacity
              style={[styles.coverPicker, { borderColor: colors.border }]}
              onPress={pickCoverImage}
              activeOpacity={0.8}
            >
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.coverImage} resizeMode="cover" />
              ) : (
                <>
                  <Feather name="image" size={28} color={colors.border} />
                  <Text style={[styles.coverPickerText, { color: colors.mutedForeground }]}>
                    Toque para adicionar uma foto do produto
                  </Text>
                </>
              )}
              {coverUri && (
                <View style={styles.coverOverlay}>
                  <Feather name="edit-2" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <Field label={t("opportunity.fields.ad_title")} colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.ad_title_placeholder")} placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
            </Field>
            <Field label={t("opportunity.fields.category")} colors={colors}>
              <ChipSelector options={MARKET_CATS} selected={category} onSelect={setCategory} />
            </Field>
            <Field label={t("opportunity.fields.description")} colors={colors}>
              <TextInput style={[styles.input, styles.textarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.description_placeholder_market")} placeholderTextColor={colors.mutedForeground} value={desc} onChangeText={setDesc} multiline numberOfLines={5} textAlignVertical="top" />
            </Field>
            <Field label={t("opportunity.fields.price")} colors={colors}>
              <CurrencyDropdown value={priceCurrency} onChange={setPriceCurrency} />
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                value={price}
                onChangeText={(v) => setPrice(maskCurrency(v))}
                keyboardType="numeric"
              />
            </Field>
            <Field label={t("opportunity.fields.location")} colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.location_placeholder")} placeholderTextColor={colors.mutedForeground} value={location} onChangeText={setLocation} />
            </Field>
            <Field label={t("opportunity.fields.expiry")} colors={colors}>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                placeholder={t("opportunity.fields.expiry_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                value={expiry}
                onChangeText={(v) => setExpiry(maskDate(v))}
                keyboardType="numeric"
                maxLength={10}
              />
            </Field>
            <Field label={t("opportunity.fields.email")} colors={colors}>
              <TextInput style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]} placeholder={t("opportunity.fields.email_placeholder_market")} placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </Field>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.navy }]}>{label}</Text>
      {children}
    </View>
  );
}

function parseExpiry(str: string): string | null {
  const parts = str.split("/");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    const d = new Date(`${yyyy}-${mm}-${dd}`);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  cancelText:      { fontSize: 15 },
  headerTitle:     { fontSize: 17, fontWeight: "700" },
  publishBtn:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  publishBtnText:  { fontSize: 14, fontWeight: "700" },
  toggle:          { flexDirection: "row" },
  toggleBtn:       { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleText:      { fontSize: 14, fontWeight: "600" },
  field:           { gap: 8 },
  label:           { fontSize: 15, fontWeight: "700" },
  input:           { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea:        { height: 120, textAlignVertical: "top" },
  chipWrap:        { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:            { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText:        { fontSize: 13 },
  currencyRow:     { flexDirection: "row", gap: 8 },
  currencyBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  currencyText:    { fontSize: 13 },
  coverPicker:     { height: 160, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden" },
  coverImage:      { width: "100%", height: "100%", position: "absolute" },
  coverPickerText: { fontSize: 13, textAlign: "center" },
  coverOverlay:    { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 16, padding: 6 },
});
