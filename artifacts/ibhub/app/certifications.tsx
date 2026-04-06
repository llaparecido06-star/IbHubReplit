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
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useColors } from "@/hooks/useColors";

interface Certification {
  id: string;
  name: string;
  issuer: string;
  year?: string;
  level?: string;
  certificate_url?: string;
  added_at: string;
}

const STORAGE_KEY = "ibhub_certifications";

const CERT_OPTIONS = [
  { name: "WSET Level 1", issuer: "WSET" },
  { name: "WSET Level 2", issuer: "WSET" },
  { name: "WSET Level 3", issuer: "WSET" },
  { name: "WSET Level 4 – Diploma", issuer: "WSET" },
  { name: "CMS Introductory Sommelier", issuer: "Court of Master Sommeliers" },
  { name: "CMS Certified Sommelier", issuer: "Court of Master Sommeliers" },
  { name: "CMS Advanced Sommelier", issuer: "Court of Master Sommeliers" },
  { name: "Master Sommelier", issuer: "Court of Master Sommeliers" },
  { name: "ABEV Sommelier", issuer: "ABEV" },
  { name: "ISA Sommelier", issuer: "ISA" },
  { name: "Enólogo – Bacharelado", issuer: "Universidade" },
  { name: "Outro", issuer: "" },
];

export default function CertificationsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [certs, setCerts] = useState<Certification[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", issuer: "", year: "" });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setCerts(JSON.parse(val));
    });
  }, []);

  const save = async (updated: Certification[]) => {
    setCerts(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const addCert = async () => {
    if (!form.name) return;
    const cert: Certification = {
      id: Date.now().toString(),
      name: form.name,
      issuer: form.issuer,
      year: form.year,
      added_at: new Date().toISOString(),
    };
    await save([cert, ...certs]);
    setShowModal(false);
    setForm({ name: "", issuer: "", year: "" });
  };

  const removeCert = async (id: string) => {
    await save(certs.filter((c) => c.id !== id));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Certificações</Text>
        <TouchableOpacity onPress={() => setShowModal(true)}>
          <Feather name="plus" size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {certs.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.gold + "20" }]}>
            <Feather name="award" size={36} color={colors.gold} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Nenhuma certificação
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Adicione suas certificações profissionais de vinho
          </Text>
          <Button title="Adicionar certificação" onPress={() => setShowModal(true)} variant="gold" />
        </View>
      ) : (
        <FlatList
          data={certs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.certCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <View style={[styles.certIcon, { backgroundColor: colors.gold + "20" }]}>
                <Feather name="award" size={22} color={colors.gold} />
              </View>
              <View style={styles.certInfo}>
                <Text style={[styles.certName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.certIssuer, { color: colors.mutedForeground }]}>{item.issuer}</Text>
                {item.year && (
                  <Text style={[styles.certYear, { color: colors.mutedForeground }]}>
                    Obtido em {item.year}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => removeCert(item.id)} style={{ padding: 4 }}>
                <Feather name="trash-2" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={{ color: colors.mutedForeground }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Adicionar Certificação</Text>
            <TouchableOpacity onPress={addCert}>
              <Text style={{ color: colors.gold, fontWeight: "700" }}>Salvar</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Certificações populares</Text>
            {CERT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.name}
                style={[
                  styles.optionRow,
                  { borderBottomColor: colors.border },
                  form.name === opt.name && { backgroundColor: colors.gold + "10" },
                ]}
                onPress={() => setForm({ ...form, name: opt.name, issuer: opt.issuer })}
              >
                <Text style={[styles.optionText, { color: form.name === opt.name ? colors.gold : colors.foreground }]}>
                  {opt.name}
                </Text>
                {form.name === opt.name && (
                  <Feather name="check" size={18} color={colors.gold} />
                )}
              </TouchableOpacity>
            ))}
            <Input
              label="Ano de obtenção"
              value={form.year}
              onChangeText={(v) => setForm({ ...form, year: v })}
              keyboardType="numeric"
              placeholder="Ex: 2023"
              containerStyle={{ marginTop: 16 }}
            />
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "800" },
  emptyText: { textAlign: "center", fontSize: 15 },
  certCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, padding: 14, gap: 12 },
  certIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  certInfo: { flex: 1, gap: 2 },
  certName: { fontSize: 15, fontWeight: "700" },
  certIssuer: { fontSize: 13 },
  certYear: { fontSize: 12, marginTop: 2 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  modalBody: { padding: 16 },
  sectionLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1 },
  optionText: { fontSize: 15, fontWeight: "500" },
});
