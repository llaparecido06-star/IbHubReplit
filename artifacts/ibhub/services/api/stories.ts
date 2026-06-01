import { supabase } from "@/context/AuthContext";
import { fetchCommentProfilesForIds, fetchCompanyPagesForIds, API_URL } from "./_shared";
import type { AppStory, StoryGroup } from "./types";
import type { Group } from "./groups";

// ─── STORIES ─────────────────────────────────────────────────────────────────

export async function fetchActiveStories(): Promise<AppStory[]> {
  try {
    const { data, error } = await supabase
      .from("stories")
      .select("id, user_id, company_page_id, image_url, video_url, text, tagged_users, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) return [];

    const sUserIds = [...new Set((data as any[]).map(s => s.user_id).filter(Boolean))];
    const sCompanyIds = [...new Set((data as any[]).map(s => s.company_page_id).filter(Boolean))];
    const [sProfileMap, sCompanyMap] = await Promise.all([
      fetchCommentProfilesForIds(sUserIds),
      fetchCompanyPagesForIds(sCompanyIds),
    ]);

    return (data as any[]).map(s => ({
      ...s,
      author: sProfileMap.get(s.user_id) ?? null,
      company_page: s.company_page_id ? (sCompanyMap.get(s.company_page_id) ?? null) : null,
    })) as unknown as AppStory[];
  } catch (e) {
    console.warn("fetchActiveStories:", e);
    return [];
  }
}

export async function fetchActiveStoriesForUser(currentUserId: string): Promise<StoryGroup[]> {
  try {
    const { data: storiesRaw, error } = await supabase
      .from("stories")
      .select("id, user_id, company_page_id, image_url, video_url, text, tagged_users, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    if (error || !storiesRaw || storiesRaw.length === 0) return [];

    const gsUserIds = [...new Set((storiesRaw as any[]).map(s => s.user_id).filter(Boolean))];
    const gsCompanyIds = [...new Set((storiesRaw as any[]).map(s => s.company_page_id).filter(Boolean))];
    const [gsProfileMap, gsCompanyMap, viewsRes] = await Promise.all([
      fetchCommentProfilesForIds(gsUserIds),
      fetchCompanyPagesForIds(gsCompanyIds),
      supabase.from("story_views").select("story_id").eq("user_id", currentUserId),
    ]);

    const viewedIds = new Set((viewsRes.data ?? []).map((v: { story_id: string }) => v.story_id));

    const stories = (storiesRaw as any[]).map(s => ({
      ...s,
      author: gsProfileMap.get(s.user_id) ?? null,
      company_page: s.company_page_id ? (gsCompanyMap.get(s.company_page_id) ?? null) : null,
    }));

    const storiesWithViewed = (stories as unknown as AppStory[]).map(s => ({
      ...s,
      viewed: viewedIds.has(s.id),
    }));

    // Group by company_page_id (if set) or user_id
    const groupMap = new Map<string, StoryGroup>();
    for (const story of storiesWithViewed) {
      const groupKey = story.company_page_id ? `company_${story.company_page_id}` : story.user_id;
      if (!groupMap.has(groupKey)) {
        if (story.company_page_id && story.company_page) {
          groupMap.set(groupKey, {
            userId: story.user_id,
            companyPageId: story.company_page_id,
            companyPage: story.company_page,
            author: {
              id: story.company_page.id,
              full_name: story.company_page.name,
              avatar_url: story.company_page.avatar_url ?? null,
            },
            stories: [],
            hasUnseen: false,
          });
        } else {
          groupMap.set(groupKey, {
            userId: story.user_id,
            author: story.author ?? { id: story.user_id, full_name: "Usuário", avatar_url: null },
            stories: [],
            hasUnseen: false,
          });
        }
      }
      const group = groupMap.get(groupKey)!;
      group.stories.push(story);
      if (!story.viewed) group.hasUnseen = true;
    }

    const ownGroup = groupMap.get(currentUserId);
    const otherGroups = [...groupMap.values()].filter(g => g.userId !== currentUserId || g.companyPageId);
    const result: StoryGroup[] = [];
    if (ownGroup) result.push(ownGroup);
    result.push(...otherGroups.sort((a, b) => (b.hasUnseen ? 1 : 0) - (a.hasUnseen ? 1 : 0)));
    return result;
  } catch (e) {
    console.warn("fetchActiveStoriesForUser:", e);
    return [];
  }
}

export async function markStoryViewed(storyId: string, userId: string): Promise<void> {
  try {
    await supabase
      .from("story_views")
      .upsert(
        { story_id: storyId, user_id: userId },
        { onConflict: "story_id,user_id", ignoreDuplicates: true }
      );
  } catch (e) {
    console.warn("markStoryViewed:", e);
  }
}

export async function fetchStoryViewers(storyId: string): Promise<{ id: string; full_name: string; avatar_url?: string | null }[]> {
  try {
    const { data, error } = await supabase
      .from("story_views")
      .select("user_id")
      .eq("story_id", storyId);

    if (error || !data || data.length === 0) return [];
    const viewerIds = (data as any[]).map(d => d.user_id).filter(Boolean);
    const profileMap = await fetchCommentProfilesForIds(viewerIds);
    return viewerIds.map(id => profileMap.get(id)).filter((v): v is { id: string; full_name: string; avatar_url: string | null } => v != null);
  } catch (e) {
    console.warn("fetchStoryViewers:", e);
    return [];
  }
}

export async function uploadStoryImage(userId: string, uri: string): Promise<string | null> {
  try {
    const ext = uri.split(".").pop()?.split("?")[0] ?? "jpg";
    const fileName = `${userId}/${Date.now()}.${ext}`;

    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from("stories")
      .upload(fileName, bytes, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, upsert: true });

    if (error) { console.error("uploadStoryImage:", error); return null; }

    const { data: urlData } = supabase.storage.from("stories").getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("uploadStoryImage:", e);
    return null;
  }
}

export interface VideoPartInfo {
  baseUrl: string;
  startTime: number;
  endTime: number;
  partNumber: number;
  totalParts: number;
}

export function parseVideoPartInfo(videoUrl: string): VideoPartInfo | null {
  try {
    const hashIdx = videoUrl.indexOf("#");
    if (hashIdx === -1) return null;
    const baseUrl = videoUrl.slice(0, hashIdx);
    const frag = videoUrl.slice(hashIdx + 1);
    const p = new URLSearchParams(frag);
    const s = p.get("s"); const e = p.get("e"); const part = p.get("p"); const total = p.get("t");
    if (!s || !e || !part || !total) return null;
    return { baseUrl, startTime: Number(s), endTime: Number(e), partNumber: Number(part), totalParts: Number(total) };
  } catch {
    return null;
  }
}

function buildVideoUrlWithPartInfo(baseUrl: string, startTime: number, endTime: number, partNumber: number, totalParts: number): string {
  return `${baseUrl}#s=${startTime}&e=${endTime}&p=${partNumber}&t=${totalParts}`;
}

export async function uploadStoryVideo(userId: string, uri: string): Promise<string | null> {
  try {
    const ext = uri.split(".").pop()?.split("?")[0]?.toLowerCase() ?? "mp4";
    const fileName = `${userId}/video_${Date.now()}.${ext}`;
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const mimeType = ext === "mov" ? "video/quicktime" : `video/${ext}`;
    const { data, error } = await supabase.storage
      .from("stories")
      .upload(fileName, bytes, { contentType: mimeType, upsert: true });
    if (error) { console.error("uploadStoryVideo:", error); return null; }
    const { data: urlData } = supabase.storage.from("stories").getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (e) {
    console.error("uploadStoryVideo:", e);
    return null;
  }
}

export async function createStory(
  userId: string,
  options: { text?: string; imageUri?: string; videoUri?: string; taggedUsers?: string[]; companyPageId?: string | null }
): Promise<AppStory | null> {
  try {
    let imageUrl: string | null = null;
    let videoUrl: string | null = null;

    if (options.imageUri) {
      imageUrl = await uploadStoryImage(userId, options.imageUri);
      if (!imageUrl) {
        console.error("createStory: image upload failed, aborting story creation");
        return null;
      }
    }

    if (options.videoUri) {
      videoUrl = await uploadStoryVideo(userId, options.videoUri);
      if (!videoUrl) {
        console.error("createStory: video upload failed, aborting story creation");
        return null;
      }
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const insertPayload: any = {
      user_id: userId,
      text: options.text ?? null,
      image_url: imageUrl,
      video_url: videoUrl,
      tagged_users: options.taggedUsers ?? [],
      expires_at: expiresAt,
    };
    if (options.companyPageId) insertPayload.company_page_id = options.companyPageId;

    const { data, error } = await supabase
      .from("stories")
      .insert(insertPayload)
      .select("id, user_id, company_page_id, image_url, video_url, text, tagged_users, created_at, expires_at")
      .single();

    if (error) { console.error("createStory:", error); return null; }

    const storyId = (data as any).id;
    const csUserId = (data as any).user_id;
    const csCompanyId = (data as any).company_page_id;
    const [csProfileMap, csCompanyMap] = await Promise.all([
      fetchCommentProfilesForIds([csUserId]),
      csCompanyId ? fetchCompanyPagesForIds([csCompanyId]) : Promise.resolve(new Map()),
    ]);

    const taggedIds: string[] = (options.taggedUsers ?? []).filter(id => id !== userId);
    if (taggedIds.length > 0) {
      const actorName = csProfileMap.get(csUserId)?.full_name ?? "Alguém";
      const notifs = taggedIds.map(id => ({
        user_id: id,
        actor_id: userId,
        type: "story_tag",
        message: `${actorName} marcou você em um Momento`,
        metadata: { story_id: storyId },
      }));
      await supabase.from("notifications").insert(notifs).then(({ error: ne }) => {
        if (ne) console.warn("createStory: notification insert failed", ne);
      });
      // Send push notification (best-effort)
      if (API_URL) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch(`${API_URL}/push/story-tag`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ taggedUserIds: taggedIds, actorName, storyId }),
          }).catch(() => {});
        }
      }
    }

    return {
      ...(data as any),
      author: csProfileMap.get(csUserId) ?? null,
      company_page: csCompanyId ? (csCompanyMap.get(csCompanyId) ?? null) : null,
    } as unknown as AppStory;
  } catch (e) {
    console.error("createStory:", e);
    return null;
  }
}

