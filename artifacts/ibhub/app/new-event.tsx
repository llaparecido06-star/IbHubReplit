import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { createEvent } from "@/services/api";

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
  const { user, profile } = useAuth();

  const isEmpresa = profile?.profile_type === "empresa";

  const [step, setStep] = useState(1);

  // Step 1 fields
  const [title, setTitle]       = useState("");
  const [desc, setDesc]         = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate]   = useState("");
  const [endTime, setEndTime]   = useState("");
  const [localType, setLocalType] = useState<LocalType>("presencial");
  const [address, setAddress]   = useState("");

  // Step 2 fields
  const [entryType, setEntryType] = useState<EntryType>("gratuito");
  const [capacity, setCapacity]   = useState("");
  const [payLink, setPayLink]     = useState("");

  // Step 3 fields
  const [visibility, setVisibility] = useState<Visibility>("publico");

  const [creating, setCreating] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const canNext1 = title.trim().length > 0 && startDate.length > 0 && startTime.length > 0;
  const canNext2 = true;

  const handleNext = () => {
    if (step === 1 && !canNext1) { Alert.alert("Atenção", "Preencha título, data e hora de início."); return; }
    setStep((s) => s + 1);
  };
  const handleBack = () => {
    if (step === 1) router.back();
    else setStep((s) => s - 1);
  };

  const handleCreate = async () => {
    if (!user?.id) { Alert.alert("Erro", "Você precisa estar logado."); return; }
    const startIso = parseDateTime(startDate, startTime);
    if (!startIso) { Alert.alert("Data inválida", "Use o formato DD/MM/AAAA para a data e HH:MM para o horário."); return; }
    const endIso = endDate && endTime ? parseDateTime(endDate, endTime) : null;
    const cap = capacity ? parseInt(capacity, 10) : null;
    setCreating(true);
    const result = await createEvent({
      user_id: user.id,
      title: title.trim(),
      description: desc.trim() || null,
      start_date: startIso,
      end_date: endIso,
      location_type: localType,
      location: localType === "presencial" ? (address.trim() || null) : null,
      entry_type: entryType,
      capacity: cap && !isNaN(cap) ? cap : null,
      visibility,
      pay_link: entryType !== "gratuito" ? (payLink.trim() || null) : null,
    });
    setCreating(false);
    if (result) {
      Alert.alert("Evento criado!", `"${title}" está visível na aba Oportunidades > Eventos.`, [
        { text: "OK", onPress: () => router.replace(`/event/${result.id}` as any) },
      ]);
    } else {
      Alert.alert("Erro", "Não foi possível criar o evento. Verifique os dados e tente novamente.");
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

  if (!isEmpresa) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 32 }]}>
        <View style={{ paddingTop: topPad }}>
          <Feather name="lock" size={52} color={colors.gold} style={{ alignSelf: "center", marginBottom: 20 }} />
          <Text style={[{ fontSize: 22, fontWeight: "800", color: colors.navy, textAlign: "center", marginBottom: 12 }]}>
            Exclusivo para Empresas
          </Text>
          <Text style={[{ fontSize: 15, color: colors.mutedForeground, textAlign: "center", lineHeight: 22, marginBottom: 28 }]}>
            Somente empresas podem criar e promover eventos no ibhub. Crie sua página de empresa para ter acesso completo.
          </Text>
          <TouchableOpacity
            style={[{ backgroundColor: colors.gold, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24, alignItems: "center", marginBottom: 12 }]}
            onPress={() => router.replace("/manage-business-page" as any)}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Criar página de empresa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[{ borderRadius: 12, paddingVertical: 14, alignItems: "center" }]}
            onPress={() => router.back()}
          >
            <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backRow}>
          <Feather name="arrow-left" size={20} color={colors.navy} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Novo Evento</Text>
          <Text style={[styles.headerStep, { color: colors.mutedForeground }]}>Etapa {step} de 3</Text>
        </View>
        {step < 3 ? (
          <TouchableOpacity onPress={handleNext} style={styles.nextRow}>
            <Text style={[styles.nextText, { color: colors.gold }]}>Próximo</Text>
            <Feather name="arrow-right" size={16} color={colors.gold} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.gold }]}
            onPress={handleCreate}
            disabled={creating}
          >
            <Text style={styles.createBtnText}>{creating ? "..." : "Criar"}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ProgressBar />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, rowGap: 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step 1 ── */}
        {step === 1 && <>
          {/* Cover image */}
          <TouchableOpacity
            style={[styles.coverPicker, { backgroundColor: "#fff", borderColor: colors.border }]}
            onPress={() => Alert.alert("Em breve", "Upload de imagem em desenvolvimento.")}
          >
            <Feather name="image" size={32} color={colors.border} />
            <Text style={[styles.coverPickerText, { color: colors.mutedForeground }]}>
              Toque para adicionar capa
            </Text>
          </TouchableOpacity>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Título *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder='"Masterclass Pinot Noir"'
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Detalhes do evento..."
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
              <Text style={[styles.label, { color: colors.navy }]}>Data início *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="dd/mm/aaaa"
                placeholderTextColor={colors.mutedForeground}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.navy }]}>Hora início *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="--:--"
                placeholderTextColor={colors.mutedForeground}
                value={startTime}
                onChangeText={setStartTime}
              />
            </View>
          </View>

          <View style={styles.row2}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.navy }]}>Data fim</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="dd/mm/aaaa"
                placeholderTextColor={colors.mutedForeground}
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.navy }]}>Hora fim</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="--:--"
                placeholderTextColor={colors.mutedForeground}
                value={endTime}
                onChangeText={setEndTime}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Local</Text>
            <View style={[styles.toggle, { backgroundColor: colors.background }]}>
              {(["presencial", "online"] as LocalType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.toggleBtn, { backgroundColor: localType === t ? colors.gold : "transparent" }]}
                  onPress={() => setLocalType(t)}
                >
                  <Feather
                    name={t === "presencial" ? "map-pin" : "link"}
                    size={14}
                    color={localType === t ? "#fff" : colors.mutedForeground}
                  />
                  <Text style={[styles.toggleText, { color: localType === t ? "#fff" : colors.mutedForeground }]}>
                    {t === "presencial" ? "Presencial" : "Online"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {localType === "presencial" && (
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.navy }]}>Endereço completo</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="Rua, número, cidade..."
                placeholderTextColor={colors.mutedForeground}
                value={address}
                onChangeText={setAddress}
              />
            </View>
          )}
        </>}

        {/* ── Step 2 ── */}
        {step === 2 && <>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Tipo de Entrada</Text>
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
              <Text style={[styles.label, { color: colors.navy }]}>Link de venda</Text>
              <TextInput
                style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="https://..."
                placeholderTextColor={colors.mutedForeground}
                value={payLink}
                onChangeText={setPayLink}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Capacidade máxima</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Deixe vazio para ilimitado"
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
            <Text style={[styles.label, { color: colors.navy }]}>Quem pode ver este evento?</Text>
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
  backRow:     { padding: 4 },
  headerCenter:{ alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerStep:  { fontSize: 12, marginTop: 2 },
  nextRow:     { flexDirection: "row", alignItems: "center", gap: 4 },
  nextText:    { fontSize: 15, fontWeight: "600" },
  createBtn:   { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  createBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  progressBar: { flexDirection: "row", gap: 4, paddingHorizontal: 16, paddingVertical: 8 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  coverPicker: {
    borderWidth: 2, borderStyle: "dashed", borderRadius: 12,
    aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center", gap: 8,
  },
  coverPickerText: { fontSize: 13 },
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
});
