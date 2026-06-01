import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth, supabase } from "@/context/AuthContext";
import type { AppStory, StoryGroup } from "@/services/api";
import { fetchCommentProfilesForIds, fetchCompanyPagesForIds } from "@/services/api/_shared";

export default function StoryDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!id || !user?.id) return;

    let cancelled = false;

    (async () => {
      try {
        const { data: raw } = await supabase
          .from("stories")
          .select("id, user_id, company_page_id, image_url, video_url, text, tagged_users, created_at, expires_at")
          .eq("id", id)
          .maybeSingle();

        if (cancelled) return;

        if (!raw) {
          // Story not found or expired — go back
          router.back();
          return;
        }

        const story = raw as any;
        const [profileMap, companyMap] = await Promise.all([
          fetchCommentProfilesForIds([story.user_id]),
          story.company_page_id ? fetchCompanyPagesForIds([story.company_page_id]) : Promise.resolve(new Map()),
        ]);

        if (cancelled) return;

        const author = profileMap.get(story.user_id) ?? { id: story.user_id, full_name: "Usuário", avatar_url: null };
        const companyPage = story.company_page_id ? (companyMap.get(story.company_page_id) ?? null) : null;

        const enrichedStory: AppStory = {
          ...story,
          author,
          company_page: companyPage,
          viewed: false,
        };

        const group: StoryGroup = companyPage
          ? {
              userId: story.user_id,
              companyPageId: story.company_page_id,
              companyPage,
              author: { id: companyPage.id, full_name: companyPage.name, avatar_url: companyPage.avatar_url ?? null },
              stories: [enrichedStory],
              hasUnseen: true,
            }
          : {
              userId: story.user_id,
              author,
              stories: [enrichedStory],
              hasUnseen: true,
            };

        router.replace({
          pathname: "/story-viewer",
          params: {
            groups: JSON.stringify([group]),
            groupIndex: "0",
          },
        } as any);
      } catch {
        if (!cancelled) router.back();
      }
    })();

    return () => { cancelled = true; };
  }, [id, user?.id]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#c9a84c" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
});
