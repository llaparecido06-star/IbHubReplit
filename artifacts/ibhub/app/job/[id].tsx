import { useLocalSearchParams, useRouter } from "expo-router";
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

const JOBS: Record<string, {
  title: string; company: string; location: string; contract: string;
  category: string; expiresIn?: string; expired?: boolean;
  description: string; contact: string;
}> = {
  v1: {
    title: "Sommelier Sênior",
    company: "Vino & Co.",
    location: "São Paulo, SP",
    contract: "CLT",
    category: "Restaurante",
    expiresIn: "2 dias",
    description: "Buscamos sommelier experiente para restaurante de alta gastronomia.",
    contact: "vagas@vinoco.com.br",
  },
  v2: {
    title: "Representante Comercial de Vinhos",
    company: "Importadora Grand Cru",
    location: "Rio de Janeiro, RJ",
    contract: "PJ",
    category: "Vendas",
    expired: true,
    description: "Representante comercial para carteira de clientes no RJ. Experiência em vinhos importados.",
    contact: "rh@grandcru.com.br",
  },
};

export default function JobScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState("");
  const [applying, setApplying] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const job = JOBS[id] ?? JOBS.v1;

  const handleApply = async () => {
    setApplying(true);
    await new Promise((r) => setTimeout(r, 800));
    setApplying(false);
    Alert.alert("Candidatura enviada!", "Uma mensagem foi enviada ao recrutador com seu perfil.");
    router.push(`/chat/recruiter-${id}` as any);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Vaga</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Job info card */}
        <View style={[styles.infoCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.jobTitle, { color: colors.navy }]}>{job.title}</Text>
          <View style={styles.metaRow}>
            <Feather name="briefcase" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{job.company}</Text>
            <Feather name="map-pin" size={14} color={colors.mutedForeground} style={{ marginLeft: 10 }} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{job.location}</Text>
          </View>
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: colors.background }]}>
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{job.contract}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: colors.background }]}>
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{job.category}</Text>
            </View>
            {job.expired ? (
              <View style={[styles.chip, { backgroundColor: "#fef2f2" }]}>
                <Feather name="alert-circle" size={12} color="#dc2626" />
                <Text style={[styles.chipText, { color: "#dc2626" }]}>Expirado</Text>
              </View>
            ) : job.expiresIn ? (
              <View style={[styles.chip, { backgroundColor: colors.background }]}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>Expira em {job.expiresIn}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.description, { color: colors.foreground }]}>{job.description}</Text>
          <Text style={[styles.contactEmail, { color: colors.mutedForeground }]}>
            Contato: {job.contact}
          </Text>
        </View>

        {/* Apply card */}
        {!job.expired && (
          <View style={[styles.applyCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <View style={styles.applyHeader}>
              <Feather name="message-circle" size={18} color={colors.gold} />
              <Text style={[styles.applyTitle, { color: colors.navy }]}>Candidatar-se</Text>
            </View>
            <Text style={[styles.applySub, { color: colors.mutedForeground }]}>
              Ao enviar, uma mensagem será enviada diretamente ao recrutador com seu perfil.
            </Text>
            <TextInput
              style={[styles.messageInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Adicione uma mensagem pessoal (opcional)..."
              placeholderTextColor={colors.mutedForeground}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.attachBtn, { borderColor: colors.border }]}
              onPress={() => Alert.alert("Em breve", "Upload de currículo em desenvolvimento.")}
            >
              <Feather name="upload" size={16} color={colors.navy} />
              <Text style={[styles.attachBtnText, { color: colors.navy }]}>Anexar currículo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.gold }]}
              onPress={handleApply}
              disabled={applying}
            >
              <Feather name="send" size={16} color="#fff" />
              <Text style={styles.applyBtnText}>{applying ? "Enviando..." : "Candidatar-se e Abrir Chat"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  infoCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  jobTitle: { fontSize: 20, fontWeight: "800", lineHeight: 26 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  metaText: { fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  chipText: { fontSize: 12 },
  description: { fontSize: 14, lineHeight: 20 },
  contactEmail: { fontSize: 13 },
  applyCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  applyHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  applyTitle: { fontSize: 16, fontWeight: "700" },
  applySub: { fontSize: 13, lineHeight: 18 },
  messageInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 100 },
  attachBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 10, borderWidth: 1 },
  attachBtnText: { fontSize: 14, fontWeight: "600" },
  applyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 10 },
  applyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
