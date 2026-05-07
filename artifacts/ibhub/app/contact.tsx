import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";

export default function ContactScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [subject, setSubject]     = useState("");
  const [category, setCategory]   = useState("");
  const [message, setMessage]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [catOpen, setCatOpen]     = useState(false);

  const scaleAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const topPad    = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : 20 + insets.bottom;

  useEffect(() => {
    if (success) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [success]);

  const CATEGORIES = [t("contact.cat_support"), t("contact.cat_question"), t("contact.cat_suggestion"), t("contact.cat_other")];

  const handleSubmit = async () => {
    setError(null);
    if (!user) { setError(t("contact.error_auth")); return; }
    if (!subject.trim()) { setError(t("contact.error_subject")); return; }
    if (!category)       { setError(t("contact.error_category")); return; }
    if (!message.trim()) { setError(t("contact.error_message")); return; }

    setLoading(true);
    const { error: dbError } = await supabase.from("support_messages").insert({
      user_id:  user.id,
      subject:  subject.trim(),
      category,
      message:  message.trim(),
    });
    setLoading(false);

    if (dbError) {
      setError(t("contact.send_error"));
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.navy} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("contact.title")}</Text>
          <View style={{ width: 22 }} />
        </View>
        <Animated.View style={[styles.successContainer, { opacity: opacityAnim }]}>
          <Animated.View style={[styles.successIcon, { backgroundColor: colors.gold + "20", transform: [{ scale: scaleAnim }] }]}>
            <Feather name="check-circle" size={52} color={colors.gold} />
          </Animated.View>
          <Text style={[styles.successTitle, { color: colors.navy }]}>{t("contact.success_title")}</Text>
          <Text style={[styles.successBody, { color: colors.mutedForeground }]}>
            {t("contact.success_body")}
          </Text>
          <TouchableOpacity
            style={[styles.successBtn, { backgroundColor: colors.navy }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.successBtnText, { color: "#fff" }]}>{t("contact.back_btn")}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 14, backgroundColor: "#fff", borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.navy} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.navy }]}>{t("contact.title")}</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, rowGap: 14, paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.infoCard, { backgroundColor: colors.gold + "12", borderColor: colors.gold + "35" }]}>
            <Feather name="mail" size={16} color={colors.gold} />
            <Text style={[styles.infoText, { color: colors.navy }]}>
              {t("contact.info_text")}
            </Text>
          </View>

          {error && (
            <View style={[styles.errorBox, { borderColor: "#fecaca", backgroundColor: "#fff5f5" }]}>
              <Feather name="alert-circle" size={14} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: "#fff", borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.navy }]}>{t("contact.subject_label")}</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.navy }]}
              placeholder={t("contact.subject_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
            />

            <Text style={[styles.label, { color: colors.navy, marginTop: 14 }]}>{t("contact.category_label")}</Text>
            <TouchableOpacity
              style={[styles.selector, { borderColor: category ? colors.navy : colors.border }]}
              onPress={() => setCatOpen((v) => !v)}
            >
              <Text style={[styles.selectorText, { color: category ? colors.navy : colors.mutedForeground }]}>
                {category || t("contact.category_placeholder")}
              </Text>
              <Feather name={catOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            {catOpen && (
              <View style={[styles.dropdownContainer, { borderColor: colors.border }]}>
                {CATEGORIES.map((cat, i) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.dropdownOption,
                      i < CATEGORIES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      category === cat && { backgroundColor: colors.gold + "12" },
                    ]}
                    onPress={() => { setCategory(cat); setCatOpen(false); }}
                  >
                    <Text style={[styles.dropdownOptionText, { color: category === cat ? colors.gold : colors.navy }]}>
                      {cat}
                    </Text>
                    {category === cat && <Feather name="check" size={16} color={colors.gold} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.label, { color: colors.navy, marginTop: 14 }]}>{t("contact.message_label")}</Text>
            <TextInput
              style={[styles.textarea, { borderColor: colors.border, color: colors.navy }]}
              placeholder={t("contact.message_placeholder")}
              placeholderTextColor={colors.mutedForeground}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {message.length}/2000
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.navy }, loading && { opacity: 0.65 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={16} color="#fff" />
                <Text style={styles.submitBtnText}>{t("contact.send_btn")}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:          { flex: 1 },
  header:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle:        { fontSize: 20, fontWeight: "700" },
  infoCard:           { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  infoText:           { fontSize: 13, lineHeight: 19, flex: 1 },
  errorBox:           { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  errorText:          { color: "#dc2626", fontSize: 13, flex: 1 },
  card:               { borderRadius: 12, borderWidth: 1, padding: 16 },
  label:              { fontSize: 13, fontWeight: "700", marginBottom: 8, letterSpacing: 0.3 },
  input:              { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  selector:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14 },
  selectorText:       { fontSize: 15 },
  dropdownContainer:  { borderWidth: 1, borderRadius: 10, overflow: "hidden", marginTop: 6 },
  dropdownOption:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 13 },
  dropdownOptionText: { fontSize: 15 },
  textarea:           { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 130 },
  charCount:          { fontSize: 12, textAlign: "right", marginTop: 6 },
  submitBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 12 },
  submitBtnText:      { color: "#fff", fontSize: 16, fontWeight: "700" },
  successContainer:   { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  successIcon:        { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  successTitle:       { fontSize: 24, fontWeight: "800", textAlign: "center" },
  successBody:        { fontSize: 15, lineHeight: 23, textAlign: "center" },
  successBtn:         { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, marginTop: 8 },
  successBtnText:     { fontSize: 16, fontWeight: "700" },
});
