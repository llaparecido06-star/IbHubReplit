import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { Feather } from "@expo/vector-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const HASHTAG_SUGGESTIONS = [
  "vinho", "sommelier", "enologia", "degustação",
  "harmonização", "vinícola", "enoturismo", "wset",
];

export default function CreatePostScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleAddImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    await new Promise((r) => setTimeout(r, 800));
    router.back();
  };

  const charCount = content.length;
  const maxChars = 1000;
  const canPost = content.trim().length > 0 && !posting;

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

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.authorRow}>
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={44} />
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: colors.foreground }]}>
              {profile?.full_name ?? "Você"}
            </Text>
            <View style={[styles.audienceBtn, { backgroundColor: colors.secondary, borderRadius: 12 }]}>
              <Feather name="globe" size={11} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: 11, fontWeight: "600" }}>Todos</Text>
              <Feather name="chevron-down" size={11} color={colors.mutedForeground} />
            </View>
          </View>
        </View>

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

        {imageUri && (
          <View style={styles.imagePreview}>
            <Image source={{ uri: imageUri }} style={[styles.previewImg, { borderRadius: colors.radius }]} contentFit="cover" />
            <TouchableOpacity
              style={[styles.removeImg, { backgroundColor: colors.destructive }]}
              onPress={() => setImageUri(null)}
            >
              <Feather name="x" size={14} color="#ffffff" />
            </TouchableOpacity>
          </View>
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
      </ScrollView>

      <View style={[styles.toolbar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        <Text style={[styles.charCount, { color: charCount > maxChars * 0.9 ? colors.destructive : colors.mutedForeground }]}>
          {charCount}/{maxChars}
        </Text>
        <View style={styles.toolbarActions}>
          <TouchableOpacity onPress={handleAddImage} style={styles.toolbarBtn}>
            <Feather name="image" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn}>
            <Feather name="bar-chart-2" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn}>
            <Feather name="hash" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarBtn}>
            <Feather name="clock" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  postBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  body: { flex: 1, paddingHorizontal: 16 },
  authorRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14 },
  authorInfo: { gap: 5 },
  authorName: { fontSize: 15, fontWeight: "700" },
  audienceBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  textInput: { fontSize: 17, lineHeight: 25, minHeight: 120 },
  imagePreview: { position: "relative", marginTop: 12 },
  previewImg: { width: "100%", height: 200 },
  removeImg: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  hashtagSection: { marginTop: 20, gap: 10 },
  hashtagLabel: { fontSize: 13, fontWeight: "600" },
  hashtagChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { fontSize: 13, fontWeight: "600" },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  charCount: { fontSize: 12, fontWeight: "500" },
  toolbarActions: { flexDirection: "row", gap: 4 },
  toolbarBtn: { padding: 8 },
});
