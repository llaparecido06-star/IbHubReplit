import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Avatar } from "@/components/ui/Avatar";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import * as API from "@/services/api";
import type { StoryGroup } from "@/services/api";

type RouterHref = Parameters<ReturnType<typeof useRouter>["push"]>[0];

export function StoryBar() {
  const colors = useColors();
  const router = useRouter();
  const { user, profile, activeCompany } = useAuth();

  const [groups, setGroups] = useState<StoryGroup[]>([]);

  const loadStories = useCallback(async () => {
    if (!user?.id) return;
    const data = await API.fetchActiveStoriesForUser(user.id);
    setGroups(data);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadStories();
    }, [loadStories])
  );

  const ownGroup = groups.find(g => g.userId === user?.id);
  const otherGroups = groups.filter(g => g.userId !== user?.id);

  const openViewer = (groupIdx: number) => {
    const href: RouterHref = {
      pathname: "/story-viewer",
      params: {
        groups: JSON.stringify(groups),
        groupIndex: String(groupIdx),
      },
    };
    router.push(href);
  };

  const createHref: RouterHref = "/create-momento";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      contentContainerStyle={styles.content}
    >
      <TouchableOpacity style={styles.item} onPress={() => router.push(createHref)}>
        <View style={styles.addStory}>
          <Avatar
            uri={activeCompany ? activeCompany.avatar_url ?? null : profile?.avatar_url ?? null}
            name={activeCompany ? activeCompany.name : profile?.full_name}
            size={56}
          />
          <View style={[styles.addBadge, { backgroundColor: colors.gold }]}>
            <Text style={{ color: colors.navy, fontSize: 18, fontWeight: "700", lineHeight: 20 }}>+</Text>
          </View>
          {ownGroup && (
            <View style={[styles.publishedDot, { backgroundColor: colors.wine }]} />
          )}
        </View>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {ownGroup ? "Seu Momento" : "Sua história"}
        </Text>
      </TouchableOpacity>

      {ownGroup && (
        <TouchableOpacity
          key={ownGroup.userId + "_own"}
          style={styles.item}
          onPress={() => openViewer(groups.indexOf(ownGroup))}
        >
          <LinearGradient
            colors={ownGroup.hasUnseen ? [colors.gold, colors.wine] : [colors.border, colors.border]}
            style={styles.ring}
          >
            <View style={[styles.ringInner, { backgroundColor: colors.card }]}>
              <Avatar
                uri={activeCompany ? activeCompany.avatar_url ?? null : profile?.avatar_url ?? null}
                name={activeCompany ? activeCompany.name : profile?.full_name}
                size={52}
              />
            </View>
          </LinearGradient>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            Ver meu
          </Text>
        </TouchableOpacity>
      )}

      {otherGroups.map((group) => {
        const globalIdx = groups.indexOf(group);
        return (
          <TouchableOpacity key={group.userId} style={styles.item} onPress={() => openViewer(globalIdx)}>
            <LinearGradient
              colors={group.hasUnseen ? [colors.gold, colors.wine] : [colors.border, colors.border]}
              style={styles.ring}
            >
              <View style={[styles.ringInner, { backgroundColor: colors.card }]}>
                <Avatar uri={group.author.avatar_url} name={group.author.full_name} size={52} />
              </View>
            </LinearGradient>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {group.author.full_name.split(" ")[0]}
            </Text>
          </TouchableOpacity>
        );
      })}
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
  addStory:     { position: "relative" },
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
  publishedDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#fff",
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
