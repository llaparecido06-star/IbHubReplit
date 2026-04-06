import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
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
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function EditProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [headline, setHeadline] = useState(profile?.headline ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaved(true);
    setSaving(false);
    setTimeout(() => router.back(), 800);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Editar Perfil</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={{ color: colors.gold, fontWeight: "700", fontSize: 16 }}>
            {saving ? "Salvando..." : saved ? "Salvo ✓" : "Salvar"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={90} />
          <TouchableOpacity>
            <Text style={[styles.changePhotoText, { color: colors.gold }]}>Alterar foto</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Input
            label="Nome completo"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Seu nome"
            leftIcon="user"
          />
          <Input
            label="Título profissional"
            value={headline}
            onChangeText={setHeadline}
            placeholder="Ex: Sommelier WSET Level 3 | Consultor"
            leftIcon="briefcase"
          />
          <Input
            label="Localização"
            value={location}
            onChangeText={setLocation}
            placeholder="Ex: São Paulo, Brasil"
            leftIcon="map-pin"
          />
          <View style={styles.bioSection}>
            <Text style={[styles.bioLabel, { color: colors.mutedForeground }]}>Bio</Text>
            <View style={[styles.bioInput, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <Input
                value={bio}
                onChangeText={setBio}
                placeholder="Conte um pouco sobre você e sua experiência no mundo do vinho..."
                multiline
                numberOfLines={5}
              />
            </View>
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {bio.length}/500
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Plano atual</Text>
          <View style={styles.planRow}>
            <View style={[styles.planBadge, { backgroundColor: colors.gold }]}>
              <Text style={{ color: colors.navy, fontWeight: "800", fontSize: 12 }}>
                {(profile?.plan ?? "basico").toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity>
              <Text style={{ color: colors.gold, fontSize: 14, fontWeight: "600" }}>
                Fazer upgrade
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  body: { padding: 20, gap: 20 },
  avatarSection: { alignItems: "center", gap: 10 },
  changePhotoText: { fontSize: 16, fontWeight: "700" },
  form: { gap: 14 },
  bioSection: { gap: 6 },
  bioLabel: { fontSize: 13, fontWeight: "600" },
  bioInput: {},
  charCount: { fontSize: 11, alignSelf: "flex-end" },
  section: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  planRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
});
