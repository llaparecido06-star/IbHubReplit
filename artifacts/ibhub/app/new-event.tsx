import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { createEvent, uploadEventImage } from "@/services/api";
import { maskDate, maskTime } from "@/utils/masks";
import { useTranslation } from "react-i18next";

const AREAS = [
  "Sommelier", "Comprador", "Importador", "Produtor",
  "Enólogo", "Consultor", "Investidor", "Entusiasta", "Outros",
];

function parseDateTime(date: string, time: string): string | null {
  const parts = date.split("/");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  if (!day || !month || !year || year.length !== 4) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${time}:00`;
}

type EntryType   = "gratuito" | "pago-externo" | "pago-integrado";
type Visibility  = "publico" | "restrito" | "privado";
type LocalType   = "presencial" | "online";

export default function NewEventScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, activeCompany } = useAuth();
  const { t } = useTranslation();

  const [step, setStep] = useState(1);

  // Step 1 fields
  const [coverUri, setCoverUri]       = useState<string | null>(null);
  const [title, setTitle]             = useState("");
  const [desc, setDesc]               = useState("");
  const [startDate, setStartDate]     = useState("");
  const [startTime, setStartTime]     = useState("");
  const [endDate, setEndDate]         = useState("");
  const [endTime, setEndTime]         = useState("");
  const [localType, setLocalType]     = useState<LocalType>("presencial");
  const [address, setAddress]         = useState("");
  const [onlineLink, setOnlineLink]   = useState("");

  // Step 2 fields
  const [entryType, setEntryType]     = useState<EntryType>("gratuito");
  const [capacity, setCapacity]       = useState("");
  const [payLink, setPayLink]         = useState("");

  // Step 3 fields
  const [visibility, setVisibility]           = useState<Visibility>("publico");
  const [restrictedPositions, setRestrictedPositions] = useState<string[]>([]);

  const [creating, setCreating] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const canNext1 = title.trim().length > 0 && startDate.length > 0 && startTime.length > 0;

  const handleNext = () => {
    if (step === 1 && !canNext1) { Alert.alert(t("common.attention"), t("event.errors.fill_required")); return; }
    setStep((s) => s + 1);
  };
  const handleBack = () => {
    if (step === 1) router.back();
    else setStep((s) => s - 1);
  };

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

  const toggleRestrictedPosition = (area: string) => {
    setRestrictedPositions((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleCreate = async () => {
    if (!user?.id) { Alert.alert(t("common.error"), t("event.errors.not_logged")); return; }
    const startIso = parseDateTime(startDate, startTime);
    if (!startIso) { Alert.alert(t("event.errors.invalid_date"), t("event.errors.invalid_date")); return; }
    const endIso = endDate && endTime ? parseDateTime(endDate, endTime) : null;
    const cap = capacity ? parseInt(capacity, 10) : null;
    setCreating(true);

    let imageUrl: string | null = null;
    if (coverUri) {
      imageUrl = await uploadEventImage(coverUri, user.id);
    }

    if (visibility === "restrito" && restrictedPositions.length === 0) {
      setCreating(false);
      Alert.alert("Atenção", "Selecione ao menos um cargo permitido para eventos restritos, ou escolha outra visibilidade.");
      return;
    }

    const result = await createEvent({
      user_id: user.id,
      title: title.trim(),
      description: desc.trim() || null,
      start_date: startIso,
      end_date: endIso,
      location_type: localType,
      location: localType === "presencial" ? (address.trim() || null) : null,
      link: localType === "online" ? (onlineLink.trim() || null) : null,
      image_url: imageUrl,
      entry_type: entryType,
      capacity: cap && !isNaN(cap) ? cap : null,
      visibility,
      restricted_positions: visibility === "restrito" ? restrictedPositions : null,
      pay_link: entryType !== "gratuito" ? (payLink.trim() || null) : null,
      company_page_id: activeCompany?.id ?? null,
    });
    setCreating(false);
    if (result) {
      Alert.alert(t("event.errors.created"), `"${title}" ${t("event.errors.created_msg")}`, [
        { text: t("event.errors.ok"), onPress: () => router.replace(`/event/${result.id}` as any) },
      ]);
    } else {
      Alert.alert(t("common.error"), t("event.errors.error_create"));
    }
  };

  const ProgressBar = () => (
    <View style={styles.progressBar}>
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={[
            styles.progressSegment,
            { backgroundColor: s <= step ? colors.gold : colors.border },
          ]}
        />
      ))}
    </View>
  );

  const kavBehavior = Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined;

  if (!activeCompany) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32 }]}>
        <View style={{ paddingTop: topPad }}>
          <Feather name="lock" size={52} color={colors.gold} style={{ alignSelf: "center", marginBottom: 20 }} />
          <Text style={[{ fontSize: 22, fontWeight: "800", color: colors.navy, textAlign: "center", marginBottom: 12 }]}>
            {t("event.exclusive.title")}
          </Text>
          <Text style={[{ fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 22, marginBottom: 28 }]}>
            {t("event.exclusive.msg")}
          </Text>
          <TouchableOpacity
            style={[{ backgroundColor: colors.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", marginBottom: 12 }]}
            onPress={() => router.replace("/manage-business-page" as any)}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("event.exclusive.create_company")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[{ borderRadius: 12, paddingVertical: 14, alignItems: "center" }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>{t("event.exclusive.back")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={kavBehavior}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backRow}>
          <Feather name="arrow-left" size={20} color={colors.navy} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("event.screen_title")}</Text>
          <Text style={[styles.headerStep, { color: colors.mutedForeground }]}>{t("event.step")} {step} {t("event.of")} 3</Text>
        </View>
        {step < 3 ? (
          <TouchableOpacity onPress={handleNext} style={styles.nextRow}>
            <Text style={[styles.nextText, { color: colors.gold }]}>{t("event.next")}</Text>
            <Feather name="arrow-right" size={16} color={colors.gold} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.gold }]}
            onPress={handleCreate}
            disabled={creating}
          >
            <Text style={styles.createBtnText}>{creating ? t("event.creating") : t("event.create")}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ProgressBar />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 1 ── */}
        {step === 1 && <>
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
                <Feather name="image" size={32} color={colors.border} />
                <Text style={[styles.coverPickerText, { color: colors.mutedForeground }]}>
                  {t("event.cover_tap")}
                </Text>
              </>
            )}
            {coverUri ? (
              <View style={[styles.coverOverlay]}>
                <Feather name="edit-2" size={16} color="#fff" />
              </View>
            ) : null}
          </TouchableOpacity>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.title")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("event.fields.title_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.description")}</Text>
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("event.fields.description_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              value={desc}
              onChangeText={setDesc}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.row2}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.start_date")}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder={t("common.date_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                value={startDate}
                onChangeText={(v) => setStartDate(maskDate(v))}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.start_time")}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder={t("common.time_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                value={startTime}
                onChangeText={(v) => setStartTime(maskTime(v))}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.end_date")}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder={t("common.date_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                value={endDate}
                onChangeText={(v) => setEndDate(maskDate(v))}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.end_time")}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder={t("common.time_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                value={endTime}
                onChangeText={(v) => setEndTime(maskTime(v))}
                keyboardType="numeric"
                maxLength={5}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.local")}</Text>
            <View style={[styles.toggle, { backgroundColor: colors.background }]}>
              {(["presencial", "online"] as LocalType[]).map((tp) => (
                <TouchableOpacity
                  key={tp}
                  style={[styles.toggleBtn, { backgroundColor: localType === tp ? colors.gold : "transparent" }]}
                  onPress={() => setLocalType(tp)}
                >
                  <Feather
                    name={tp === "presencial" ? "map-pin" : "link"}
                    size={14}
                    color={localType === tp ? "#fff" : colors.mutedForeground}
                  />
                  <Text style={[styles.toggleText, { color: localType === tp ? "#fff" : colors.mutedForeground }]}>
                    {tp === "presencial" ? t("event.fields.presential") : t("event.fields.online")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {localType === "presencial" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.address")}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder={t("event.fields.address_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                value={address}
                onChangeText={setAddress}
              />
            </View>
          )}

          {localType === "online" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.navy }]}>Link do evento (Zoom, Meet...)</Text>
              <Text style={[{ fontSize: 12, color: colors.mutedForeground, marginTop: -4 }]}>
                Visível apenas para participantes confirmados
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="https://meet.google.com/..."
                placeholderTextColor={colors.mutedForeground}
                value={onlineLink}
                onChangeText={setOnlineLink}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          )}
        </>}

        {/* ── Step 2 ── */}
        {step === 2 && <>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.entry_type")}</Text>
            <View style={{ gap: 10 }}>
              {([
                { key: "gratuito",        label: "Gratuito",            desc: "Sem custo para participar",          disabled: false },
                { key: "pago-externo",    label: "Pago - Link Externo", desc: "Redireciona para plataforma de venda", disabled: false },
                { key: "pago-integrado",  label: "Pago - Integrado",    desc: "Venda direta (em breve)",             disabled: true },
              ] as { key: EntryType; label: string; desc: string; disabled: boolean }[]).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.entryOption,
                    {
                      backgroundColor: "#fff",
                      borderColor: entryType === opt.key ? colors.gold : colors.border,
                      borderWidth: entryType === opt.key ? 2 : 1,
                      opacity: opt.disabled ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => !opt.disabled && setEntryType(opt.key)}
                  disabled={opt.disabled}
                >
                  <View>
                    <Text style={[styles.entryLabel, { color: colors.navy }]}>{opt.label}</Text>
                    <Text style={[styles.entryDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {entryType === "pago-externo" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.pay_link")}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder={t("event.fields.pay_link_placeholder")}
                placeholderTextColor={colors.mutedForeground}
                value={payLink}
                onChangeText={setPayLink}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.capacity")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder={t("event.fields.capacity_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
            />
          </View>
        </>}

        {/* ── Step 3 ── */}
        {step === 3 && <>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>{t("event.fields.visibility")}</Text>
            <View style={{ gap: 10 }}>
              {([
                { key: "publico",   label: "Público",            desc: "Visível para toda a rede e indexável na busca",      dot: "#22c55e", icon: "eye" },
                { key: "restrito",  label: "Restrito por Cargo",  desc: "Visível apenas para profissionais selecionados",     dot: "#f59e0b", icon: "users" },
                { key: "privado",   label: "Privado/Secreto",     desc: "Apenas via link direto ou convite",                  dot: "#ef4444", icon: "lock" },
              ] as { key: Visibility; label: string; desc: string; dot: string; icon: any }[]).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.visOption,
                    {
                      backgroundColor: "#fff",
                      borderColor: visibility === opt.key ? colors.gold : colors.border,
                      borderWidth: visibility === opt.key ? 2 : 1,
                    },
                  ]}
                  onPress={() => setVisibility(opt.key)}
                >
                  <Feather name={opt.icon} size={18} color={colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.visLabel, { color: colors.navy }]}>{opt.label}</Text>
                    <Text style={[styles.visDesc, { color: colors.mutedForeground }]}>{opt.desc}</Text>
                  </View>
                  <View style={[styles.visDot, { backgroundColor: opt.dot }]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {visibility === "restrito" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.navy }]}>Cargos permitidos</Text>
              <Text style={[{ fontSize: 12, color: colors.mutedForeground, marginTop: -4 }]}>
                Selecione um ou mais cargos que poderão ver este evento
              </Text>
              <View style={styles.areasGrid}>
                {AREAS.map((area) => {
                  const selected = restrictedPositions.includes(area);
                  return (
                    <TouchableOpacity
                      key={area}
                      style={[
                        styles.areaChip,
                        {
                          backgroundColor: selected ? colors.gold : "#fff",
                          borderColor: selected ? colors.gold : colors.border,
                        },
                      ]}
                      onPress={() => toggleRestrictedPosition(area)}
                    >
                      <Text style={[styles.areaChipText, { color: selected ? "#fff" : colors.mutedForeground }]}>
                        {area}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {restrictedPositions.length === 0 && (
                <Text style={[{ fontSize: 12, color: "#f59e0b", marginTop: 4 }]}>
                  Selecione ao menos um cargo ou mude para Público/Privado
                </Text>
              )}
            </View>
          )}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backRow:      { padding: 4 },
  headerCenter: { alignItems: "center" },
  headerTitle:  { fontSize: 16, fontWeight: "700" },
  headerStep:   { fontSize: 12, marginTop: 2 },
  nextRow:      { flexDirection: "row", alignItems: "center", gap: 4 },
  nextText:     { fontSize: 15, fontWeight: "600" },
  createBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  createBtnText:{ color: "#fff", fontSize: 14, fontWeight: "700" },
  progressBar:  { flexDirection: "row", gap: 4, paddingHorizontal: 16, paddingVertical: 8 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  coverPicker: {
    borderWidth: 2, borderStyle: "dashed", borderRadius: 12,
    aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  coverImage:   { width: "100%", height: "100%" },
  coverOverlay: {
    position: "absolute", bottom: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 16,
    padding: 6,
  },
  coverPickerText: { fontSize: 13, marginTop: 8 },
  field:  { gap: 8 },
  label:  { fontSize: 15, fontWeight: "700" },
  input:  { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea: { height: 110, textAlignVertical: "top" },
  row2:   { flexDirection: "row", gap: 12 },
  toggle: { flexDirection: "row", borderRadius: 10, padding: 4 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8 },
  toggleText: { fontSize: 14, fontWeight: "600" },
  entryOption: { borderRadius: 12, padding: 16 },
  entryLabel:  { fontSize: 15, fontWeight: "700" },
  entryDesc:   { fontSize: 13, marginTop: 2 },
  visOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 12, padding: 16,
  },
  visLabel: { fontSize: 15, fontWeight: "700" },
  visDesc:  { fontSize: 12, marginTop: 2 },
  visDot:   { width: 12, height: 12, borderRadius: 6 },
  areasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  areaChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  areaChipText: { fontSize: 13, fontWeight: "600" },
});
