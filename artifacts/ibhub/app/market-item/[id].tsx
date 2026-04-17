import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  AppOpportunity,
  fetchOpportunityById,
  getOrCreateDirectConversation,
  sendMessage,
  trackOpportunityView,
} from "@/services/api";

export default function MarketItemScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, activeCompany } = useAuth();

  const [item, setItem] = useState<AppOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);
  const [contactMsg, setContactMsg] = useState("");

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  useEffect(() => {
    if (!id || !user?.id) return;
    fetchOpportunityById(id, user.id).then((data) => {
      setItem(data);
      setLoading(false);
    });
    trackOpportunityView(id).catch(() => {});
  }, [id, user?.id]);

  const handleNegociar = async () => {
    if (!user?.id || !item) return;

    const sellerId = item.company_page?.owner_id ?? item.created_by;
    if (sellerId === user.id) {
      Alert.alert("Atenção", "Você não pode negociar com você mesmo.");
      return;
    }

    setContacting(true);
    try {
      const convoId = await getOrCreateDirectConversation(user.id, sellerId, true, null);
      if (convoId) {
        const companyId = item.company_page_id;

        // Send opening message if user typed one
        const msgText = contactMsg.trim()
          || `Olá! Vi o anúncio **${item.title}** e gostaria de mais informações.`;
        await sendMessage(convoId, user.id, msgText);

        const chatRoute = companyId
          ? `/chat/${convoId}?companyId=${companyId}`
          : `/chat/${convoId}`;
        router.push(chatRoute as any);
      } else {
        Alert.alert("Erro", "Não foi possível abrir uma conversa. Tente novamente.");
      }
    } finally {
      setContacting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Feather name="arrow-left" size={22} color={colors.navy} />
            <Text style={[styles.headerTitle, { color: colors.navy }]}>Produto</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
          <Feather name="package" size={40} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 16, textAlign: "center" }}>
            Produto não encontrado ou removido.
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.gold, fontSize: 15, fontWeight: "600" }}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isExpired = item.expires_at ? new Date(item.expires_at) < new Date() : false;
  const isOwn = user?.id === item.created_by;

  // Company takes priority; never fall back to personal profile
  const hasCompany = !!item.company_page_id;
  const companyName   = item.company_page?.name   ?? item.company ?? null;
  const companyAvatar = item.company_page?.avatar_url ?? null;

  const handleCompanyPress = () => {
    if (item.company_page_id) {
      router.push(`/empresa/${item.company_page_id}` as any);
    }
    // If no company page linked, do nothing
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Produto</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: bottomPad + 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Cover image */}
          {item.cover_image_url ? (
            <Image
              source={{ uri: item.cover_image_url }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: colors.border + "66" }]}>
              <Feather name="package" size={48} color={colors.border} />
            </View>
          )}

          <View style={{ padding: 16, gap: 14 }}>
            {/* Main info card */}
            <View style={[styles.infoCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <View style={styles.infoTop}>
                <Text style={[styles.itemTitle, { color: colors.navy, flex: 1 }]}>{item.title}</Text>
                {item.price ? (
                  <Text style={[styles.itemPrice, { color: colors.gold }]}>{item.price}</Text>
                ) : null}
              </View>

              {/* Chips */}
              <View style={styles.chips}>
                {item.category ? (
                  <View style={[styles.chip, { backgroundColor: colors.background }]}>
                    <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.category}</Text>
                  </View>
                ) : null}
                {isExpired ? (
                  <View style={[styles.chip, { backgroundColor: "#fef2f2" }]}>
                    <Feather name="alert-circle" size={12} color="#dc2626" />
                    <Text style={[styles.chipText, { color: "#dc2626" }]}>Expirado</Text>
                  </View>
                ) : item.expires_at ? (
                  <View style={[styles.chip, { backgroundColor: colors.background }]}>
                    <Feather name="clock" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
                      Expira {new Date(item.expires_at).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                ) : null}
                {item.location ? (
                  <View style={[styles.chip, { backgroundColor: colors.background }]}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.location}</Text>
                  </View>
                ) : null}
              </View>

              {item.description ? (
                <Text style={[styles.description, { color: colors.foreground }]}>{item.description}</Text>
              ) : null}

              {item.contact_email ? (
                <Text style={[styles.contactEmail, { color: colors.mutedForeground }]}>
                  Contato: {item.contact_email}
                </Text>
              ) : null}
            </View>

            {/* Company card — always shows company, never personal profile */}
            <TouchableOpacity
              style={[styles.sellerCard, { backgroundColor: "#fff", borderColor: colors.border }]}
              onPress={handleCompanyPress}
              activeOpacity={hasCompany ? 0.8 : 1}
              disabled={!hasCompany}
            >
              {companyAvatar ? (
                <Image source={{ uri: companyAvatar }} style={styles.companyAvatar} />
              ) : (
                <View style={[styles.companyAvatar, styles.companyAvatarFallback, { backgroundColor: colors.muted }]}>
                  <Feather name="briefcase" size={18} color={colors.mutedForeground} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.sellerName, { color: colors.navy }]}>
                  {companyName ?? "Anunciante"}
                </Text>
                <Text style={[styles.sellerSub, { color: colors.mutedForeground }]}>
                  {hasCompany ? "Página de empresa" : "Empresa anunciante"}
                </Text>
              </View>
              {hasCompany && (
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              )}
            </TouchableOpacity>

            {/* Contact section */}
            {!isOwn && !isExpired && (
              <View style={[styles.contactCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <Text style={[styles.contactLabel, { color: colors.foreground }]}>
                  Mensagem para a empresa
                </Text>
                <TextInput
                  style={[styles.msgInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  placeholder={`Olá! Vi o anúncio "${item.title}" e gostaria de mais informações.`}
                  placeholderTextColor={colors.mutedForeground}
                  value={contactMsg}
                  onChangeText={setContactMsg}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.negotiateBtn, { backgroundColor: contacting ? colors.border : colors.gold, opacity: contacting ? 0.7 : 1 }]}
                  onPress={handleNegociar}
                  disabled={contacting}
                >
                  {contacting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Feather name="message-circle" size={18} color="#fff" />
                      <Text style={styles.negotiateBtnText}>
                        {contacting ? "Abrindo conversa..." : "Enviar mensagem à empresa"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {isExpired && (
              <View style={[styles.expiredBanner, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                <Feather name="alert-circle" size={16} color="#dc2626" />
                <Text style={{ color: "#dc2626", fontSize: 14, flex: 1 }}>
                  Este anúncio está expirado e não aceita novas negociações.
                </Text>
              </View>
            )}

            {isOwn && (
              <View style={[styles.expiredBanner, { backgroundColor: colors.background, borderColor: colors.gold }]}>
                <Feather name="star" size={16} color={colors.gold} />
                <Text style={{ color: colors.gold, fontSize: 14, flex: 1 }}>
                  Este é o seu anúncio.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1 },
  header:               { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow:              { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:          { fontSize: 20, fontWeight: "700" },
  coverImage:           { width: "100%", aspectRatio: 16 / 9 },
  coverPlaceholder:     { width: "100%", aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center" },
  infoCard:             { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  infoTop:              { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  itemTitle:            { fontSize: 17, fontWeight: "700", lineHeight: 24 },
  itemPrice:            { fontSize: 20, fontWeight: "800" },
  chips:                { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:                 { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  chipText:             { fontSize: 12 },
  description:          { fontSize: 14, lineHeight: 20 },
  contactEmail:         { fontSize: 13 },
  sellerCard:           { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  sellerName:           { fontSize: 14, fontWeight: "700" },
  sellerSub:            { fontSize: 12, marginTop: 2 },
  companyAvatar:        { width: 42, height: 42, borderRadius: 10 },
  companyAvatarFallback:{ alignItems: "center", justifyContent: "center" },
  contactCard:          { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  contactLabel:         { fontSize: 14, fontWeight: "700" },
  msgInput:             { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, minHeight: 80 },
  negotiateBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 14, borderRadius: 12 },
  negotiateBtnText:     { color: "#fff", fontSize: 15, fontWeight: "700" },
  expiredBanner:        { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 14 },
});
