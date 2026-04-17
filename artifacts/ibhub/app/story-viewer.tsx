import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  GestureResponderEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { supabase } from "@/context/AuthContext";
import * as API from "@/services/api";
import type { AppStory, StoryGroup } from "@/services/api";

const STORY_DURATION = 5000;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const STORY_HEIGHT = Math.round(SCREEN_WIDTH * (16 / 9));

interface TaggedProfile {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

function formatTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function StoryViewerScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ groups: string; groupIndex: string }>();

  const groups: StoryGroup[] = (() => {
    try {
      return params.groups ? JSON.parse(params.groups) : [];
    } catch {
      return [];
    }
  })();

  const [groupIndex, setGroupIndex] = useState(Number(params.groupIndex ?? 0));
  const [storyIndex, setStoryIndex] = useState(0);
  const [taggedProfiles, setTaggedProfiles] = useState<TaggedProfile[]>([]);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const isPaused = useRef(false);

  const currentGroup = groups[groupIndex];
  const currentStory: AppStory | undefined = currentGroup?.stories[storyIndex];

  const goToNext = useCallback(() => {
    progressAnim.setValue(0);
    const nextStory = storyIndex + 1;
    if (nextStory < (currentGroup?.stories.length ?? 0)) {
      setStoryIndex(nextStory);
    } else {
      const nextGroup = groupIndex + 1;
      if (nextGroup < groups.length) {
        setGroupIndex(nextGroup);
        setStoryIndex(0);
      } else {
        router.back();
      }
    }
  }, [storyIndex, groupIndex, currentGroup, groups, progressAnim, router]);

  const goToPrev = useCallback(() => {
    progressAnim.setValue(0);
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1];
      setGroupIndex(groupIndex - 1);
      setStoryIndex(prevGroup.stories.length - 1);
    }
  }, [storyIndex, groupIndex, groups, progressAnim]);

  const startProgress = useCallback(() => {
    progressAnimation.current?.stop();
    progressAnim.setValue(0);
    progressAnimation.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });
    progressAnimation.current.start(({ finished }) => {
      if (finished && !isPaused.current) goToNext();
    });
  }, [progressAnim, goToNext]);

  useEffect(() => {
    if (!currentStory) return;
    if (user?.id) API.markStoryViewed(currentStory.id, user.id);
    setTaggedProfiles([]);
    const taggedIds = currentStory.tagged_users ?? [];
    if (taggedIds.length > 0) {
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", taggedIds)
        .then(({ data }) => {
          if (data) setTaggedProfiles(data as TaggedProfile[]);
        });
    }
    startProgress();
    return () => { progressAnimation.current?.stop(); };
  }, [currentStory?.id]);

  const handleTouchStart = useRef<{ x: number; t: number } | null>(null);

  const onTouchStart = (e: GestureResponderEvent) => {
    handleTouchStart.current = { x: e.nativeEvent.pageX, t: Date.now() };
    isPaused.current = true;
    progressAnimation.current?.stop();
  };

  const onTouchEnd = (e: GestureResponderEvent) => {
    if (!handleTouchStart.current) return;
    const dx = e.nativeEvent.pageX - handleTouchStart.current.x;
    const dt = Date.now() - handleTouchStart.current.t;
    isPaused.current = false;
    if (Math.abs(dx) > 60 && dt < 400) {
      if (dx < 0) goToNext(); else goToPrev();
    } else if (dt < 250 && Math.abs(dx) < 10) {
      if (e.nativeEvent.pageX < SCREEN_WIDTH / 3) goToPrev(); else goToNext();
    } else {
      startProgress();
    }
  };

  if (!currentGroup || !currentStory) {
    return (
      <View style={styles.screen}>
        <Text style={{ color: "#fff" }}>Nenhum momento disponível</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.screen}
      onStartShouldSetResponder={() => true}
      onResponderGrant={onTouchStart}
      onResponderRelease={onTouchEnd}
    >
      <View style={styles.frame}>
        {currentStory.image_url ? (
          <Image
            source={{ uri: currentStory.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: colors.gold, fontSize: 48 }}>🍷</Text>
          </View>
        )}

        <View style={styles.gradient} />

        <View style={[styles.topSection, { paddingTop: insets.top + 8 }]}>
          <View style={styles.progressBars}>
            {currentGroup.stories.map((_, i) => (
              <View key={i} style={[styles.progressTrack, { flex: 1 }]}>
                {i < storyIndex ? (
                  <View style={[styles.progressAnimFill, { width: "100%" }]} />
                ) : i === storyIndex ? (
                  <Animated.View
                    style={[
                      styles.progressAnimFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                      },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.authorRow}>
            <Avatar uri={currentGroup.author.avatar_url} name={currentGroup.author.full_name} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>{currentGroup.author.full_name}</Text>
              <Text style={styles.storyTime}>{formatTime(currentStory.created_at)}</Text>
            </View>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}>
          {currentStory.text ? (
            <Text style={styles.overlayText}>{currentStory.text}</Text>
          ) : null}

          {taggedProfiles.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.taggedRow}
            >
              <Feather name="at-sign" size={13} color="rgba(255,255,255,0.8)" style={{ marginRight: 4 }} />
              {taggedProfiles.map((tp) => {
                const profileHref: Href = `/profile/${tp.id}`;
                return (
                  <TouchableOpacity
                    key={tp.id}
                    style={styles.tagChip}
                    onPress={() => {
                      progressAnimation.current?.stop();
                      router.push(profileHref);
                    }}
                  >
                    <Avatar uri={tp.avatar_url} name={tp.full_name} size={18} />
                    <Text style={styles.tagChipText}>@{tp.full_name.split(" ")[0]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:           { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  frame:            { width: SCREEN_WIDTH, height: STORY_HEIGHT, overflow: "hidden" },
  gradient:         { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.15)" },
  topSection:       { paddingHorizontal: 12, gap: 10 },
  progressBars:     { flexDirection: "row", gap: 3, height: 2 },
  progressTrack:    { height: 2, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 1, overflow: "hidden" },
  progressAnimFill: { height: 2, backgroundColor: "#fff", borderRadius: 1 },
  authorRow:        { flexDirection: "row", alignItems: "center", gap: 10 },
  authorName:       { color: "#fff", fontSize: 14, fontWeight: "700" },
  storyTime:        { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  closeBtn:         { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  bottomSection:    { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, gap: 10 },
  overlayText:      { color: "#fff", fontSize: 20, fontWeight: "700", textAlign: "center" },
  taggedRow:        { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  tagChip:          { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tagChipText:      { color: "#fff", fontSize: 13, fontWeight: "600" },
});
