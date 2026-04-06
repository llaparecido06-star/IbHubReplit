import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const DEMO_STORIES = [
  { id: "1", name: "Maria Silva", hasStory: true, seen: false },
  { id: "2", name: "João Costa", hasStory: true, seen: false },
  { id: "3", name: "Ana Ferreira", hasStory: true, seen: true },
  { id: "4", name: "Pedro Lima", hasStory: true, seen: false },
  { id: "5", name: "Carla Ramos", hasStory: true, seen: true },
];

export function StoryBar() {
  const colors = useColors();
  const { profile } = useAuth();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity style={styles.item}>
        <View style={styles.addStory}>
          <Avatar uri={profile?.avatar_url} name={profile?.full_name} size={56} />
          <View style={[styles.addBadge, { backgroundColor: colors.gold }]}>
            <Text style={{ color: colors.navy, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>+</Text>
          </View>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          Sua história
        </Text>
      </TouchableOpacity>

      {DEMO_STORIES.map((story) => (
        <TouchableOpacity key={story.id} style={styles.item}>
          <LinearGradient
            colors={story.seen ? [colors.border, colors.border] : [colors.gold, colors.wine]}
            style={styles.ring}
          >
            <View style={[styles.ringInner, { backgroundColor: colors.card }]}>
              <Avatar name={story.name} size={52} />
            </View>
          </LinearGradient>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {story.name.split(" ")[0]}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    maxHeight: 100,
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 16,
  },
  item: {
    alignItems: "center",
    gap: 5,
    width: 68,
  },
  addStory: { position: "relative" },
  addBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
});
