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
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const ITEMS: Record<string, {
  title: string; seller: string; price: string; category: string;
  expiry?: string; expired?: boolean; description: string; contact: string;
}> = {
  m1: {
    title: "Adega Climatizada Brastemp 33 Garrafas",
    seller: "Lucas Lima",
    price: "R$ 1.200,00",
    category: "Equipamentos",
    expiry: "08/05/2026",
    description: "Adega em perfeito estado, pouco uso. Motivo: mudança.",
    contact: "contato@email.com",
  },
  m2: {
    title: "Lote de Vinhos Bordeaux 2015",
    seller: "Lucas Lima",
    price: "R$ 8.500,00",
    category: "Vinho",
    expired: true,
    description: "Lote com 6 garrafas de Bordeaux 2015, safra excepcional. Adquiridas em importadora certificada.",
    contact: "contato@email.com",
  },
};

export default function MarketItemScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const item = ITEMS[id] ?? ITEMS.m1;

  const handleContact = async () => {
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    Alert.alert("Mensagem enviada!", "Uma conversa foi aberta com o anunciante.");
    router.push(`/chat/contact-${id}` as any);
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
          <Text style={[styles.headerTitle, { color: colors.navy }]}>Produto</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Main info card */}
        <View style={[styles.infoCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.infoTop}>
            <Text style={[styles.itemTitle, { color: colors.navy, flex: 1 }]}>{item.title}</Text>
            <Text style={[styles.itemPrice, { color: colors.gold }]}>{item.price}</Text>
          </View>
          <View style={styles.sellerRow}>
            <Feather name="briefcase" size={14} color={colors.mutedForeground} />
            <Text style={[styles.sellerText, { color: colors.mutedForeground }]}>{item.seller}</Text>
          </View>
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: colors.background }]}>
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{item.category}</Text>
            </View>
            {item.expired ? (
              <View style={[styles.chip, { backgroundColor: "#fef2f2" }]}>
                <Feather name="alert-circle" size={12} color="#dc2626" />
                <Text style={[styles.chipText, { color: "#dc2626" }]}>Expirado</Text>
              </View>
            ) : item.expiry ? (
              <View style={[styles.chip, { backgroundColor: colors.background }]}>
                <Feather name="clock" size={12} color={colors.mutedForeground} />
                <Text style={[styles.chipText, { color: colors.mutedForeground }]}>Expira em: {item.expiry}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.description, { color: colors.foreground }]}>{item.description}</Text>
          <Text style={[styles.contactEmail, { color: colors.mutedForeground }]}>
            Contato: {item.contact}
          </Text>
        </View>

        {/* Contact card */}
        <View style={[styles.contactCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={styles.contactHeader}>
            <Feather name="message-circle" size={18} color={colors.gold} />
            <Text style={[styles.contactTitle, { color: colors.navy }]}>Entrar em contato</Text>
          </View>
          <Text style={[styles.contactSub, { color: colors.mutedForeground }]}>
            Uma conversa será iniciada com o anunciante.
          </Text>
          <TextInput
            style={[styles.messageInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Escreva sua mensagem (opcional)..."
            placeholderTextColor={colors.mutedForeground}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.gold }]}
            onPress={handleContact}
            disabled={sending}
          >
            <Feather name="send" size={16} color="#fff" />
            <Text style={styles.sendBtnText}>{sending ? "Enviando..." : "Enviar e Abrir Chat"}</Text>
          </TouchableOpacity>
        </View>
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
  infoTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  itemTitle: { fontSize: 17, fontWeight: "700", lineHeight: 24 },
  itemPrice: { fontSize: 20, fontWeight: "800" },
  sellerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sellerText: { fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  chipText: { fontSize: 12 },
  description: { fontSize: 14, lineHeight: 20 },
  contactEmail: { fontSize: 13 },
  contactCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 12 },
  contactHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  contactTitle: { fontSize: 16, fontWeight: "700" },
  contactSub: { fontSize: 13, lineHeight: 18 },
  messageInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, minHeight: 100 },
  sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 10 },
  sendBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
