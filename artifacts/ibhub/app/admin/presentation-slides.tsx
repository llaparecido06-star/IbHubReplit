import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@/components/ui/Icon";
import AdminDrawer from "@/components/AdminDrawer";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { fetchAllMarketPresentations, type MarketPresentation } from "@/services/api";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

interface Slide {
  id: string;
  presentation_id: string;
  storage_path: string;
  sequence_order: number;
  created_at: string;
  preview_url?: string;
}

export default function AdminPresentationSlidesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  const [presentations, setPresentations] = useState<MarketPresentation[]>([]);
  const [selectedPresentation, setSelectedPresentation] = useState<MarketPresentation | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loadingPresentations, setLoadingPresentations] = useState(true);
  const [loadingSlides, setLoadingSlides] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const loadPresentations = useCallback(async () => {
    setLoadingPresentations(true);
    const data = await fetchAllMarketPresentations();
    setPresentations(data);
    setLoadingPresentations(false);
  }, []);

  useEffect(() => { loadPresentations(); }, [loadPresentations]);

  const loadSlides = useCallback(async (presentationId: string) => {
    setLoadingSlides(true);
    try {
      const { data, error } = await supabase
        .from("slides")
        .select("*")
        .eq("presentation_id", presentationId)
        .order("sequence_order", { ascending: true });

      if (error) throw error;
      const rawSlides = (data ?? []) as Slide[];
      setSlides(rawSlides);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível carregar os slides.");
    } finally {
      setLoadingSlides(false);
    }
  }, []);

  const selectPresentation = (p: MarketPresentation) => {
    setSelectedPresentation(p);
    setSlides([]);
    loadSlides(p.id);
  };

  const handleUploadSlides = async () => {
    if (!selectedPresentation) return;
    const token = session?.access_token;
    if (!token) {
      Alert.alert("Erro", "Sessão expirada. Faça login novamente.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 20,
    });

    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    const maxOrder = slides.length > 0 ? Math.max(...slides.map(s => s.sequence_order)) + 1 : 0;
    const nextOrder = maxOrder;
    const total = result.assets.length;
    let done = 0;

    for (let i = 0; i < result.assets.length; i++) {
      const asset = result.assets[i];
      const seqOrder = nextOrder + i;
      const ext = asset.uri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "jpg";
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      const filename = `slide_${Date.now()}_${i}.${ext}`;
      const storagePath = `${selectedPresentation.id}/${seqOrder}_${filename}`;

      try {
        const response = await fetch(asset.uri);
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        const { error: uploadErr } = await supabase.storage
          .from("presentation-slides")
          .upload(storagePath, bytes, { contentType: mime, upsert: false });

        if (uploadErr) {
          console.error("Upload error:", uploadErr.message);
          Alert.alert("Aviso", `Falha ao enviar slide ${i + 1}: ${uploadErr.message}`);
          done++;
          setUploadProgress(Math.round((done / total) * 100));
          continue;
        }

        const { error: insertErr } = await supabase.from("slides").insert({
          presentation_id: selectedPresentation.id,
          storage_path: storagePath,
          sequence_order: seqOrder,
        });

        if (insertErr) {
          console.error("Insert error:", insertErr.message);
          await supabase.storage.from("presentation-slides").remove([storagePath]).catch(() => {});
          Alert.alert("Aviso", `Falha ao registrar slide ${i + 1}: ${insertErr.message}`);
        }
      } catch (e) {
        console.error("Slide upload exception:", e);
      }
      done++;
      setUploadProgress(Math.round((done / total) * 100));
    }

    setUploading(false);
    setUploadProgress(0);
    loadSlides(selectedPresentation.id);
    Alert.alert("Concluído", `${done} slide(s) processado(s).`);
  };

  const handleDeleteSlide = (slide: Slide) => {
    Alert.alert(
      "Remover slide",
      `Remover o slide #${slide.sequence_order + 1}? Esta ação é irreversível.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover", style: "destructive",
          onPress: async () => {
            await supabase.storage.from("presentation-slides").remove([slide.storage_path]).catch(() => {});
            const { error } = await supabase.from("slides").delete().eq("id", slide.id);
            if (error) {
              Alert.alert("Erro", error.message);
            } else {
              setSlides(prev => prev.filter(s => s.id !== slide.id));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)}>
          <Feather name="menu" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>Slides de Apresentações</Text>
        <TouchableOpacity onPress={loadPresentations}>
          <Feather name="refresh-cw" size={20} color={colors.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: bottomPad, gap: 16 }} showsVerticalScrollIndicator={false}>

        {/* Seletor de apresentação */}
        <View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SELECIONAR APRESENTAÇÃO</Text>
          {loadingPresentations ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 12 }} />
          ) : presentations.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Nenhuma apresentação cadastrada. Crie uma em Slides de Mercado.
            </Text>
          ) : (
            <View style={{ gap: 8, marginTop: 8 }}>
              {presentations.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.presentationItem,
                    { borderColor: selectedPresentation?.id === p.id ? colors.gold : colors.border, backgroundColor: "#fff" },
                    selectedPresentation?.id === p.id && { backgroundColor: colors.gold + "08" },
                  ]}
                  onPress={() => selectPresentation(p)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.presentationTitle, { color: colors.navy }]}>{p.title}</Text>
                    {p.description ? (
                      <Text style={[styles.presentationDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{p.description}</Text>
                    ) : null}
                    <Text style={[styles.presentationMeta, { color: colors.mutedForeground }]}>
                      {p.published ? "Publicada" : "Rascunho"}
                    </Text>
                  </View>
                  {selectedPresentation?.id === p.id && (
                    <Feather name="check-circle" size={18} color={colors.gold} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Gerenciar slides */}
        {selectedPresentation && (
          <View style={{ gap: 12 }}>
            <View style={styles.slidesHeader}>
              <View>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SLIDES</Text>
                <Text style={[styles.slideCount, { color: colors.navy }]}>
                  {slides.length} slide{slides.length !== 1 ? "s" : ""} cadastrado{slides.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.uploadBtn, { backgroundColor: uploading ? colors.gold + "80" : colors.gold }]}
                onPress={handleUploadSlides}
                disabled={uploading}
              >
                {uploading ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.uploadBtnText}>{uploadProgress}%</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Feather name="upload" size={16} color="#fff" />
                    <Text style={styles.uploadBtnText}>Upload em Lote</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {loadingSlides ? (
              <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
            ) : slides.length === 0 ? (
              <View style={[styles.emptySlides, { backgroundColor: "#fff", borderColor: colors.border }]}>
                <Feather name="image" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>
                  Nenhum slide ainda.{"\n"}Use "Upload em Lote" para adicionar imagens.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {slides.map((slide, idx) => (
                  <View key={slide.id} style={[styles.slideRow, { backgroundColor: "#fff", borderColor: colors.border }]}>
                    <View style={[styles.slideIndex, { backgroundColor: colors.gold + "18" }]}>
                      <Text style={[styles.slideIndexText, { color: colors.gold }]}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.slidePath, { color: colors.foreground }]} numberOfLines={1}>
                        {slide.storage_path.split("/").pop()}
                      </Text>
                      <Text style={[styles.slideMeta, { color: colors.mutedForeground }]}>
                        Ordem: {slide.sequence_order} · {new Date(slide.created_at).toLocaleDateString("pt-BR")}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteSlide(slide)} style={styles.deleteBtn}>
                      <Feather name="trash-2" size={18} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      <AdminDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} activeRoute="/admin/presentation-slides" />
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:        { fontSize: 18, fontWeight: "700" },
  sectionLabel:       { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 4 },
  presentationItem:   { borderWidth: 1.5, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  presentationTitle:  { fontSize: 15, fontWeight: "700" },
  presentationDesc:   { fontSize: 12, marginTop: 2 },
  presentationMeta:   { fontSize: 11, marginTop: 4, fontStyle: "italic" },
  slidesHeader:       { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  slideCount:         { fontSize: 16, fontWeight: "700", marginTop: 2 },
  uploadBtn:          { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10 },
  uploadBtnText:      { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptySlides:        { borderWidth: 1, borderRadius: 12, padding: 32, alignItems: "center", gap: 12, borderStyle: "dashed" },
  emptyText:          { fontSize: 13, lineHeight: 19 },
  slideRow:           { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 12 },
  slideIndex:         { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  slideIndexText:     { fontSize: 15, fontWeight: "800" },
  slidePath:          { fontSize: 13, fontWeight: "600" },
  slideMeta:          { fontSize: 11, marginTop: 2 },
  deleteBtn:          { padding: 6 },
});
