import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import * as Notifications from "@/utils/safeNotifications";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import * as API from "@/services/api";

type WineStatus = "adega" | "consumido" | "presenteado" | "wishlist";
type FilterKey  = "todos" | WineStatus;

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "todos",       label: "Todos" },
  { key: "adega",       label: "Na Adega" },
  { key: "consumido",   label: "Consumido" },
  { key: "presenteado", label: "Presenteado" },
];

const STATUS_OPTIONS: { key: WineStatus; label: string }[] = [
  { key: "adega",       label: "Na Adega" },
  { key: "consumido",   label: "Consumido" },
  { key: "presenteado", label: "Presenteado" },
  { key: "wishlist",    label: "Wishlist" },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)}>
          <Feather name="star" size={22} color={star <= value ? colors.gold : colors.border} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function WineCellarScreen() {
  const colors  = useColors();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();

  const [wines, setWines]           = useState<API.WineEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]         = useState(false);
  const [filter, setFilter]         = useState<FilterKey>("todos");
  const [search, setSearch]         = useState("");
  const [showForm, setShowForm]     = useState(false);

  // Form state
  const [wName, setWName]           = useState("");
  const [wProducer, setWProducer]   = useState("");
  const [wVintage, setWVintage]     = useState("");
  const [wRegion, setWRegion]       = useState("");
  const [wCountry, setWCountry]     = useState("");
  const [wGrape, setWGrape]         = useState("");
  const [wEan, setWEan]             = useState("");
  const [wQty, setWQty]             = useState("1");
  const [wPrice, setWPrice]         = useState("");
  const [wBuyDate, setWBuyDate]     = useState("");
  const [wDrinkBy, setWDrinkBy]     = useState("");
  const [wStorage, setWStorage]     = useState("");
  const [wNotes, setWNotes]         = useState("");
  const [wRating, setWRating]       = useState(0);
  const [wStatus, setWStatus]       = useState<WineStatus>("adega");
  const [wPrivate, setWPrivate]     = useState(true);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoadingData(true);
    const data = await API.fetchWineCellar(user.id);
    setWines(data);
    setLoadingData(false);
    scheduleDrinkWindowAlerts(data);
  }, [user?.id]);

  const scheduleDrinkWindowAlerts = async (wines: API.WineEntry[]) => {
    if (Platform.OS === "web") return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== "granted") return;
      }
      await Notifications.cancelAllScheduledNotificationsAsync();
      const today = new Date();
      for (const wine of wines) {
        if (!wine.drink_by || wine.status !== "adega") continue;
        const drinkDate = new Date(wine.drink_by);
        const diffDays  = Math.ceil((drinkDate.getTime() - today.getTime()) / 86400000);
        if (diffDays > 0 && diffDays <= 30) {
          const trigger = new Date(drinkDate);
          trigger.setHours(10, 0, 0, 0);
          if (trigger > today) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🍷 Hora de abrir!",
                body: `${wine.name} está na janela ideal de consumo — abra hoje!`,
                data: { wine_id: wine.id },
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
            });
          }
        }
      }
    } catch (e) {
      console.log("scheduleDrinkWindowAlerts:", e);
    }
  };

  const handleShareWine = async (wine: API.WineEntry) => {
    const score = wine.rating > 0 ? `\n⭐ Avaliação: ${"★".repeat(wine.rating)}${"☆".repeat(5 - wine.rating)}` : "";
    const region = wine.region ? `\n📍 ${wine.region}${wine.country ? ", " + wine.country : ""}` : "";
    const vintage = wine.vintage ? ` (${wine.vintage})` : "";
    const message =
      `🍷 ${wine.name}${vintage}${wine.producer ? "\n🏠 " + wine.producer : ""}${region}${score}\n\nVia ibhub — Rede do Vinho\nhttps://ibhub.com.br`;
    try {
      await Share.share({ message });
    } catch (e) {
      console.log("handleShareWine:", e);
    }
  };

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setWName(""); setWProducer(""); setWVintage(""); setWRegion(""); setWCountry("");
    setWGrape(""); setWEan(""); setWQty("1"); setWPrice(""); setWBuyDate(""); setWDrinkBy("");
    setWStorage(""); setWNotes(""); setWRating(0); setWStatus("adega"); setWPrivate(true);
  };

  const parseDateBR = (str: string): string | null => {
    if (!str.trim()) return null;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(str.trim());
    if (iso) return str.trim();
    const parts = str.trim().split("/");
    if (parts.length === 3) {
      const [d, m, y] = parts;
      if (d && m && y && y.length === 4) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  };

  const handleAdd = async () => {
    if (!wName.trim()) { Alert.alert("Atenção", "Informe o nome do vinho."); return; }
    if (!user?.id) return;

    const buyDate  = parseDateBR(wBuyDate);
    const drinkBy  = parseDateBR(wDrinkBy);

    if (wBuyDate.trim() && !buyDate) {
      Alert.alert("Data inválida", "Informe a data de compra no formato dd/mm/aaaa."); return;
    }
    if (wDrinkBy.trim() && !drinkBy) {
      Alert.alert("Data inválida", "Informe 'beber até' no formato dd/mm/aaaa."); return;
    }

    setSaving(true);
    const entry = await API.addWineEntry({
      user_id: user.id,
      name: wName.trim(),
      producer: wProducer.trim() || null,
      vintage: wVintage.trim() || null,
      region: wRegion.trim() || null,
      country: wCountry.trim() || null,
      grape: wGrape.trim() || null,
      ean: wEan.trim() || null,
      qty: Math.max(1, parseInt(wQty) || 1),
      price: wPrice.trim() ? parseFloat(wPrice.replace(",", ".")) : null,
      buy_date: buyDate,
      drink_by: drinkBy,
      storage: wStorage.trim() || null,
      notes: wNotes.trim() || null,
      rating: wRating,
      status: wStatus,
      is_private: wPrivate,
    });
    setSaving(false);
    if (entry) {
      setWines((prev) => [entry, ...prev]);
      resetForm();
      setShowForm(false);
    } else {
      Alert.alert("Erro", "Não foi possível salvar o vinho. Tente novamente.");
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      "Remover vinho",
      `Remover "${name}" da adega?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            const ok = await API.deleteWineEntry(id);
            if (ok) setWines((prev) => prev.filter((w) => w.id !== id));
          },
        },
      ]
    );
  };

  const filtered = wines.filter((w) => {
    if (filter !== "todos" && w.status !== filter) return false;
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    adega:    wines.filter((w) => w.status === "adega").length,
    consumido: wines.filter((w) => w.status === "consumido").length,
    wishlist: wines.filter((w) => w.status === "wishlist").length,
  };

  const cellarValue = wines
    .filter((w) => w.status === "adega" && w.price != null)
    .reduce((sum, w) => sum + (w.price ?? 0) * w.qty, 0);

  const winesNearWindow = wines.filter((w) => {
    if (!w.drink_by || w.status !== "adega") return false;
    const diff = Math.ceil((new Date(w.drink_by).getTime() - Date.now()) / 86400000);
    return diff >= 0 && diff <= 30;
  });

  if (loadingData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.navy }]}>Adega</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Gerencie sua adega pessoal</Text>
          </View>
        </TouchableOpacity>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.navy + "14", borderWidth: 1, borderColor: colors.navy + "20" }]}
            onPress={() => router.push("/wine-ranking" as any)}
          >
            <Feather name="bar-chart-2" size={15} color={colors.navy} />
            <Text style={[styles.addBtnText, { color: colors.navy }]}>Ranking</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.gold }]}
            onPress={() => setShowForm(true)}
          >
            <Feather name="plus" size={15} color="#fff" />
            <Text style={styles.addBtnText}>Adicionar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* KPI cards */}
        <View style={styles.kpiRow}>
          {[
            { icon: "wind",   label: "Na Adega",   val: counts.adega,    color: colors.gold },
            { icon: "coffee", label: "Consumidos", val: counts.consumido, color: colors.mutedForeground },
            { icon: "star",   label: "Wishlist",   val: counts.wishlist,  color: "#f59e0b" },
          ].map((k) => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Feather name={k.icon as any} size={22} color={k.color} />
              <Text style={[styles.kpiNum, { color: colors.navy }]}>{k.val}</Text>
              <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Cellar value banner */}
        {cellarValue > 0 && (
          <View style={[styles.valueBanner, { backgroundColor: colors.gold + "14", borderColor: colors.gold + "40" }]}>
            <Feather name="trending-up" size={16} color={colors.gold} />
            <Text style={[styles.valueBannerText, { color: colors.navy }]}>
              Valor estimado da adega:{" "}
              <Text style={{ fontWeight: "800", color: colors.gold }}>
                R$ {cellarValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </Text>
          </View>
        )}

        {/* Drink window alert */}
        {winesNearWindow.length > 0 && (
          <View style={[styles.windowBanner, { backgroundColor: "#fef3c7", borderColor: "#fbbf24" }]}>
            <Feather name="clock" size={15} color="#b45309" />
            <Text style={[styles.windowBannerText, { color: "#b45309" }]}>
              {winesNearWindow.length === 1
                ? `"${winesNearWindow[0].name}" está na janela ideal de consumo!`
                : `${winesNearWindow.length} vinhos na janela ideal de consumo — hora de abrir!`}
            </Text>
          </View>
        )}

        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={[styles.searchBar, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Buscar vinhos..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTER_OPTIONS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, { backgroundColor: filter === f.key ? colors.gold : "#fff", borderColor: filter === f.key ? colors.gold : colors.border }]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, { color: filter === f.key ? "#fff" : colors.mutedForeground }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Wine list */}
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="wind" size={40} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.mutedForeground }]}>Sua adega está vazia</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.gold }]}
              onPress={() => setShowForm(true)}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Adicionar primeiro vinho</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ padding: 16, gap: 10 }}>
            {filtered.map((wine) => (
              <View key={wine.id} style={[styles.wineCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <View style={styles.wineCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.wineName, { color: colors.navy }]}>{wine.name}</Text>
                    {wine.producer && <Text style={[styles.wineSub, { color: colors.mutedForeground }]}>{wine.producer}{wine.vintage ? ` · ${wine.vintage}` : ""}</Text>}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: colors.gold + "18" }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.gold }]}>
                      {STATUS_OPTIONS.find((s) => s.key === wine.status)?.label}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleShareWine(wine)} style={{ padding: 4 }}>
                    <Feather name="share-2" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(wine.id, wine.name)} style={{ padding: 4, marginLeft: 2 }}>
                    <Feather name="trash-2" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <View style={styles.wineMeta}>
                  {wine.region && <Text style={[styles.wineMetaText, { color: colors.mutedForeground }]}>{wine.region}</Text>}
                  <Text style={[styles.wineMetaText, { color: colors.mutedForeground }]}>{wine.qty}x</Text>
                  {wine.price != null && <Text style={[styles.wineMetaText, { color: colors.gold }]}>R$ {Number(wine.price).toFixed(2)}</Text>}
                  {wine.is_private && <Feather name="eye-off" size={12} color={colors.mutedForeground} />}
                  {wine.ean && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Feather name="tag" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.wineMetaText, { color: colors.mutedForeground }]}>{wine.ean}</Text>
                    </View>
                  )}
                </View>
                {wine.rating > 0 && (
                  <View style={{ flexDirection: "row", gap: 2 }}>
                    {[1,2,3,4,5].map((s) => (
                      <Feather key={s} name="star" size={12} color={s <= wine.rating ? colors.gold : colors.border} />
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Wine form modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <View style={[styles.formContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.formHeader, { backgroundColor: "#fff", borderBottomColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.navy }]}>Adicionar Vinho</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Feather name="x" size={22} color={colors.navy} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
            <TextInput style={[styles.fInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Nome do vinho *" placeholderTextColor={colors.mutedForeground} value={wName} onChangeText={setWName} />
            <View style={styles.fRow}>
              <TextInput style={[styles.fInput, styles.fHalf, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="Produtor" placeholderTextColor={colors.mutedForeground} value={wProducer} onChangeText={setWProducer} />
              <TextInput style={[styles.fInput, styles.fHalf, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="Safra" placeholderTextColor={colors.mutedForeground} value={wVintage} onChangeText={setWVintage} keyboardType="numeric" />
            </View>
            <View style={styles.fRow}>
              <TextInput style={[styles.fInput, styles.fHalf, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="Região" placeholderTextColor={colors.mutedForeground} value={wRegion} onChangeText={setWRegion} />
              <TextInput style={[styles.fInput, styles.fHalf, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                placeholder="País" placeholderTextColor={colors.mutedForeground} value={wCountry} onChangeText={setWCountry} />
            </View>
            <TextInput style={[styles.fInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Uva/Casta" placeholderTextColor={colors.mutedForeground} value={wGrape} onChangeText={setWGrape} />
            <TextInput style={[styles.fInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="EAN / Código de barras (ex: 7896123456789)" placeholderTextColor={colors.mutedForeground}
              value={wEan} onChangeText={setWEan} keyboardType="numeric" />
            <View style={styles.fRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.fLabel, { color: colors.mutedForeground }]}>Quantidade</Text>
                <TextInput style={[styles.fInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                  value={wQty} onChangeText={setWQty} keyboardType="numeric" />
              </View>
              <TextInput style={[styles.fInput, styles.fHalf, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground, alignSelf: "flex-end" }]}
                placeholder="Preço de compra" placeholderTextColor={colors.mutedForeground} value={wPrice} onChangeText={setWPrice} keyboardType="decimal-pad" />
            </View>
            <View style={styles.fRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.fLabel, { color: colors.mutedForeground }]}>Data de compra</Text>
                <TextInput style={[styles.fInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                  placeholder="dd/mm/aaaa" placeholderTextColor={colors.mutedForeground} value={wBuyDate} onChangeText={setWBuyDate} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.fLabel, { color: colors.mutedForeground }]}>Beber até</Text>
                <TextInput style={[styles.fInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
                  placeholder="dd/mm/aaaa" placeholderTextColor={colors.mutedForeground} value={wDrinkBy} onChangeText={setWDrinkBy} />
              </View>
            </View>
            <TextInput style={[styles.fInput, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Local de armazenamento" placeholderTextColor={colors.mutedForeground} value={wStorage} onChangeText={setWStorage} />
            <TextInput style={[styles.fInput, styles.fTextarea, { backgroundColor: "#fff", borderColor: colors.border, color: colors.foreground }]}
              placeholder="Notas de degustação" placeholderTextColor={colors.mutedForeground} value={wNotes} onChangeText={setWNotes} multiline textAlignVertical="top" />
            {/* Rating */}
            <View style={{ gap: 6 }}>
              <Text style={[styles.fLabel, { color: colors.foreground }]}>Avaliação:</Text>
              <StarRating value={wRating} onChange={setWRating} />
            </View>
            {/* Status */}
            <View style={{ gap: 6 }}>
              <Text style={[styles.fLabel, { color: colors.foreground }]}>Status:</Text>
              <View style={styles.statusChips}>
                {STATUS_OPTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.statusChip, { backgroundColor: wStatus === s.key ? colors.gold : "#fff", borderColor: wStatus === s.key ? colors.gold : colors.border }]}
                    onPress={() => setWStatus(s.key)}
                  >
                    <Text style={[styles.statusChipText, { color: wStatus === s.key ? "#fff" : colors.foreground }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {/* Privacy */}
            <TouchableOpacity style={styles.toggleRow} onPress={() => setWPrivate(!wPrivate)}>
              <Feather name={wPrivate ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              <Text style={[styles.toggleText, { color: colors.foreground }]}>
                {wPrivate ? "Apenas para você" : "Visível para conexões"}
              </Text>
            </TouchableOpacity>
            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.gold }, saving && { opacity: 0.6 }]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="check" size={18} color="#fff" />
              )}
              <Text style={styles.saveBtnText}>{saving ? "Salvando..." : "Salvar Vinho"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  headerSub: { fontSize: 12, marginTop: 1 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  kpiRow: { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 8 },
  kpiCard: { flex: 1, alignItems: "center", gap: 4, padding: 14, borderRadius: 12, borderWidth: 1 },
  kpiNum: { fontSize: 22, fontWeight: "800" },
  kpiLabel: { fontSize: 11, textAlign: "center" },
  valueBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  valueBannerText: { fontSize: 13, flex: 1 },
  windowBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  windowBannerText: { fontSize: 13, flex: 1, fontWeight: "600" },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", gap: 14, paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, textAlign: "center" },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 30 },
  emptyBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  wineCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  wineCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  wineName: { fontSize: 15, fontWeight: "700" },
  wineSub: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  wineMeta: { flexDirection: "row", gap: 12 },
  wineMetaText: { fontSize: 12 },
  formContainer: { flex: 1 },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1 },
  formTitle: { fontSize: 18, fontWeight: "700" },
  formScroll: { padding: 16, gap: 12 },
  fInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  fHalf: { flex: 1 },
  fRow: { flexDirection: "row", gap: 10 },
  fLabel: { fontSize: 12 },
  fTextarea: { height: 80, textAlignVertical: "top" },
  statusChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  statusChipText: { fontSize: 13, fontWeight: "500" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleText: { fontSize: 14 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 15, borderRadius: 10, marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
