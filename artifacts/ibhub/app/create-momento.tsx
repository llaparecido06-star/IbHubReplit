import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import * as API from "@/services/api";
import { supabase } from "@/context/AuthContext";

type Step = "pick" | "edit" | "publishing";
type MediaType = "image" | "video";

interface TaggedProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  username?: string | null;
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function CreateMomentoScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const { user, profile, activeCompany } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("pick");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [tagResults, setTagResults] = useState<TaggedProfile[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<TaggedProfile[]>([]);
  const [publishing, setPublishing] = useState(false);

  const requestAndOpen = useCallback(async (launch: () => Promise<void>, permissionFn?: () => Promise<{ status: string }>) => {
    if (Platform.OS !== "web" && permissionFn) {
      const { status } = await permissionFn();
      if (status !== "granted") {
        Alert.alert(t("create_momento_screen.permission_title"), t("create_momento_screen.permission_msg"));
        return;
      }
    }
    await launch();
  }, []);

  const openGallery = () => requestAndOpen(
    async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === "video";
        setMediaType(isVideo ? "video" : "image");
        setMediaUri(asset.uri);
        setVideoDurationMs(isVideo ? (asset.duration ?? null) : null);
        setStep("edit");
      }
    },
    () => ImagePicker.requestMediaLibraryPermissionsAsync(),
  );

  const openCamera = () => requestAndOpen(
    async () => {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
        // No videoMaxDuration — allow unlimited recording; long videos are split into parts automatically
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const isVideo = asset.type === "video";
        setMediaType(isVideo ? "video" : "image");
        setMediaUri(asset.uri);
        setVideoDurationMs(isVideo ? (asset.duration ?? null) : null);
        setStep("edit");
      }
    },
    () => ImagePicker.requestCameraPermissionsAsync(),
  );

  const searchUsers = async (query: string) => {
    setTagSearch(query);
    if (query.length < 2) { setTagResults([]); return; }
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, username")
        .ilike("full_name", `%${query}%`)
        .neq("id", user?.id ?? "")
        .limit(8);
      setTagResults((data ?? []) as TaggedProfile[]);
    } catch {
      setTagResults([]);
    }
  };

  const tagUser = (u: TaggedProfile) => {
    if (!taggedUsers.find(t => t.id === u.id)) {
      setTaggedUsers(prev => [...prev, u]);
    }
    setTagSearch("");
    setTagResults([]);
  };

  const removeTag = (id: string) => setTaggedUsers(prev => prev.filter(u => u.id !== id));

  const isLongVideo = mediaType === "video" && videoDurationMs != null && videoDurationMs > 60000;
  const videoParts = isLongVideo && videoDurationMs ? Math.ceil(videoDurationMs / 1000 / 60) : 1;

  const handlePublish = async () => {
    if (!user?.id) return;
    if (!mediaUri) {
      Alert.alert(t("create_momento_screen.media_required_title"), t("create_momento_screen.media_required_msg"));
      return;
    }
    setPublishing(true);
    setStep("publishing");

    if (isLongVideo && videoDurationMs) {
      const ok = await API.createVideoStoryParts(user.id, {
        text: overlayText.trim() || undefined,
        videoUri: mediaUri,
        videoDurationMs,
        taggedUsers: taggedUsers.map(u => u.id),
        companyPageId: activeCompany?.id,
      });
      setPublishing(false);
      if (ok) {
        router.back();
      } else {
        Alert.alert(t("common.error"), t("create_momento_screen.error_publish"));
        setStep("edit");
      }
    } else {
      const story = await API.createStory(user.id, {
        text: overlayText.trim() || undefined,
        imageUri: mediaType === "image" ? mediaUri : undefined,
        videoUri: mediaType === "video" ? mediaUri : undefined,
        taggedUsers: taggedUsers.map(u => u.id),
        companyPageId: activeCompany?.id,
      });
      setPublishing(false);
      if (story) {
        router.back();
      } else {
        Alert.alert(t("common.error"), t("create_momento_screen.error_publish"));
        setStep("edit");
      }
    }
  };

  const topPad = insets.top;

  if (step === "pick") {
    return (
      <View style={[styles.container, { backgroundColor: colors.navy }]}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("create_momento_screen.header_title")}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.pickContent}>
          <View style={[styles.avatarWrap, { borderColor: colors.gold }]}>
            <Avatar
              uri={activeCompany ? (activeCompany.avatar_url ?? null) : profile?.avatar_url}
              name={activeCompany ? activeCompany.name : profile?.full_name}
              size={80}
            />
          </View>
          <Text style={styles.pickTitle}>{activeCompany ? activeCompany.name : (profile?.full_name ?? t("create_momento_screen.you_fallback"))}</Text>
          {activeCompany && (
            <View style={styles.companyBadge}>
              <Text style={styles.companyBadgeText}>{t("create_momento_screen.publishing_as_company")}</Text>
            </View>
          )}
          <Text style={styles.pickSub}>{t("create_momento_screen.pick_sub")}</Text>

          <View style={styles.pickBtns}>
            <TouchableOpacity style={[styles.pickBtn, { backgroundColor: colors.gold }]} onPress={openCamera}>
              <Feather name="camera" size={26} color={colors.navy} />
              <Text style={[styles.pickBtnLabel, { color: colors.navy }]}>{t("create_momento_screen.btn_camera")}</Text>
              <Text style={[styles.pickBtnSub, { color: colors.navy + "99" }]}>{t("create_momento_screen.btn_camera_sub")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pickBtn, { backgroundColor: colors.navyLight }]} onPress={openGallery}>
              <Feather name="image" size={26} color="#fff" />
              <Text style={[styles.pickBtnLabel, { color: "#fff" }]}>{t("create_momento_screen.btn_gallery")}</Text>
              <Text style={[styles.pickBtnSub, { color: "rgba(255,255,255,0.6)" }]}>{t("create_momento_screen.btn_gallery_sub")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (step === "publishing") {
    return (
      <View style={[styles.container, styles.publishingView, { backgroundColor: colors.navy }]}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={[styles.publishingText, { color: colors.gold }]}>
          {publishing
            ? isLongVideo ? t("create_momento_screen.sending_video", { parts: videoParts }) : t("create_momento_screen.sending_media")
            : t("create_momento_screen.publishing")}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: "#000" }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {mediaUri && mediaType === "image" && (
        <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      {mediaUri && mediaType === "video" && (
        <VideoPreview uri={mediaUri} />
      )}

      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <View style={[styles.editorLayout, { paddingTop: topPad + 12, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.header, { paddingTop: 0 }]}>
          <TouchableOpacity onPress={() => setStep("pick")} style={styles.closeBtn}>
            <Feather name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.mediaTypeBadge}>
            <Feather name={mediaType === "video" ? "film" : "image"} size={13} color={colors.gold} />
            <Text style={[styles.mediaTypeBadgeText, { color: colors.gold }]}>
              {isLongVideo
                ? t("create_momento_screen.media_long_video", { parts: videoParts })
                : mediaType === "video" ? t("create_momento_screen.media_video") : t("create_momento_screen.media_photo")}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.publishEditorBtn, { backgroundColor: colors.gold }]}
            onPress={handlePublish}
            disabled={publishing}
          >
            <Text style={[styles.publishEditorBtnText, { color: colors.navy }]}>{t("create_momento_screen.publish_btn")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.editorSpacer} />

        <View style={styles.editorBottom}>
          <TextInput
            style={styles.textOverlay}
            placeholder={t("create_momento_screen.text_placeholder")}
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={overlayText}
            onChangeText={setOverlayText}
            multiline
            maxLength={200}
            textAlign="center"
          />

          <View style={styles.tagSection}>
            <Text style={styles.tagSectionLabel}>{t("create_momento_screen.tag_section_label")}</Text>

            {taggedUsers.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.taggedList} contentContainerStyle={{ gap: 8 }}>
                {taggedUsers.map(u => (
                  <TouchableOpacity key={u.id} style={styles.tagChip} onPress={() => removeTag(u.id)}>
                    <Text style={styles.tagChipText}>@{u.full_name.split(" ")[0]}</Text>
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.tagInputWrap}>
              <Feather name="at-sign" size={16} color="rgba(255,255,255,0.7)" />
              <TextInput
                style={styles.tagInput}
                placeholder={t("create_momento_screen.tag_search_placeholder")}
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={tagSearch}
                onChangeText={searchUsers}
                returnKeyType="search"
              />
              {tagSearch.length > 0 && (
                <TouchableOpacity onPress={() => { setTagSearch(""); setTagResults([]); }}>
                  <Feather name="x-circle" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
            </View>

            {tagResults.length > 0 && (
              <View style={styles.tagResults}>
                <FlatList
                  data={tagResults}
                  keyExtractor={u => u.id}
                  renderItem={({ item }) => (
                    <Pressable style={styles.tagResultItem} onPress={() => tagUser(item)}>
                      <Avatar uri={item.avatar_url} name={item.full_name} size={32} />
                      <Text style={styles.tagResultName}>{item.full_name}</Text>
                    </Pressable>
                  )}
                  style={{ maxHeight: 160 }}
                  scrollEnabled
                  keyboardShouldPersistTaps="handled"
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:            { flex: 1 },
  overlay:              { backgroundColor: "rgba(0,0,0,0.25)" },
  header:               { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  closeBtn:             { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle:          { fontSize: 16, fontWeight: "700", color: "#fff" },
  pickContent:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  avatarWrap:           { borderWidth: 3, borderRadius: 50, padding: 3, marginBottom: 16 },
  pickTitle:            { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 8 },
  companyBadge:         { backgroundColor: "rgba(201,168,76,0.25)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  companyBadgeText:     { color: "#C9A84C", fontSize: 12, fontWeight: "700" },
  pickSub:              { fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: 48 },
  pickBtns:             { flexDirection: "row", gap: 16, width: "100%" },
  pickBtn:              { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16, paddingVertical: 24, gap: 6 },
  pickBtnLabel:         { fontSize: 15, fontWeight: "700" },
  pickBtnSub:           { fontSize: 11, fontWeight: "500" },
  publishingView:       { alignItems: "center", justifyContent: "center", gap: 20 },
  publishingText:       { fontSize: 16, fontWeight: "600" },
  mediaTypeBadge:       { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  mediaTypeBadgeText:   { fontSize: 12, fontWeight: "700" },
  publishEditorBtn:     { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  publishEditorBtnText: { fontSize: 14, fontWeight: "700" },
  editorLayout:         { flex: 1, flexDirection: "column" },
  editorSpacer:         { flex: 1 },
  editorBottom:         { paddingHorizontal: 16, gap: 12 },
  textOverlay:          { color: "#fff", fontSize: 20, fontWeight: "700", minHeight: 40, textAlign: "center" },
  tagSection:           { backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 16, padding: 12 },
  tagSectionLabel:      { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 8 },
  taggedList:           { marginBottom: 8 },
  tagChip:              { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(201,168,76,0.8)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText:          { color: "#fff", fontSize: 12, fontWeight: "600" },
  tagInputWrap:         { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  tagInput:             { flex: 1, color: "#fff", fontSize: 14 },
  tagResults:           { marginTop: 8, backgroundColor: "rgba(13,27,42,0.97)", borderRadius: 10, overflow: "hidden" },
  tagResultItem:        { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  tagResultName:        { color: "#fff", fontSize: 14, fontWeight: "500" },
});
