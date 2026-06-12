import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { getCanonicalWebBaseUrl } from "@/utils/canonicalUrl";

interface CreditPackage {
  id: string;
  label: string;
  ai_credits: number;
  revelation_credits: number;
  price_brl: number;
  sort_order: number;
}

function fmtBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CreditShopScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const isIOS   = Platform.OS === "ios";
  const topPad  = Platform.OS === "web" ? 0 : insets.top;
  const botPad  = Platform.OS === "web" ? 20 : 20 + insets.bottom;
  const apiUrl  = process.env.EXPO_PUBLIC_API_URL ?? "";
  const webBase = getCanonicalWebBaseUrl();

  const [packages, setPackages]   = useState<CreditPackage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [buying, setBuying]       = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiUrl}/stripe/credit-packages`)
      .then(r => r.json())
      .then((data: CreditPackage[]) => setPackages(data))
      .catch(() => setError("Não foi possível carregar os pacotes."))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const handleBuy = async (pkg: CreditPackage) => {
    if (!session?.access_token) {
      Alert.alert("Erro", "Sessão expirada. Faça login novamente.");
      return;
    }
    setBuying(pkg.id);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/stripe/create-credit-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        Alert.alert("Erro", data.error ?? "Erro ao iniciar pagamento.");
        return;
      }
      const canOpen = await Linking.canOpenURL(data.url);
      if (canOpen) {
        await Linking.openURL(data.url);
      } else {
        Alert.alert("Erro", "Não foi possível abrir o navegador.");
      }
    } catch {
      Alert.alert("Erro", "Erro ao processar. Tente novamente.");
    } finally {
      setBuying(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Comprar Créditos</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.navy, borderRadius: 16, padding: 20, gap: 8 }]}>
          <Feather name="zap" size={24} color={colors.gold} />
          <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff" }}>Créditos Avulsos</Text>
          <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 19 }}>
            {isIOS
              ? "Para comprar créditos avulsos, acesse ibhub.com.br no seu navegador. Os créditos são adicionados ao seu saldo imediatamente após a confirmação."
              : "Escolha um pacote e pague uma única vez. Os créditos não expiram e somam ao seu saldo mensal atual."}
          </Text>
        </View>

        {isIOS ? (
          <View style={[styles.infoBox, { backgroundColor: `${colors.gold}0A`, borderColor: `${colors.gold}25` }]}>
            <Feather name="globe" size={13} color={colors.gold} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Acesse{" "}
              <Text style={{ color: colors.gold, fontWeight: "700" }}>www.ibhub.com.br/mercado</Text>
              {" "}para comprar créditos avulsos de Busca IA e Revelação.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.gold} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Carregando pacotes…</Text>
          </View>
        ) : error ? (
          <View style={[styles.infoBox, { backgroundColor: "#fef2f2", borderColor: "#fca5a5" }]}>
            <Feather name="alert-circle" size={13} color="#dc2626" />
            <Text style={[styles.infoText, { color: "#dc2626" }]}>{error}</Text>
          </View>
        ) : (
          packages.map(pkg => (
            <View
              key={pkg.id}
              style={[styles.packageCard, { backgroundColor: "#fff", borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.pkgLabel, { color: colors.navy }]}>{pkg.label}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  <View style={[styles.badge, { backgroundColor: `${colors.gold}15` }]}>
                    <Text style={[styles.badgeText, { color: colors.gold }]}>⚡ {pkg.ai_credits} créditos IA</Text>
                  </View>
                  {pkg.revelation_credits > 0 && (
                    <View style={[styles.badge, { backgroundColor: "#f0fdf4" }]}>
                      <Text style={[styles.badgeText, { color: "#059669" }]}>🔓 {pkg.revelation_credits} revelações</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                <Text style={[styles.price, { color: colors.navy }]}>{fmtBRL(pkg.price_brl)}</Text>
                <TouchableOpacity
                  style={[styles.buyBtn, { backgroundColor: buying === pkg.id ? `${colors.gold}80` : colors.gold }]}
                  onPress={() => handleBuy(pkg)}
                  disabled={buying !== null}
                  activeOpacity={0.82}
                >
                  {buying === pkg.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.buyBtnText}>Comprar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {!isIOS && (
          <View style={[styles.infoBox, { backgroundColor: `${colors.gold}0A`, borderColor: `${colors.gold}25` }]}>
            <Feather name="lock" size={13} color={colors.gold} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Pagamento único seguro via Stripe. Os créditos são adicionados imediatamente após a confirmação.
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.navy, marginTop: 8 }]}>
          Prefere créditos mensais?
        </Text>
        <View style={[styles.packageCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pkgLabel, { color: colors.navy }]}>Planos com créditos inclusos</Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 4, lineHeight: 17 }}>
              Os planos pagos já incluem créditos de IA e Revelação renovados todo mês.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.buyBtn, { backgroundColor: colors.navy }]}
            onPress={() => router.push("/subscription" as any)}
            activeOpacity={0.82}
          >
            <Text style={styles.buyBtnText}>Ver planos</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:    { fontSize: 20, fontWeight: "700" },
  hero:           {},
  loadingBox:     { alignItems: "center", paddingVertical: 32, gap: 10 },
  loadingText:    { fontSize: 13 },
  packageCard:    { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  pkgLabel:       { fontSize: 15, fontWeight: "800" },
  badge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:      { fontSize: 12, fontWeight: "700" },
  price:          { fontSize: 16, fontWeight: "900" },
  buyBtn:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, minWidth: 88, alignItems: "center" },
  buyBtnText:     { color: "#fff", fontSize: 13, fontWeight: "700" },
  infoBox:        { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12 },
  infoText:       { flex: 1, fontSize: 12, lineHeight: 18 },
  sectionTitle:   { fontSize: 16, fontWeight: "800" },
});
