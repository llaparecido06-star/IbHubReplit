import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import * as DocumentPicker from "expo-document-picker";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  AppOpportunity,
  applyToJob,
  expressInterest,
  fetchOpportunityById,
  fetchUserLastCV,
  getOrCreateDirectConversation,
  sendMessage,
  trackOpportunityView,
  uploadCV,
} from "@/services/api";

const contractColor: Record<string, string> = {
  CLT: "#2ecc71", PJ: "#3498db", Freelancer: "#9b59b6", Estágio: "#e67e22",
};

export default function OpportunityDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const topPad    = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const [opp, setOpp]       = useState<(AppOpportunity & { applications_count: number }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInterested, setIsInterested] = useState(false);

  // Apply modal state
  const [showApply, setShowApply]   = useState(false);
  const [message, setMessage]       = useState("");
  const [cvName, setCvName]         = useState<string | null>(null);
  const [cvUri, setCvUri]           = useState<string | null>(null);
  const [savedCv, setSavedCv]       = useState<{ url: string; name: string } | null>(null);
  const [usingSavedCv, setUsingSavedCv] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Animated bottom sheet
  const slideAnim = useRef(new Animated.Value(400)).current;
  const openSheet = () => {
    setShowApply(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // Auto-load saved CV from last application
    if (user?.id && !savedCv) {
      fetchUserLastCV(user.id).then((cv) => {
        if (cv) { setSavedCv(cv); setUsingSavedCv(true); }
      });
    }
  };
  const closeSheet = () => {
    Animated.timing(slideAnim, { toValue: 400, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setShowApply(false));
  };

  useEffect(() => {
    if (!id || !user?.id) return;
    (async () => {
      const data = await fetchOpportunityById(id, user.id);
      setOpp(data);
      if (data?.is_interested) setIsInterested(true);
      setLoading(false);
      // Track view — skip if creator is viewing their own listing
      if (data && data.created_by !== user.id) {
        trackOpportunityView(id);
      }
    })();
  }, [id, user?.id]);

  const handlePickCV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword",
               "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setCvUri(result.assets[0].uri);
        setCvName(result.assets[0].name);
      }
    } catch (e) {
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  };

  const handleApply = async () => {
    if (!opp || !user?.id) return;
    setSubmitting(true);
    try {
      let cvUrl: string | null = null;
      let cvFileName: string | null = null;

      if (cvUri) {
        // User picked a new CV — upload it
        cvUrl = await uploadCV(cvUri, user.id);
        cvFileName = cvName;
      } else if (usingSavedCv && savedCv) {
        // Auto-use previously saved CV
        cvUrl = savedCv.url;
        cvFileName = savedCv.name;
      }

      const ok = await applyToJob(opp.id, user.id, cvUrl, message.trim() || null);
      if (!ok) {
        Alert.alert("Erro", "Não foi possível enviar a candidatura. Você já se candidatou?");
        return;
      }
      closeSheet();
      setOpp((prev) => prev ? { ...prev, is_applied: true, applications_count: (prev.applications_count ?? 0) + 1 } : prev);

      // Auto-create conversation — route to company owner if page is present
      const chatTargetId = opp.company_page?.owner_id ?? opp.created_by;
      const convoId = await getOrCreateDirectConversation(user.id, chatTargetId, true);
      if (convoId) {
        const cpId = opp.company_page_id ?? null;
        // Send standardized application text
        const appMsg = [
          `Me candidatei à vaga **${opp.title}**${opp.company ? ` na ${opp.company}` : ""}.`,
          message.trim() ? `\n\n${message.trim()}` : "",
          cvUrl ? "\n\nSegue meu currículo em anexo." : "",
        ].join("");
        await sendMessage(convoId, user.id, appMsg, { companyPageId: cpId });

        // If CV attached, also send as file message so recruiter can download
        if (cvUrl && cvFileName) {
          await sendMessage(convoId, user.id, cvFileName, {
            message_type: "file",
            metadata: { file_url: cvUrl, file_name: cvFileName, file_type: "document" },
            companyPageId: cpId,
          });
        }

        const route = cpId ? `/chat/${convoId}?companyId=${cpId}` : `/chat/${convoId}`;
        router.push(route as any);
      } else {
        Alert.alert("Candidatura enviada!", "O recrutador foi notificado da sua candidatura.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInterest = async () => {
    if (!opp || !user?.id || isInterested) return;
    setSubmitting(true);
    try {
      const ok = await expressInterest(opp.id, user.id, null);
      if (ok) {
        setIsInterested(true);
        Alert.alert(
          "Interesse registrado!",
          opp.contact_email
            ? `O anunciante foi notificado. Você também pode entrar em contato: ${opp.contact_email}`
            : "O anunciante foi notificado do seu interesse.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!opp) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
        <Text style={[styles.notFound, { color: colors.mutedForeground }]}>Oportunidade não encontrada</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.gold, fontWeight: "700", marginTop: 12 }}>← Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOwner = user?.id === opp.created_by;
  const isVaga  = opp.type === "vaga";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {isVaga ? "Vaga" : "Marketplace"}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>{opp.title}</Text>

          {opp.company_page ? (
            <TouchableOpacity
              style={styles.companyCard}
              onPress={() => router.push(`/empresa/${opp.company_page_id}` as any)}
            >
              {opp.company_page.avatar_url ? (
                <Image source={{ uri: opp.company_page.avatar_url }} style={styles.companyAvatar} />
              ) : (
                <View style={[styles.companyAvatar, styles.companyAvatarPlaceholder, { backgroundColor: colors.muted }]}>
                  <Feather name="briefcase" size={16} color={colors.mutedForeground} />
                </View>
              )}
              <View>
                <Text style={[styles.companyCardName, { color: colors.gold }]}>{opp.company_page.name}</Text>
                {opp.company ? (
                  <Text style={[styles.heroSub, { color: colors.mutedForeground, marginTop: 0 }]}>{opp.company}</Text>
                ) : null}
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
          ) : isVaga && opp.company ? (
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>{opp.company}</Text>
          ) : opp.creator?.full_name ? (
            <TouchableOpacity onPress={() => router.push(`/profile/${opp.creator!.id}` as any)}>
              <Text style={[styles.heroSub, { color: colors.gold }]}>por {opp.creator.full_name}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.pillsRow}>
            {opp.category ? (
              <View style={[styles.pill, { backgroundColor: colors.navy + "22" }]}>
                <Text style={[styles.pillText, { color: colors.navy }]}>{opp.category}</Text>
              </View>
            ) : null}
            {opp.contract_type ? (
              <View style={[styles.pill, { backgroundColor: (contractColor[opp.contract_type] ?? colors.navy) + "22" }]}>
                <Text style={[styles.pillText, { color: contractColor[opp.contract_type] ?? colors.navy }]}>{opp.contract_type}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.metaGrid}>
            {opp.location ? (
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={14} color={colors.gold} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>{opp.location}</Text>
              </View>
            ) : null}
            {isVaga && opp.salary ? (
              <View style={styles.metaItem}>
                <Feather name="dollar-sign" size={14} color={colors.gold} />
                <Text style={[styles.metaText, { color: colors.gold, fontWeight: "700" }]}>{opp.salary}</Text>
              </View>
            ) : null}
            {!isVaga && opp.price ? (
              <View style={styles.metaItem}>
                <Feather name="tag" size={14} color={colors.gold} />
                <Text style={[styles.metaText, { color: colors.gold, fontWeight: "700" }]}>{opp.price}</Text>
              </View>
            ) : null}
            {opp.contact_email ? (
              <TouchableOpacity style={styles.metaItem} onPress={() => Linking.openURL(`mailto:${opp.contact_email}`)}>
                <Feather name="mail" size={14} color={colors.gold} />
                <Text style={[styles.metaText, { color: colors.gold }]}>{opp.contact_email}</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                Publicada em {new Date(opp.created_at).toLocaleDateString("pt-BR")}
              </Text>
            </View>
            {isVaga && (
              <View style={styles.metaItem}>
                <Feather name="users" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {opp.applications_count} {opp.applications_count === 1 ? "candidatura" : "candidaturas"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {opp.description ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Descrição</Text>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{opp.description}</Text>
          </View>
        ) : null}

        {/* Expires at */}
        {opp.expires_at ? (
          <View style={[styles.expiryBanner, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={14} color={colors.mutedForeground} />
            <Text style={[styles.expiryText, { color: colors.mutedForeground }]}>
              Expira em {new Date(opp.expires_at).toLocaleDateString("pt-BR")}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom action bar */}
      {!isOwner && (
        <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: bottomPad + 8 }]}>
          {isVaga ? (
            opp.is_applied ? (
              <View style={[styles.appliedBadge, { backgroundColor: colors.secondary }]}>
                <Feather name="check-circle" size={16} color={colors.mutedForeground} />
                <Text style={[styles.appliedText, { color: colors.mutedForeground }]}>Candidatura enviada</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.gold }]}
                onPress={openSheet}
                activeOpacity={0.85}
              >
                <Feather name="send" size={17} color="#fff" />
                <Text style={styles.actionBtnText}>Candidatar-se</Text>
              </TouchableOpacity>
            )
          ) : isInterested ? (
            <View style={[styles.appliedBadge, { backgroundColor: colors.secondary }]}>
              <Feather name="check-circle" size={16} color={colors.gold} />
              <Text style={[styles.appliedText, { color: colors.gold }]}>Interesse registrado</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.navy }]}
              onPress={handleInterest}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Feather name="message-circle" size={17} color="#fff" />
                  <Text style={styles.actionBtnText}>Tenho interesse</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Apply bottom sheet overlay */}
      {showApply && (
        <Pressable style={styles.overlay} onPress={closeSheet}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <Animated.View
                style={[
                  styles.sheet,
                  { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <View style={styles.sheetHandle} />
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Enviar candidatura</Text>
                <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>{opp.title}</Text>

                {/* CV — saved or new */}
                {savedCv && !cvUri ? (
                  <View style={[styles.cvPicker, { borderColor: usingSavedCv ? colors.gold : colors.border, backgroundColor: colors.background }]}>
                    <Feather name="file-text" size={18} color={colors.gold} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cvLabel, { color: colors.gold }]}>
                        {usingSavedCv ? "Currículo salvo" : "Trocar currículo"}
                      </Text>
                      <Text style={[styles.cvHint, { color: colors.mutedForeground }]} numberOfLines={1}>{savedCv.name}</Text>
                    </View>
                    <Pressable onPress={handlePickCV} style={{ padding: 4 }}>
                      <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                    </Pressable>
                    <Pressable onPress={() => setUsingSavedCv(!usingSavedCv)} style={{ padding: 4 }}>
                      <Feather name={usingSavedCv ? "check-circle" : "circle"} size={16} color={usingSavedCv ? colors.gold : colors.mutedForeground} />
                    </Pressable>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.cvPicker, { borderColor: cvName ? colors.gold : colors.border, backgroundColor: colors.background }]}
                    onPress={handlePickCV}
                  >
                    <Feather name="paperclip" size={18} color={cvName ? colors.gold : colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cvLabel, { color: cvName ? colors.gold : colors.mutedForeground }]}>
                        {cvName ?? "Anexar currículo (PDF ou Word)"}
                      </Text>
                      {!cvName && (
                        <Text style={[styles.cvHint, { color: colors.mutedForeground }]}>Opcional — máx. 5 MB</Text>
                      )}
                    </View>
                    {cvName && (
                      <Pressable onPress={() => { setCvName(null); setCvUri(null); }}>
                        <Feather name="x" size={16} color={colors.mutedForeground} />
                      </Pressable>
                    )}
                  </TouchableOpacity>
                )}

                {/* Message */}
                <TextInput
                  style={[styles.msgInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  placeholder="Mensagem para o recrutador (opcional)"
                  placeholderTextColor={colors.mutedForeground}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: submitting ? colors.border : colors.gold }]}
                  onPress={handleApply}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Enviar candidatura</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  notFound:     { fontSize: 15 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn:      { padding: 4 },
  headerTitle:  { fontSize: 17, fontWeight: "700", flex: 1, textAlign: "center" },
  heroCard:     { margin: 14, borderRadius: 14, borderWidth: 1, padding: 20, gap: 12 },
  heroTitle:    { fontSize: 20, fontWeight: "800", lineHeight: 26 },
  heroSub:      { fontSize: 14, marginTop: -4 },
  pillsRow:     { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill:         { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText:     { fontSize: 12, fontWeight: "700" },
  metaGrid:     { gap: 10 },
  metaItem:     { flexDirection: "row", alignItems: "center", gap: 8 },
  metaText:     { fontSize: 13, flex: 1 },
  section:      { marginHorizontal: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  sectionBody:  { fontSize: 14, lineHeight: 22 },
  expiryBanner: { marginHorizontal: 14, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  expiryText:   { fontSize: 13 },
  bottomBar:    { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  actionBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14 },
  actionBtnText:{ color: "#fff", fontSize: 15, fontWeight: "800" },
  appliedBadge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 14 },
  appliedText:  { fontSize: 14, fontWeight: "600" },
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:        { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 40, gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20 },
  sheetHandle:  { width: 38, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 4 },
  sheetTitle:   { fontSize: 18, fontWeight: "800" },
  sheetSub:     { fontSize: 13, marginTop: -6 },
  cvPicker:     { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: 12, borderStyle: "dashed", padding: 14 },
  cvLabel:      { fontSize: 14, fontWeight: "600" },
  cvHint:       { fontSize: 11, marginTop: 2 },
  msgInput:     { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 100 },
  submitBtn:    { paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  submitBtnText:{ color: "#fff", fontSize: 15, fontWeight: "800" },
  companyCard:  { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 2, paddingVertical: 6 },
  companyAvatar:{ width: 36, height: 36, borderRadius: 8 },
  companyAvatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  companyCardName: { fontSize: 14, fontWeight: "700" },
});
