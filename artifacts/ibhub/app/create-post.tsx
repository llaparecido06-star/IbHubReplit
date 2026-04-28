import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Feather, MaterialCommunityIcons } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { createPost, uploadPostImage, uploadPostVideo, addWineEntry, canPublishAsCompany } from "@/services/api";

const HASHTAG_SUGGESTIONS = [
  "vinho", "sommelier", "enologia", "degustação",
  "harmonização", "vinícola", "enoturismo", "wset",
];

type PostMode = "normal" | "degustacao";

const SCORE_LABELS: Record<string, string> = {
  "": "",
  "50": "50 — Inaceitável",
  "60": "60 — Abaixo da média",
  "70": "70 — Mediano",
  "75": "75 — Aceitável",
  "80": "80 — Bom",
  "85": "85 — Muito Bom",
  "88": "88 — Excelente",
  "90": "90 — Notável",
  "92": "92 — Excepcional",
  "95": "95 — Extraordinário",
  "98": "98 — Lendário",
  "100": "100 — Perfeito",
};
const SCORE_OPTIONS = ["", "50", "60", "70", "75", "80", "85", "88", "90", "92", "95", "98", "100"];

function AutoPlayVideoPreview({ uri, style }: { uri: string; style?: object }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  return <VideoView player={player} contentFit="cover" style={style as any} />;
}

