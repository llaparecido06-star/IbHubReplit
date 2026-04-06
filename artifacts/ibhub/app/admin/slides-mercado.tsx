import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";

const MAIN_TABS  = ["Slides", "Dados de Mercado"];
const DATA_TYPES = ["Todos", "Indicador", "Tendência", "Região", "Variedade"];
const BG_COLORS  = ["Accent", "Primário", "Escuro", "Branco"];

export default function AdminSlidesMercadoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [mainTab, setMainTab]         = useState("Slides");
  const [dataType, setDataType]       = useState("Todos");
  const [showModal, setShowModal]     = useState(false);

  // Modal state
  const [titulo, setTitulo]       = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [conteudo, setConteudo]   = useState("");
  const [bgColor, setBgColor]     = useState("Accent");
  const [bgOpen, setBgOpen]       = useState(false);
  const [ativo, setAtivo]         = useState(true);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Slides Mercado</Text>
        <TouchableOpacity>
          <Feather name="bell" size={22} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={{ gap: 4 }}>
          <Text style={[styles.heroTitle, { color: colors.navy }]}>Mercado</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Gerencie apresentações e dados de inteligência de mercado
          </Text>
        </View>

        {/* Main tabs */}
        <View style={[styles.mainTabs, { backgroundColor: "#f3f4f6", borderColor: colors.border }]}>
          {MAIN_TABS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.mainTab, t === mainTab && { backgroundColor: "#fff" }]}
              onPress={() => setMainTab(t)}
            >
              <Feather
                name={t === "Slides" ? "monitor" : "bar-chart-2"}
                size={13}
                color={t === mainTab ? colors.navy : colors.mutedForeground}
              />
              <Text style={[styles.mainTabText, { color: t === mainTab ? colors.navy : colors.mutedForeground, fontWeight: t === mainTab ? "700" : "400" }]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mainTab === "Slides" ? (
          <>
            {/* Slides count + button */}
            <View style={styles.slidesRow}>
              <Text style={[styles.slidesCount, { color: colors.mutedForeground }]}>0 slides</Text>
              <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.navy }]} onPress={() => setShowModal(true)}>
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.newBtnText}>Novo Slide</Text>
              </TouchableOpacity>
            </View>
            {/* Empty */}
            <View style={styles.empty}>
              <Feather name="monitor" size={40} color="#d1d5db" />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nenhum slide encontrado</Text>
            </View>
          </>
        ) : (
          <>
            {/* Data sub-type filter chips */}
            <View style={styles.chipRow}>
              {DATA_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, { borderColor: t === dataType ? colors.navy : colors.border, backgroundColor: t === dataType ? colors.navy : "#fff" }]}
                  onPress={() => setDataType(t)}
                >
                  <Text style={[styles.chipText, { color: t === dataType ? "#fff" : colors.foreground }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.newBtn, { backgroundColor: colors.navy, alignSelf: "flex-start" }]}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.newBtnText}>Novo Dado</Text>
            </TouchableOpacity>
            {/* Empty */}
            <View style={[styles.emptyCard, { backgroundColor: "#fff", borderColor: colors.border }]}>
              <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
                Nenhum dado encontrado. Adicione indicadores, tendências, regiões e variedades.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Novo Slide Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: "#fff" }]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowModal(false)}>
              <Feather name="x" size={18} color="#6b7280" />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.navy }]}>Novo Slide</Text>

            <View style={styles.mField}>
              <Text style={[styles.mLabel, { color: colors.foreground }]}>Título *</Text>
              <TextInput
                style={[styles.mInput, { borderColor: colors.gold, borderWidth: 1.5 }]}
                value={titulo}
                onChangeText={setTitulo}
                autoFocus
              />
            </View>
            <View style={styles.mField}>
              <Text style={[styles.mLabel, { color: colors.foreground }]}>Subtítulo</Text>
              <TextInput
                style={[styles.mInput, { borderColor: colors.border, borderWidth: 1 }]}
                value={subtitulo}
                onChangeText={setSubtitulo}
              />
            </View>
            <View style={styles.mField}>
              <Text style={[styles.mLabel, { color: colors.foreground }]}>Conteúdo (HTML)</Text>
              <TextInput
                style={[styles.mInput, styles.mTextarea, { borderColor: colors.border, borderWidth: 1 }]}
                value={conteudo}
                onChangeText={setConteudo}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View style={styles.mField}>
              <Text style={[styles.mLabel, { color: colors.foreground }]}>Cor de Fundo</Text>
              <TouchableOpacity
                style={[styles.mSelect, { borderColor: colors.border }]}
                onPress={() => setBgOpen(!bgOpen)}
              >
                <View style={[styles.colorDot, { backgroundColor: "#e5e7eb" }]} />
                <Text style={[styles.mSelectText, { color: colors.foreground }]}>{bgColor}</Text>
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
              {bgOpen && (
                <View style={[styles.mDropdown, { backgroundColor: "#fff", borderColor: colors.border }]}>
                  {BG_COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.mDropItem, { borderBottomColor: colors.border }, c === bgColor && { backgroundColor: colors.gold + "12" }]}
                      onPress={() => { setBgColor(c); setBgOpen(false); }}
                    >
                      <Text style={[styles.mDropText, { color: c === bgColor ? colors.gold : colors.foreground }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.mSwitchRow}>
              <Text style={[styles.mLabel, { color: colors.foreground }]}>Ativo</Text>
              <Switch
                value={ativo}
                onValueChange={setAtivo}
                trackColor={{ false: colors.border, true: colors.navy }}
                thumbColor="#fff"
              />
            </View>
            <TouchableOpacity style={[styles.mSaveBtn, { backgroundColor: colors.navy }]} onPress={() => setShowModal(false)}>
              <Text style={styles.mSaveBtnText}>Salvar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mCancelBtn} onPress={() => setShowModal(false)}>
              <Text style={[styles.mCancelText, { color: colors.foreground }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/slides-mercado" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:   { fontSize: 18, fontWeight: "700" },
  heroTitle:     { fontSize: 22, fontWeight: "800" },
  heroSub:       { fontSize: 13, lineHeight: 18 },
  mainTabs:      { flexDirection: "row", borderRadius: 10, padding: 4, gap: 4 },
  mainTab:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8 },
  mainTabText:   { fontSize: 13 },
  slidesRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  slidesCount:   { fontSize: 13 },
  newBtn:        { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  newBtnText:    { color: "#fff", fontSize: 14, fontWeight: "700" },
  chipRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:          { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  chipText:      { fontSize: 13 },
  empty:         { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText:     { fontSize: 14, color: "#9ca3af" },
  emptyCard:     { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center" },
  emptyCardText: { fontSize: 13, textAlign: "center", lineHeight: 20 },
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal:         { width: "100%", maxWidth: 380, borderRadius: 16, padding: 20, gap: 14 },
  modalClose:    { position: "absolute", top: 14, right: 14 },
  modalTitle:    { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  mField:        { gap: 6 },
  mLabel:        { fontSize: 13, fontWeight: "600" },
  mInput:        { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  mTextarea:     { height: 80, textAlignVertical: "top" },
  mSelect:       { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  colorDot:      { width: 18, height: 18, borderRadius: 9 },
  mSelectText:   { flex: 1, fontSize: 14 },
  mDropdown:     { position: "absolute", top: 48, left: 0, right: 0, borderRadius: 8, borderWidth: 1, zIndex: 99, overflow: "hidden" },
  mDropItem:     { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  mDropText:     { fontSize: 14 },
  mSwitchRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mSaveBtn:      { paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  mSaveBtnText:  { color: "#fff", fontSize: 15, fontWeight: "700" },
  mCancelBtn:    { paddingVertical: 12, alignItems: "center" },
  mCancelText:   { fontSize: 15 },
});
