import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
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
import { Feather } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useColors } from "@/hooks/useColors";

interface WineEntry {
  id: string;
  name: string;
  producer: string;
  vintage?: string;
  region?: string;
  varietal?: string;
  quantity: number;
  purchase_price?: number;
  rating?: number;
  notes?: string;
  added_at: string;
}

const STORAGE_KEY = "ibhub_wine_cellar";

const WINE_TYPES = ["Tinto", "Branco", "Rosé", "Espumante", "Sobremesa", "Outro"];

export default function WineCellarScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [wines, setWines] = useState<WineEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Partial<WineEntry>>({ quantity: 1 });
  const [filter, setFilter] = useState("todos");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setWines(JSON.parse(val));
    });
  }, []);

  const saveWines = async (updated: WineEntry[]) => {
    setWines(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const addWine = async () => {
    if (!form.name || !form.producer) return;
    const newWine: WineEntry = {
      id: Date.now().toString(),
      name: form.name ?? "",
      producer: form.producer ?? "",
      vintage: form.vintage,
      region: form.region,
      varietal: form.varietal,
      quantity: form.quantity ?? 1,
      purchase_price: form.purchase_price,
      rating: form.rating,
      notes: form.notes,
      added_at: new Date().toISOString(),
    };
    await saveWines([newWine, ...wines]);
    setShowModal(false);
    setForm({ quantity: 1 });
  };

  const totalBottles = wines.reduce((sum, w) => sum + w.quantity, 0);

  const filtered = filter === "todos" ? wines : wines.filter((w) =>
    w.varietal?.toLowerCase().includes(filter.toLowerCase()) ||
    w.region?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.navy }]}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.gold} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.gold }]}>Adega Pessoal</Text>
        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Feather name="plus" size={24} color={colors.gold} />
        </TouchableOpacity>
      </View>

      <View style={[styles.statsBar, { backgroundColor: colors.navyLight }]}>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.gold }]}>{wines.length}</Text>
          <Text style={[styles.statLabel, { color: colors.gold + "aa" }]}>Rótulos</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.gold + "44" }]} />
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.gold }]}>{totalBottles}</Text>
          <Text style={[styles.statLabel, { color: colors.gold + "aa" }]}>Garrafas</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.gold + "44" }]} />
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: colors.gold }]}>
            {wines.filter((w) => w.rating && w.rating >= 90).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.gold + "aa" }]}>90+ pts</Text>
        </View>
      </View>

      {wines.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="package" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Adega vazia</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Adicione seus vinhos para acompanhar sua coleção
          </Text>
          <Button title="Adicionar vinho" onPress={() => setShowModal(true)} variant="gold" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.wineCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <View style={[styles.wineTypeBar, { backgroundColor: colors.wine }]} />
              <View style={styles.wineInfo}>
                <View style={styles.wineHeader}>
                  <Text style={[styles.wineName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.vintage && (
                    <Text style={[styles.wineVintage, { color: colors.gold }]}>{item.vintage}</Text>
                  )}
                </View>
                <Text style={[styles.wineProducer, { color: colors.mutedForeground }]}>
                  {item.producer}
                </Text>
                {item.region && (
                  <Text style={[styles.wineRegion, { color: colors.mutedForeground }]}>
                    {item.region}
                  </Text>
                )}
                <View style={styles.wineFooter}>
                  <View style={[styles.qty, { backgroundColor: colors.secondary }]}>
                    <Feather name="package" size={12} color={colors.mutedForeground} />
                    <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "700" }}>
                      {item.quantity}x
                    </Text>
                  </View>
                  {item.rating && (
                    <View style={[styles.rating, { backgroundColor: colors.gold + "20" }]}>
                      <Feather name="star" size={12} color={colors.gold} />
                      <Text style={{ color: colors.gold, fontSize: 12, fontWeight: "700" }}>
                        {item.rating} pts
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={{ color: colors.mutedForeground, fontSize: 15 }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Adicionar Vinho</Text>
            <TouchableOpacity onPress={addWine}>
              <Text style={{ color: colors.gold, fontSize: 15, fontWeight: "700" }}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Input label="Nome do vinho *" value={form.name ?? ""} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ex: Château Margaux" />
            <Input label="Produtor *" value={form.producer ?? ""} onChangeText={(v) => setForm({ ...form, producer: v })} placeholder="Ex: Domaine Leflaive" containerStyle={{ marginTop: 14 }} />
            <Input label="Safra" value={form.vintage ?? ""} onChangeText={(v) => setForm({ ...form, vintage: v })} placeholder="Ex: 2019" keyboardType="numeric" containerStyle={{ marginTop: 14 }} />
            <Input label="Região" value={form.region ?? ""} onChangeText={(v) => setForm({ ...form, region: v })} placeholder="Ex: Bordeaux" containerStyle={{ marginTop: 14 }} />
            <Input label="Uvas" value={form.varietal ?? ""} onChangeText={(v) => setForm({ ...form, varietal: v })} placeholder="Ex: Cabernet Sauvignon" containerStyle={{ marginTop: 14 }} />
            <Input label="Quantidade" value={String(form.quantity ?? 1)} onChangeText={(v) => setForm({ ...form, quantity: parseInt(v) || 1 })} keyboardType="numeric" containerStyle={{ marginTop: 14 }} />
            <Input label="Avaliação (0-100)" value={form.rating ? String(form.rating) : ""} onChangeText={(v) => setForm({ ...form, rating: parseInt(v) || undefined })} keyboardType="numeric" containerStyle={{ marginTop: 14 }} />
            <View style={{ marginTop: 14 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Notas de degustação</Text>
              <TextInput
                style={[styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                multiline
                numberOfLines={4}
                placeholder="Suas impressões sobre o vinho..."
                placeholderTextColor={colors.mutedForeground}
                value={form.notes ?? ""}
                onChangeText={(v) => setForm({ ...form, notes: v })}
              />
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  statsBar: { flexDirection: "row", padding: 20 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statNum: { fontSize: 24, fontWeight: "900" },
  statLabel: { fontSize: 12, fontWeight: "600" },
  statDivider: { width: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: "800" },
  emptyText: { textAlign: "center", fontSize: 15 },
  wineCard: { flexDirection: "row", overflow: "hidden", borderWidth: 1 },
  wineTypeBar: { width: 5 },
  wineInfo: { flex: 1, padding: 14, gap: 4 },
  wineHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wineName: { fontSize: 16, fontWeight: "700", flex: 1 },
  wineVintage: { fontSize: 14, fontWeight: "700" },
  wineProducer: { fontSize: 13 },
  wineRegion: { fontSize: 12 },
  wineFooter: { flexDirection: "row", gap: 8, marginTop: 4 },
  qty: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  rating: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalBody: { padding: 16 },
  textarea: { borderWidth: 1.5, padding: 12, fontSize: 15, minHeight: 100, textAlignVertical: "top" },
});
