import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

interface TaggedProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  username?: string | null;
}

export default function CreateMomentoScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("pick");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [tagResults, setTagResults] = useState<TaggedProfile[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<TaggedProfile[]>([]);
  const [publishing, setPublishing] = useState(false);

  const openGallery = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de acesso à galeria para selecionar uma foto.");
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [9, 16],
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setStep("edit");
    }
  };

  const openCamera = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de acesso à câmera para tirar uma foto.");
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      aspect: [9, 16],
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setStep("edit");
    }
  };

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

  const removeTag = (id: string) => {
    setTaggedUsers(prev => prev.filter(u => u.id !== id));
  };

  const handlePublish = async () => {
    if (!user?.id) return;
    if (!imageUri) {
      Alert.alert("Foto obrigatória", "Selecione uma foto para publicar o Momento.");
      return;
    }
    setPublishing(true);
    setStep("publishing");

    const story = await API.createStory(user.id, {
      text: overlayText.trim() || undefined,
      imageUri,
      taggedUsers: taggedUsers.map(u => u.id),
    });

    setPublishing(false);
    if (story) {
      router.back();
    } else {
      Alert.alert("Erro", "Não foi possível publicar o Momento. Tente novamente.");
      setStep("edit");
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
          <Text style={styles.headerTitle}>Novo Momento</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.pickContent}>
          <View style={[styles.avatarWrap, { borderColor: colors.gold }]}>
            <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={80} />
          </View>
          <Text style={styles.pickTitle}>{profile?.full_name ?? "Você"}</Text>
          <Text style={styles.pickSub}>Compartilhe um momento com sua rede por 24 horas</Text>

          <View style={styles.pickBtns}>
            <TouchableOpacity style={[styles.pickBtn, { backgroundColor: colors.gold }]} onPress={openCamera}>
              <Feather name="camera" size={26} color={colors.navy} />
              <Text style={[styles.pickBtnLabel, { color: colors.navy }]}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pickBtn, { backgroundColor: colors.navyLight }]} onPress={openGallery}>
              <Feather name="image" size={26} color="#fff" />
              <Text style={[styles.pickBtnLabel, { color: "#fff" }]}>Galeria</Text>
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
        <Text style={[styles.publishingText, { color: colors.gold }]}>Publicando Momento...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: "#000" }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      )}

      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <View style={[styles.editorHeader, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity onPress={() => setStep("pick")} style={styles.closeBtn}>
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Momento</Text>
        <TouchableOpacity
          style={[styles.publishEditorBtn, { backgroundColor: colors.gold }]}
          onPress={handlePublish}
          disabled={publishing}
        >
          <Text style={[styles.publishEditorBtnText, { color: colors.navy }]}>Publicar</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.editorBody, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.textInputWrap}>
          <TextInput
            style={styles.textOverlay}
            placeholder="Adicione um texto..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={overlayText}
            onChangeText={setOverlayText}
            multiline
            maxLength={200}
            textAlign="center"
          />
        </View>

        <View style={styles.tagSection}>
          <Text style={styles.tagSectionLabel}>MARCAR PESSOAS</Text>

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
              placeholder="Buscar pessoa..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={tagSearch}
              onChangeText={searchUsers}
            />
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
                style={{ maxHeight: 180 }}
                scrollEnabled
              />
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1 },
  overlay:           { backgroundColor: "rgba(0,0,0,0.25)" },
  header:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  closeBtn:          { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle:       { fontSize: 16, fontWeight: "700", color: "#fff" },
  pickContent:       { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  avatarWrap:        { borderWidth: 3, borderRadius: 50, padding: 3, marginBottom: 16 },
  pickTitle:         { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 8 },
  pickSub:           { fontSize: 14, color: "rgba(255,255,255,0.7)", textAlign: "center", marginBottom: 48 },
  pickBtns:          { flexDirection: "row", gap: 16 },
  pickBtn:           { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 16, paddingVertical: 24, gap: 8 },
  pickBtnLabel:      { fontSize: 15, fontWeight: "700" },
  publishingView:    { alignItems: "center", justifyContent: "center", gap: 20 },
  publishingText:    { fontSize: 16, fontWeight: "600" },
  editorHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  publishEditorBtn:  { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  publishEditorBtnText: { fontSize: 14, fontWeight: "700" },
  editorBody:        { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 16 },
  textInputWrap:     { marginBottom: 16 },
  textOverlay:       { color: "#fff", fontSize: 20, fontWeight: "700", minHeight: 40, textAlign: "center" },
  tagSection:        { backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 16, padding: 12 },
  tagSectionLabel:   { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginBottom: 8 },
  taggedList:        { marginBottom: 8 },
  tagChip:           { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(201,168,76,0.8)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  tagChipText:       { color: "#fff", fontSize: 12, fontWeight: "600" },
  tagInputWrap:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  tagInput:          { flex: 1, color: "#fff", fontSize: 14 },
  tagResults:        { marginTop: 8, backgroundColor: "rgba(13,27,42,0.95)", borderRadius: 10, overflow: "hidden" },
  tagResultItem:     { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  tagResultName:     { color: "#fff", fontSize: 14, fontWeight: "500" },
});
