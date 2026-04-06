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
import { useColors } from "@/hooks/useColors";

type Mode = "marketplace" | "vaga";

const MARKET_CATS   = ["Vinho", "Insumo", "Equipamento", "Serviço", "Outros"];
const JOB_CATS      = ["Sommelier", "Enólogo", "Gerência", "Marketing", "Vendas", "Exportação", "Produção", "Outros"];
const CONTRACT_TYPES = ["CLT", "PJ", "Freelancer", "Estágio"];

export default function NewOpportunityScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [mode, setMode]       = useState<Mode>("marketplace");
  const [title, setTitle]     = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [desc, setDesc]       = useState("");
  const [price, setPrice]     = useState("");
  const [location, setLocation] = useState("");
  const [expiry, setExpiry]   = useState("");
  const [email, setEmail]     = useState("");
  // Job-specific
  const [company, setCompany] = useState("");
  const [contract, setContract] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const canPublish = title.trim().length > 0 && category !== null;

  const handlePublish = async () => {
    if (!canPublish) { Alert.alert("Atenção", "Preencha o título e a categoria."); return; }
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 900));
    setPublishing(false);
    Alert.alert(
      mode === "marketplace" ? "Anúncio publicado!" : "Vaga publicada!",
      `"${title}" está visível na aba Oportunidades.`,
      [{ text: "OK", onPress: () => router.back() }]
    );
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
              backgroundColor: selected === opt ? colors.gold + "15" : "#fff" },
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Blurred header showing main screen behind (same pattern as reference) */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Nova Oportunidade</Text>
        <TouchableOpacity
          style={[styles.publishBtn, { backgroundColor: canPublish ? colors.gold : colors.border }]}
          onPress={handlePublish}
          disabled={publishing}
        >
          <Text style={[styles.publishBtnText, { color: canPublish ? "#fff" : colors.mutedForeground }]}>
            {publishing ? "..." : "Publicar"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode toggle */}
        <View style={[styles.toggle, { backgroundColor: colors.background }]}>
          {(["marketplace", "vaga"] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, { backgroundColor: mode === m ? colors.gold : "transparent" }]}
              onPress={() => { setMode(m); setCategory(null); }}
            >
              <Text style={[styles.toggleText, { color: mode === m ? "#fff" : colors.mutedForeground }]}>
                {m === "marketplace" ? "Marketplace" : "Vaga de Emprego"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Marketplace fields ── */}
        {mode === "marketplace" && <>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Título do anúncio *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder='Ex: Malbec Gran Reserva 2022'
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Categoria *</Text>
            <ChipSelector options={MARKET_CATS} selected={category} onSelect={setCategory} />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Descreva os detalhes..."
              placeholderTextColor={colors.mutedForeground}
              value={desc}
              onChangeText={setDesc}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Preço</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Ex: R$ 89/un"
              placeholderTextColor={colors.mutedForeground}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Localização</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Ex: São Paulo, SP"
              placeholderTextColor={colors.mutedForeground}
              value={location}
              onChangeText={setLocation}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Validade (opcional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="dd/mm/aaaa"
              placeholderTextColor={colors.mutedForeground}
              value={expiry}
              onChangeText={setExpiry}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>E-mail de contato</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="contato@empresa.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </>}

        {/* ── Vaga de Emprego fields ── */}
        {mode === "vaga" && <>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Título da vaga *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Ex: Sommelier Chefe"
              placeholderTextColor={colors.mutedForeground}
              value={title}
              onChangeText={setTitle}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Categoria *</Text>
            <ChipSelector options={JOB_CATS} selected={category} onSelect={setCategory} />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Descreva os detalhes..."
              placeholderTextColor={colors.mutedForeground}
              value={desc}
              onChangeText={setDesc}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Empresa</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Nome da empresa"
              placeholderTextColor={colors.mutedForeground}
              value={company}
              onChangeText={setCompany}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Tipo de contrato</Text>
            <ChipSelector options={CONTRACT_TYPES} selected={contract} onSelect={setContract} />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Localização</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Ex: São Paulo, SP"
              placeholderTextColor={colors.mutedForeground}
              value={location}
              onChangeText={setLocation}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>Validade (opcional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="dd/mm/aaaa"
              placeholderTextColor={colors.mutedForeground}
              value={expiry}
              onChangeText={setExpiry}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.navy }]}>E-mail de contato</Text>
            <TextInput
              style={[styles.input, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="contato@empresa.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
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
  cancelText:  { fontSize: 15 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  publishBtn:  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  publishBtnText: { fontSize: 14, fontWeight: "700" },
  toggle: { flexDirection: "row", borderRadius: 12, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  toggleText: { fontSize: 14, fontWeight: "600" },
  field: { gap: 8 },
  label: { fontSize: 15, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea: { height: 110, textAlignVertical: "top" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 13 },
});
