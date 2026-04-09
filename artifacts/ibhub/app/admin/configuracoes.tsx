import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";
import { useAuth } from "@/context/AuthContext";

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  iconBg: string;
  iconColor: string;
}

const FLAGS: FeatureFlag[] = [
  {
    key: "enquetes",
    label: "Habilitar Enquetes",
    description: "Permite a criação de novos posts do tipo Enquete.",
    icon: "bar-chart-2",
    iconBg: "#fef9ee",
    iconColor: "#c9a84c",
  },
  {
    key: "stories",
    label: "Habilitar Stories (Momentos)",
    description: "Se ativo, a barra de Stories aparecerá no topo do feed para todos os usuários.",
    icon: "film",
    iconBg: "#fef9ee",
    iconColor: "#c9a84c",
  },
  {
    key: "manutencao",
    label: "Modo Manutenção",
    description: 'Bloqueia o acesso ao app exibindo uma tela de manutenção.',
    icon: "alert-triangle",
    iconBg: "#f3f4f6",
    iconColor: "#6b7280",
  },
];

export default function AdminConfiguracoesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const fetchFlags = async () => {
    setLoading(true);
    setLoadError(null);
    const keys = FLAGS.map((f) => f.key);
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, enabled")
      .in("key", keys);
    if (error) {
      setLoadError("Erro ao carregar flags: " + error.message);
    } else if (data) {
      const map: Record<string, boolean> = {};
      for (const f of FLAGS) {
        const found = (data as Array<{ key: string; enabled: boolean }>).find((d) => d.key === f.key);
        map[f.key] = found ? found.enabled : false;
      }
      setFlags(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const toggle = async (key: string) => {
    const newVal = !flags[key];
    setFlags((prev) => ({ ...prev, [key]: newVal }));
    setToggling(key);
    const userId = session?.user?.id ?? null;
    const { error } = await supabase.from("feature_flags").upsert(
      { key, enabled: newVal, updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: "key" }
    );
    if (error) {
      setFlags((prev) => ({ ...prev, [key]: !newVal }));
    }
    setToggling(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Configurações</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroRow}>
          <Feather name="settings" size={22} color={colors.gold} />
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Configurações do Sistema</Text>
        </View>
        <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
          Gerencie funcionalidades globais do aplicativo sem precisar atualizar o código.
        </Text>

        {/* Feature Flags card */}
        <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.navy }]}>Gestão de Funcionalidades (Feature Flags)</Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
            Ligue ou desligue módulos inteiros do aplicativo globalmente. As alterações são aplicadas imediatamente para todos os usuários.
          </Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.gold} style={{ marginTop: 8 }} />
          ) : loadError ? (
            <Text style={[styles.cardDesc, { color: "#e74c3c" }]}>{loadError}</Text>
          ) : (
            FLAGS.map((flag, i) => (
              <View
                key={flag.key}
                style={[
                  styles.flagRow,
                  { borderTopColor: colors.border },
                  i === 0 && { borderTopWidth: 1, marginTop: 4 },
                ]}
              >
                <View style={[styles.flagIcon, { backgroundColor: flag.iconBg }]}>
                  <Feather name={flag.icon} size={18} color={flag.iconColor} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.flagLabel, { color: colors.navy }]}>{flag.label}</Text>
                  <Text style={[styles.flagDesc, { color: colors.mutedForeground }]}>{flag.description}</Text>
                </View>
                <View style={styles.switchWrap}>
                  {toggling === flag.key ? (
                    <ActivityIndicator size="small" color={colors.navy} />
                  ) : (
                    <>
                      <Text style={[styles.switchLabel, { color: flags[flag.key] ? colors.navy : colors.mutedForeground }]}>
                        {flags[flag.key] ? "ON" : "OFF"}
                      </Text>
                      <Switch
                        value={!!flags[flag.key]}
                        onValueChange={() => toggle(flag.key)}
                        trackColor={{ false: colors.border, true: colors.navy }}
                        thumbColor="#fff"
                      />
                    </>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Informações */}
        <View style={[styles.infoCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.navy }]}>Informações</Text>
          <View style={styles.bulletRow}>
            <Text style={[styles.bulletDot, { color: colors.foreground }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.foreground }]}>
              <Text style={{ fontWeight: "700" }}>Feature Flags</Text> permitem controlar funcionalidades sem deploy.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={[styles.bulletDot, { color: colors.foreground }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.foreground }]}>
              O <Text style={{ fontWeight: "700" }}>Modo Manutenção</Text> exibe uma tela de "Voltamos já" para todos os usuários não-admin.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={[styles.bulletDot, { color: colors.foreground }]}>•</Text>
            <Text style={[styles.bulletText, { color: colors.foreground }]}>
              Alterações são <Text style={{ fontWeight: "700" }}>instantâneas</Text> e afetam todos os usuários ativos.
            </Text>
          </View>
        </View>
      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/configuracoes" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  heroRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  heroTitle:   { fontSize: 20, fontWeight: "800", flex: 1 },
  heroSub:     { fontSize: 13, lineHeight: 19, marginTop: -6 },
  card:        { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  cardTitle:   { fontSize: 15, fontWeight: "700" },
  cardDesc:    { fontSize: 13, lineHeight: 19 },
  flagRow:     { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingTop: 14, borderTopWidth: 1 },
  flagIcon:    { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  flagLabel:   { fontSize: 14, fontWeight: "600" },
  flagDesc:    { fontSize: 12, lineHeight: 17 },
  switchWrap:  { alignItems: "center", gap: 3, minWidth: 52 },
  switchLabel: { fontSize: 10, fontWeight: "700" },
  infoCard:    { borderRadius: 12, borderWidth: 1, padding: 16, gap: 10 },
  infoTitle:   { fontSize: 16, fontWeight: "700" },
  bulletRow:   { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bulletDot:   { fontSize: 14, marginTop: 1 },
  bulletText:  { flex: 1, fontSize: 13, lineHeight: 19 },
});