export async function createVideoStoryParts(
  userId: string,
  options: {
    text?: string;
    videoUri: string;
    videoDurationMs: number;
    taggedUsers?: string[];
    companyPageId?: string | null;
  }
): Promise<boolean> {
  try {
    const videoUrl = await uploadStoryVideo(userId, options.videoUri);
    if (!videoUrl) { console.error("createVideoStoryParts: upload failed"); return false; }

    const totalDurationSec = Math.ceil(options.videoDurationMs / 1000);
    const segmentSec = 60;
    const totalParts = Math.ceil(totalDurationSec / segmentSec);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const taggedIds: string[] = (options.taggedUsers ?? []).filter(id => id !== userId);

    const inserts: any[] = [];
    for (let i = 0; i < totalParts; i++) {
      const startTime = i * segmentSec;
      const endTime = Math.min((i + 1) * segmentSec, totalDurationSec);
      const partUrl = buildVideoUrlWithPartInfo(videoUrl, startTime, endTime, i + 1, totalParts);
      const payload: any = {
        user_id: userId,
        text: options.text ?? null,
        image_url: null,
        video_url: partUrl,
        tagged_users: options.taggedUsers ?? [],
        expires_at: expiresAt,
      };
      if (options.companyPageId) payload.company_page_id = options.companyPageId;
      inserts.push(payload);
    }

    const { data, error } = await supabase.from("stories").insert(inserts).select("id, user_id");
    if (error) { console.error("createVideoStoryParts:", error); return false; }

    if (taggedIds.length > 0 && data && (data as any[]).length > 0) {
      const firstId = (data as any[])[0].id;
      const profileMap = await fetchCommentProfilesForIds([userId]);
      const actorName = profileMap.get(userId)?.full_name ?? "Alguém";
      const notifs = taggedIds.map(id => ({
        user_id: id,
        actor_id: userId,
        type: "story_tag",
        message: `${actorName} marcou você em um Momento`,
        metadata: { story_id: firstId },
      }));
      await supabase.from("notifications").insert(notifs).then(({ error: ne }) => {
        if (ne) console.warn("createVideoStoryParts: notification failed", ne);
      });
      // Send push notification (best-effort)
      if (API_URL) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch(`${API_URL}/push/story-tag`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ taggedUserIds: taggedIds, actorName, storyId: firstId }),
          }).catch(() => {});
        }
      }
    }
    return true;
  } catch (e) {
    console.error("createVideoStoryParts:", e);
    return false;
  }
}

export async function repostStory(currentUserId: string, story: AppStory): Promise<AppStory | null> {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("stories")
      .insert({
        user_id: currentUserId,
        image_url: story.image_url ?? null,
        video_url: story.video_url ?? null,
        text: story.text ?? null,
        tagged_users: [],
        expires_at: expiresAt,
      })
      .select("id, user_id, company_page_id, image_url, video_url, text, tagged_users, created_at, expires_at")
      .single();
    if (error) { console.error("repostStory:", error); return null; }
    const rUserId = (data as any).user_id;
    const profileMap = await fetchCommentProfilesForIds([rUserId, story.user_id]);
    if (story.user_id && story.user_id !== currentUserId) {
      const actorName = profileMap.get(currentUserId)?.full_name ?? "Alguém";
      await supabase.from("notifications").insert({
        user_id: story.user_id,
        actor_id: currentUserId,
        type: "story_repost",
        message: `${actorName} repostou seu Momento`,
        reference_id: story.id,
      });
    }
    return {
      ...(data as any),
      author: profileMap.get(rUserId) ?? null,
      company_page: null,
    } as unknown as AppStory;
  } catch (e) {
    console.error("repostStory:", e);
    return null;
  }
}