export default function CreatePostScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, user, activeCompany } = useAuth();
  const insets = useSafeAreaInsets();
  const { companyPageId, companyName } = useLocalSearchParams<{ companyPageId?: string; companyName?: string }>();

  // Prefer activeCompany from auth context; fall back to route params for direct deep-links
  const isCompanyPost      = !!(activeCompany || companyPageId);
  const companyDisplayName = activeCompany?.name ?? companyName ?? "Empresa";
  const companyAvatarUrl   = activeCompany?.avatar_url ?? null;
  const effectiveCompanyId = activeCompany?.id ?? companyPageId ?? null;

  const [mode, setMode] = useState<PostMode>("normal");

  // Normal post state
  const [content, setContent]               = useState("");
  const [imageUris, setImageUris]           = useState<string[]>([]);
  const [videoUri, setVideoUri]             = useState<string | null>(null);
  const [location, setLocation]             = useState("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [selectedHashtags, setSelectedHashtags]   = useState<string[]>([]);
  const [posting, setPosting]               = useState(false);
  const [gpsLoading, setGpsLoading]         = useState(false);

  // Tasting note state
  const [tastingWine, setTastingWine]         = useState("");
  const [tastingProducer, setTastingProducer] = useState("");
  const [tastingGrape, setTastingGrape]       = useState("");
  const [tastingVintage, setTastingVintage]   = useState("");
  const [tastingEan, setTastingEan]           = useState("");
  const [tastingScore, setTastingScore]       = useState("");
  const [tastingAroma, setTastingAroma]       = useState("");
  const [tastingFlavor, setTastingFlavor]     = useState("");
  const [tastingPair, setTastingPair]         = useState("");
  const [tastingNotes, setTastingNotes]       = useState("");
  const [showScorePicker, setShowScorePicker] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleAddImage = async () => {
    if (videoUri) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImageUris(prev => {
        const combined = [...prev, ...result.assets.map(a => a.uri)];
        return combined.slice(0, 5);
      });
    }
  };

  const handleAddVideo = async () => {
    if (imageUris.length > 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const removeVideo = () => setVideoUri(null);

  const removeImage = (idx: number) => {
    setImageUris(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleGpsLocation = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permissão negada",
          "Para usar o GPS, ative a permissão de localização nas configurações do seu dispositivo."
        );
        return;
      }
      const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [result] = await Location.reverseGeocodeAsync({
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
      });
      if (result) {
        const parts = [result.district ?? result.subregion, result.city ?? result.region].filter(Boolean);
        const locationName = parts.join(", ") || result.formattedAddress || "";
        setLocation(locationName);
        if (!showLocationInput) setShowLocationInput(true);
      } else {
        Alert.alert("Localização não encontrada", "Não foi possível determinar o nome do local. Tente digitar manualmente.");
      }
    } catch {
      Alert.alert("Erro de GPS", "Não foi possível obter a localização. Verifique se o GPS está ativo e tente novamente.");
    } finally {
      setGpsLoading(false);
    }
  };

  const buildTastingContent = () => {
    const lines: string[] = [];
    lines.push(`🍷 Degustação: ${tastingWine.trim()}`);
    if (tastingProducer.trim()) lines.push(`🏠 Produtor: ${tastingProducer.trim()}`);
    if (tastingGrape.trim())    lines.push(`🌿 Uva/Casta: ${tastingGrape.trim()}`);
    if (tastingVintage.trim())  lines.push(`📅 Safra: ${tastingVintage.trim()}`);
    if (tastingEan.trim())      lines.push(`🏷️ EAN: ${tastingEan.trim()}`);
    if (tastingScore)           lines.push(`⭐ Pontuação: ${tastingScore}/100`);
    if (tastingAroma.trim())    lines.push(`👃 Aroma: ${tastingAroma.trim()}`);
    if (tastingFlavor.trim())   lines.push(`👅 Sabor: ${tastingFlavor.trim()}`);
    if (tastingPair.trim())     lines.push(`🍽️ Harmonização: ${tastingPair.trim()}`);
    if (tastingNotes.trim())    lines.push(`📝 Notas: ${tastingNotes.trim()}`);
    return lines.join("\n");
  };

  /**
   * Converts a 100-point wine score to a 1–5 star rating.
   * Used when inserting the tasting note into the community ranking.
   */
  const scoreToStars = (score: string): number => {
    const n = parseInt(score, 10);
    if (isNaN(n)) return 0;
    return Math.max(1, Math.min(5, Math.round(n / 20)));
  };

  const handlePost = async () => {
    if (!user?.id) return;
    let finalContent = "";
    if (mode === "normal") {
      finalContent = content.trim();
    } else {
      if (!tastingWine.trim() || !tastingGrape.trim() || !tastingVintage.trim() || !tastingEan.trim()) return;
      finalContent = buildTastingContent();
    }
    if (!finalContent) return;
    setPosting(true);
    try {
      let uploadedUrls: string[] = [];
      let uploadedVideoUrl: string | null = null;
      if (imageUris.length > 0 && mode === "normal") {
        const uploads = await Promise.all(imageUris.map(uri => uploadPostImage(uri, user.id)));
        uploadedUrls = uploads.filter(Boolean) as string[];
      }
      if (videoUri && mode === "normal") {
        uploadedVideoUrl = await uploadPostVideo(videoUri, user.id);
      }
      const hashtags = mode === "degustacao"
        ? ["degustação", "vinho", ...(selectedHashtags)]
        : selectedHashtags;
      await createPost({
        user_id: user.id,
        content: finalContent,
        image_url: uploadedUrls[0] ?? null,
        image_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        video_url: uploadedVideoUrl,
        location: location.trim() || null,
        hashtags: hashtags.length > 0 ? hashtags : undefined,
        company_page_id: effectiveCompanyId,
      });

      // Se a degustação tem EAN + pontuação, insere na adega como pública
      // para alimentar o ranking comunitário automaticamente.
      if (mode === "degustacao" && tastingEan.trim() && tastingScore) {
        const stars = scoreToStars(tastingScore);
        if (stars > 0) {
          await addWineEntry({
            user_id: user.id,
            name: tastingWine.trim(),
            producer: tastingProducer.trim() || null,
            vintage: tastingVintage.trim() || null,
            region: null,
            country: null,
            grape: tastingGrape.trim() || null,
            ean: tastingEan.trim(),
            qty: 1,
            price: null,
            buy_date: null,
            drink_by: null,
            storage: null,
            notes: tastingNotes.trim() || null,
            aroma: tastingAroma.trim() || null,
            sabor: tastingFlavor.trim() || null,
            harmonizacao: tastingPair.trim() || null,
            score_100: tastingScore ? Math.max(0, Math.min(100, parseInt(tastingScore) || 0)) : null,
            rating: stars,
            status: "consumido",
            is_private: false,
          });
        }
      }

      router.back();
    } catch {
      Alert.alert("Erro de Conexão", "Não foi possível publicar. Verifique sua conexão e tente novamente.");
    } finally {
      setPosting(false);
    }
  };

  const roleBlocksPosting = !!activeCompany && !canPublishAsCompany(activeCompany.role);
  const canPost = !roleBlocksPosting && (mode === "normal"
    ? content.trim().length > 0 && !posting
    : tastingWine.trim().length > 0 && tastingGrape.trim().length > 0 && tastingVintage.trim().length > 0 && tastingEan.trim().length > 0 && !posting);

  const charCount = content.length;
  const maxChars = 1000;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Nova publicação</Text>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: canPost ? colors.gold : colors.secondary }]}
          onPress={handlePost}
          disabled={!canPost}
        >
          <Text style={{ color: canPost ? colors.navy : colors.mutedForeground, fontWeight: "700", fontSize: 14 }}>
            {posting ? "Publicando..." : "Publicar"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Visualizador cannot publish as company */}
      {roleBlocksPosting && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fcd34d" }}>
          <Feather name="lock" size={14} color="#92400e" />
          <Text style={{ flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 }}>
            Seu papel de Visualizador não permite publicar conteúdo como essa empresa.
          </Text>
        </View>
      )}

      {/* Mode selector */}
      <View style={[styles.modeRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "normal" && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
          onPress={() => setMode("normal")}
        >
          <Feather name="edit-3" size={14} color={mode === "normal" ? colors.gold : colors.mutedForeground} />
          <Text style={[styles.modeBtnText, { color: mode === "normal" ? colors.gold : colors.mutedForeground }]}>
            Publicação
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === "degustacao" && { borderBottomColor: colors.gold, borderBottomWidth: 2 }]}
          onPress={() => setMode("degustacao")}
        >
          <MaterialCommunityIcons name="glass-wine" size={14} color={mode === "degustacao" ? colors.gold : colors.mutedForeground} />
          <Text style={[styles.modeBtnText, { color: mode === "degustacao" ? colors.gold : colors.mutedForeground }]}>
            Degustação
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.authorRow}>
          <Avatar
            uri={isCompanyPost ? companyAvatarUrl : profile?.avatar_url}
            name={isCompanyPost ? companyDisplayName : profile?.full_name}
            size={44}
          />
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: colors.foreground }]}>
              {isCompanyPost ? companyDisplayName : (profile?.full_name ?? "Você")}
            </Text>
            <View style={[styles.audienceBtn, { backgroundColor: colors.secondary, borderRadius: 12 }]}>
              <Feather name="globe" size={11} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "600" }}>Todos</Text>
              <Feather name="chevron-down" size={11} color={colors.mutedForeground} />
            </View>
          </View>
        </View>

        {/* ── Normal post ── */}
        {mode === "normal" && (
          <>
            <TextInput
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder="Compartilhe algo sobre vinho, eventos, oportunidades..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              value={content}
              onChangeText={setContent}
              maxLength={maxChars}
              autoFocus
            />

            {showLocationInput && (
              <View style={[styles.locationRow, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Feather name="map-pin" size={15} color={colors.gold} />
                <TextInput
                  style={[styles.locationInput, { color: colors.foreground }]}
                  placeholder="Ex: Serra Gaúcha, Rio Grande do Sul"
                  placeholderTextColor={colors.mutedForeground}
                  value={location}
                  onChangeText={setLocation}
                  returnKeyType="done"
                  maxLength={80}
                />
                {gpsLoading ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <TouchableOpacity onPress={handleGpsLocation} style={styles.gpsBtn}>
                    <Feather name="crosshair" size={17} color={colors.gold} />
                  </TouchableOpacity>
                )}
                {location.length > 0 && !gpsLoading && (
                  <TouchableOpacity onPress={() => setLocation("")}>
                    <Feather name="x" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {videoUri && (
              <View style={[styles.videoPreviewWrap, { borderRadius: colors.radius ?? 10 }]}>
                <AutoPlayVideoPreview uri={videoUri} style={styles.videoPreview} />
                <TouchableOpacity style={styles.removeThumb} onPress={removeVideo}>
                  <Feather name="x" size={12} color="#ffffff" />
                </TouchableOpacity>
                <View style={styles.videoIconOverlay}>
                  <Feather name="video" size={16} color="#fff" />
                </View>
              </View>
            )}

            {imageUris.length > 0 && !videoUri && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageRow} contentContainerStyle={{ gap: 8 }}>
                {imageUris.map((uri, idx) => (
                  <View key={uri} style={{ position: "relative" }}>
                    <Image source={{ uri }} style={[styles.thumbImg, { borderRadius: colors.radius }]} contentFit="cover" />
                    <TouchableOpacity style={styles.removeThumb} onPress={() => removeImage(idx)}>
                      <Feather name="x" size={12} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {imageUris.length < 5 && (
                  <TouchableOpacity style={[styles.addMoreBtn, { borderColor: colors.border }]} onPress={handleAddImage}>
                    <Feather name="plus" size={22} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}

            <View style={styles.hashtagSection}>
              <Text style={[styles.hashtagLabel, { color: colors.mutedForeground }]}>Hashtags populares</Text>
              <View style={styles.hashtagChips}>
                {HASHTAG_SUGGESTIONS.map((tag) => (
                  <Pressable
                    key={tag}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selectedHashtags.includes(tag) ? colors.gold + "20" : colors.secondary,
                        borderColor: selectedHashtags.includes(tag) ? colors.gold : "transparent",
                        borderRadius: 20,
                        borderWidth: 1.5,
                      },
                    ]}
                    onPress={() => toggleHashtag(tag)}
                  >
                    <Text style={[styles.chipText, { color: selectedHashtags.includes(tag) ? colors.gold : colors.foreground }]}>
                      #{tag}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── Tasting note ── */}
        {mode === "degustacao" && (
          <View style={styles.tastingForm}>
            <View style={[styles.tastingHero, { backgroundColor: colors.gold + "10", borderColor: colors.gold + "30", borderWidth: 1, borderRadius: 12 }]}>
              <MaterialCommunityIcons name="glass-wine" size={32} color={colors.gold} />
              <View>
                <Text style={[styles.tastingHeroTitle, { color: colors.navy }]}>Nota de Degustação</Text>
                <Text style={[styles.tastingHeroSub, { color: colors.mutedForeground }]}>Compartilhe sua avaliação profissional</Text>
              </View>
            </View>

            <Text style={{ fontSize: 10, color: colors.gold, marginBottom: -4 }}>* Campos obrigatórios para publicar</Text>
            <TextInput
              style={[styles.tastingInput, { borderColor: colors.gold + "80", color: colors.foreground, backgroundColor: "#fff" }]}
              placeholder="Nome do vinho *"
              placeholderTextColor={colors.mutedForeground}
              value={tastingWine}
              onChangeText={setTastingWine}
              autoFocus
            />
            <View style={styles.tastingRow}>
              <TextInput
                style={[styles.tastingInput, { flex: 1, borderColor: colors.gold + "80", color: colors.foreground, backgroundColor: "#fff" }]}
                placeholder="Uva/Casta *"
                placeholderTextColor={colors.mutedForeground}
                value={tastingGrape}
                onChangeText={setTastingGrape}
              />
              <TextInput
                style={[styles.tastingInput, { width: 80, borderColor: colors.gold + "80", color: colors.foreground, backgroundColor: "#fff" }]}
                placeholder="Safra *"
                placeholderTextColor={colors.mutedForeground}
                value={tastingVintage}
                onChangeText={(t) => setTastingVintage(t.replace(/\D/g, "").slice(0, 4))}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
            <View style={styles.tastingRow}>
              <TextInput
                style={[styles.tastingInput, { flex: 1, borderColor: colors.border, color: colors.foreground, backgroundColor: "#fff" }]}
                placeholder="Produtor"
                placeholderTextColor={colors.mutedForeground}
                value={tastingProducer}
                onChangeText={setTastingProducer}
              />
            </View>

            {/* EAN — required for ranking; always shows gold border */}
            <View style={[styles.eanRow, { borderColor: colors.gold + "80", backgroundColor: "#fff" }]}>
              <Feather name="tag" size={15} color={tastingEan.trim() ? colors.gold : colors.mutedForeground} />
              <TextInput
                style={[styles.tastingInput, { flex: 1, borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: "transparent", color: colors.foreground }]}
                placeholder="EAN / Código de barras * (ex: 7896123456789)"
                placeholderTextColor={colors.mutedForeground}
                value={tastingEan}
                onChangeText={setTastingEan}
                keyboardType="numeric"
              />
            </View>
            {tastingEan.trim().length > 0 && (
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: -8 }}>
                🏆 Com EAN + pontuação, sua avaliação entra automaticamente no ranking comunitário.
              </Text>
            )}

            {/* Score picker */}
            <TouchableOpacity
              style={[styles.scorePicker, { borderColor: tastingScore ? colors.gold : colors.border, backgroundColor: "#fff" }]}
              onPress={() => setShowScorePicker(v => !v)}
            >
              <MaterialCommunityIcons name="star" size={22} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.scorePickerLabel, { color: colors.mutedForeground }]}>Pontuação (0–100)</Text>
                <Text style={[styles.scorePickerValue, { color: tastingScore ? colors.gold : colors.mutedForeground }]}>
                  {tastingScore ? `${tastingScore}/100 — ${SCORE_LABELS[tastingScore] ?? tastingScore}` : "Selecionar pontuação"}
                </Text>
              </View>
              <Feather name={showScorePicker ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            {showScorePicker && (
              <View style={[styles.scoreDropdown, { borderColor: colors.border, backgroundColor: "#fff" }]}>
                {SCORE_OPTIONS.map(s => (
                  <TouchableOpacity
                    key={s || "none"}
                    style={[
                      styles.scoreOption,
                      { borderBottomColor: colors.border },
                      tastingScore === s && { backgroundColor: colors.gold + "12" },
                    ]}
                    onPress={() => { setTastingScore(s); setShowScorePicker(false); }}
                  >
                    <Text style={[styles.scoreOptionText, { color: tastingScore === s ? colors.gold : colors.foreground }]}>
                      {s ? `${s}/100 — ${SCORE_LABELS[s]}` : "Sem pontuação"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TextInput
              style={[styles.tastingInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: "#fff" }]}
              placeholder="👃 Aroma (ex: frutas vermelhas, especiarias...)"
              placeholderTextColor={colors.mutedForeground}
              value={tastingAroma}
              onChangeText={setTastingAroma}
            />
            <TextInput
              style={[styles.tastingInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: "#fff" }]}
              placeholder="👅 Sabor (ex: taninos sedosos, acidez equilibrada...)"
              placeholderTextColor={colors.mutedForeground}
              value={tastingFlavor}
              onChangeText={setTastingFlavor}
            />
            <TextInput
              style={[styles.tastingInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: "#fff" }]}
              placeholder="🍽️ Harmonização sugerida"
              placeholderTextColor={colors.mutedForeground}
              value={tastingPair}
              onChangeText={setTastingPair}
            />
            <TextInput
              style={[styles.tastingInput, styles.tastingTextarea, { borderColor: colors.border, color: colors.foreground, backgroundColor: "#fff" }]}
              placeholder="📝 Notas adicionais sobre o vinho..."
              placeholderTextColor={colors.mutedForeground}
              value={tastingNotes}
              onChangeText={setTastingNotes}
              multiline
              textAlignVertical="top"
            />
          </View>
        )}
      </ScrollView>

      {mode === "normal" && (
        <View style={[styles.toolbar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <Text style={[styles.charCount, { color: charCount > maxChars * 0.9 ? colors.destructive : colors.mutedForeground }]}>
            {charCount}/{maxChars}
          </Text>
          <View style={styles.toolbarActions}>
            <TouchableOpacity onPress={handleAddImage} style={styles.toolbarBtn} disabled={!!videoUri}>
              <Feather name="image" size={22} color={imageUris.length > 0 ? colors.gold : videoUri ? colors.mutedForeground + "60" : colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddVideo} style={styles.toolbarBtn} disabled={imageUris.length > 0}>
              <Feather name="video" size={22} color={videoUri ? colors.gold : imageUris.length > 0 ? colors.mutedForeground + "60" : colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowLocationInput(v => !v)}>
              <Feather name="map-pin" size={22} color={location.trim() ? colors.gold : colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarBtn}>
              <Feather name="bar-chart-2" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  postBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  modeRow: { flexDirection: "row", borderBottomWidth: 1 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  modeBtnText: { fontSize: 13, fontWeight: "700" },
  body: { flex: 1, paddingHorizontal: 16 },
  authorRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14 },
  authorInfo: { gap: 5 },
  authorName: { fontSize: 15, fontWeight: "700" },
  audienceBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  textInput: { fontSize: 17, lineHeight: 25, minHeight: 120 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  locationInput: { flex: 1, fontSize: 14 },
  gpsBtn: { padding: 2 },
  imageRow: { marginTop: 12, marginBottom: 4 },
  thumbImg: { width: 100, height: 100 },
  removeThumb: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 12, padding: 3 },
  addMoreBtn: { width: 100, height: 100, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  videoPreviewWrap: { marginTop: 12, marginBottom: 4, width: "100%", aspectRatio: 9 / 16, overflow: "hidden", position: "relative", backgroundColor: "#000" },
  videoPreview: { width: "100%", height: "100%" },
  videoIconOverlay: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, padding: 4 },
  hashtagSection: { marginTop: 20, gap: 10 },
  hashtagLabel: { fontSize: 13, fontWeight: "600" },
  hashtagChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { fontSize: 13, fontWeight: "600" },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  charCount: { fontSize: 12, fontWeight: "500" },
  toolbarActions: { flexDirection: "row", gap: 4 },
  toolbarBtn: { padding: 8 },
  // Tasting note styles
  tastingForm: { gap: 12, paddingBottom: 40 },
  tastingHero: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  tastingHeroTitle: { fontSize: 16, fontWeight: "800" },
  tastingHeroSub: { fontSize: 12, marginTop: 2 },
  tastingInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  tastingRow: { flexDirection: "row", gap: 10 },
  tastingTextarea: { height: 80 },
  eanRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  scorePicker: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 14 },
  scorePickerLabel: { fontSize: 11, marginBottom: 2 },
  scorePickerValue: { fontSize: 14, fontWeight: "600" },
  scoreDropdown: { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginTop: -6 },
  scoreOption: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1 },
  scoreOptionText: { fontSize: 14 },
});
