/**
 * MentionInput — TextInput with @mention autocomplete for mobile.
 *
 * When the user types "@" followed by characters, a suggestion list appears.
 * Selecting a suggestion replaces the partial mention with "@username ".
 * After form submission, call `sendMentionNotifications` with the final text.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { searchUsersForMention, type MentionSuggestion } from "@/services/api";
import { useColors } from "@/hooks/useColors";

interface MentionInputProps extends Omit<TextInputProps, "onChangeText" | "value"> {
  value: string;
  onChangeText: (text: string) => void;
  /** Where to show the suggestion list: "above" (default) or "below" */
  suggestionsPlacement?: "above" | "below";
  containerStyle?: object;
}

function Avatar({ uri, name, size = 32 }: { uri?: string | null; name: string; size?: number }) {
  const initials = (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#0d1b2a", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontSize: size * 0.36, fontWeight: "700" }}>{initials}</Text>
    </View>
  );
}

export function MentionInput({
  value,
  onChangeText,
  suggestionsPlacement = "above",
  containerStyle,
  ...rest
}: MentionInputProps) {
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [suggestions, setSuggestions] = useState<MentionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract current @mention query at the cursor position
  const extractMentionQuery = useCallback((text: string, pos: number): string | null => {
    const textBeforeCursor = text.slice(0, pos);
    const match = textBeforeCursor.match(/@([\w.]*)$/);
    return match ? match[1] : null;
  }, []);

  const handleChangeText = (text: string) => {
    onChangeText(text);
    // Cursor position will be updated via onSelectionChange
    const query = extractMentionQuery(text, cursorPos);
    triggerSearch(query);
  };

  const handleSelectionChange = (event: any) => {
    const pos: number = event.nativeEvent.selection?.start ?? 0;
    setCursorPos(pos);
    const query = extractMentionQuery(value, pos);
    triggerSearch(query);
  };

  const triggerSearch = useCallback((query: string | null) => {
    setMentionQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query === null) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const results = await searchUsersForMention(query);
      setSuggestions(results);
      setLoading(false);
    }, 200);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleSelectSuggestion = (suggestion: MentionSuggestion) => {
    // Replace the @query at cursor with @username (add trailing space)
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    const replaced = textBeforeCursor.replace(/@([\w.]*)$/, `@${suggestion.username} `);
    const newText = replaced + textAfterCursor;
    onChangeText(newText);
    setSuggestions([]);
    setMentionQuery(null);
    // Focus back on input
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const SuggestionList = () => {
    if (mentionQuery === null) return null;
    if (!loading && suggestions.length === 0) return null;

    return (
      <View style={[
        styles.suggestionBox,
        { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.foreground },
        suggestionsPlacement === "above" ? styles.above : styles.below,
      ]}>
        {loading && suggestions.length === 0 ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.gold} />
          </View>
        ) : (
          <FlatList
            data={suggestions}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="always"
            style={{ maxHeight: 220 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                onPress={() => handleSelectSuggestion(item)}
              >
                <Avatar uri={item.avatar_url} name={item.display_name} size={32} />
                <View style={styles.suggestionText}>
                  <Text style={[styles.suggestionName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.display_name}
                    {item.type === "company" && (
                      <Text style={{ color: colors.gold, fontSize: 10 }}> 🏢</Text>
                    )}
                  </Text>
                  <Text style={[styles.suggestionHandle, { color: colors.mutedForeground }]}>@{item.username}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  };

  return (
    <View style={[{ position: "relative" }, containerStyle]}>
      {suggestionsPlacement === "above" && <SuggestionList />}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        onSelectionChange={handleSelectionChange}
        {...rest}
      />
      {suggestionsPlacement === "below" && <SuggestionList />}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestionBox: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  above: {
    // placed above the input via marginBottom
  },
  below: {
    marginBottom: 0,
    marginTop: 4,
  },
  loadingRow: {
    padding: 12,
    alignItems: "center",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    flex: 1,
    minWidth: 0,
  },
  suggestionName: {
    fontSize: 13,
    fontWeight: "700",
  },
  suggestionHandle: {
    fontSize: 11,
    marginTop: 1,
  },
});
