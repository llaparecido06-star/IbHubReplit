import { supabase } from "@/context/AuthContext";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { API_URL, fetchCommentProfilesForIds, fetchProfilesForIds } from "./_shared";
import type { AppMessage } from "./types";

// ─── REPORTS ─────────────────────────────────────────────────────────────────

export interface AppReportPost {
  id: string;
  content: string;
  user_id: string;
}

export interface AppReportReporter {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

export interface AppReport {
  id: string;
  post_id: string | null;
  reported_user_id?: string | null;
  reported_by: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reporter?: AppReportReporter | null;
  post?: AppReportPost | null;
  reported_user?: AppReportReporter | null;
}

export async function createReport(params: {
  post_id?: string | null;
  reported_user_id?: string | null;
  reported_by: string;
  reason: string;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("reports")
      .insert({ ...params, status: "pending" });
    if (error) { console.error("createReport:", error); return false; }
    return true;
  } catch (e) {
    console.error("createReport:", e);
    return false;
  }
}

// ── "Não tenho interesse" ─────────────────────────────────────────────────────
// Stores client-side via AsyncStorage (table may not exist yet) +
// best-effort Supabase insert into `post_hidden`
export async function hidePost(userId: string, postId: string): Promise<void> {
  try {
    await supabase.from("post_hidden").insert({ user_id: userId, post_id: postId });
  } catch {
    // silently ignore if table doesn't exist — feed filters it out locally
  }
}

// ── Block user ────────────────────────────────────────────────────────────────
export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_blocks")
      .upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
    if (error) { console.error("blockUser:", error); return false; }
    return true;
  } catch (e) {
    console.error("blockUser:", e);
    return false;
  }
}

// ── Unblock user ──────────────────────────────────────────────────────────────
export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .match({ blocker_id: blockerId, blocked_id: blockedId });
    if (error) { console.error("unblockUser:", error); return false; }
    return true;
  } catch (e) {
    console.error("unblockUser:", e);
    return false;
  }
}

export interface BlockedUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface BlockedUserRow {
  blocked_id: string;
  profiles: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

export async function fetchBlockedUsers(userId: string): Promise<BlockedUser[]> {
  try {
    const { data, error } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", userId)
      .order("created_at", { ascending: false });
    
    if (error || !data || data.length === 0) return [];
    const blockedIds = (data as any[]).map(r => r.blocked_id).filter(Boolean);
    const profileMap = await fetchProfilesForIds(blockedIds);
    return blockedIds.map(id => {
      const p = profileMap.get(id) as any;
      return { id, full_name: p?.full_name ?? null, username: p?.username ?? null, avatar_url: p?.avatar_url ?? null };
    });
  } catch (e) {
    console.warn("fetchBlockedUsers:", e);
    return [];
  }
}
// ── Fetch IDs blocked by user (for feed filtering) ──────────────────────────
export async function fetchBlockedIds(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", userId);
    return (data ?? []).map((r: any) => r.blocked_id);
  } catch {
    return [];
  }
}

export async function fetchPendingReports(): Promise<AppReport[]> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, post_id, reported_user_id, reported_by, reason, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) return [];

    const reporterIds = [...new Set((data as any[]).map(r => r.reported_by).filter(Boolean))];
    const reportedUserIds = [...new Set((data as any[]).map(r => r.reported_user_id).filter(Boolean))];
    const postIds = [...new Set((data as any[]).map(r => r.post_id).filter(Boolean))];

    const allProfileIds = [...new Set([...reporterIds, ...reportedUserIds])];

    const [profileMap, postsRes] = await Promise.all([
      fetchCommentProfilesForIds(allProfileIds),
      postIds.length > 0
        ? supabase.from("posts").select("id, content, user_id").in("id", postIds)
        : Promise.resolve({ data: [] }),
    ]);
    const postMap = new Map(((postsRes as any).data ?? []).map((p: any) => [p.id, p]));

    return (data as any[]).map(r => ({
      ...r,
      reporter:      r.reported_by      ? (profileMap.get(r.reported_by)      ?? null) : null,
      reported_user: r.reported_user_id ? (profileMap.get(r.reported_user_id) ?? null) : null,
      post:          r.post_id          ? (postMap.get(r.post_id)              ?? null) : null,
    })) as unknown as AppReport[];
  } catch (e) {
    console.warn("fetchPendingReports:", e);
    return [];
  }
}

export async function updateReportStatus(
  reportId: string,
  status: "approved" | "rejected",
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", reportId)
      .select("id");
    if (error) { console.error("updateReportStatus:", error); return false; }
    // Verify at least one row was actually updated
    if (!data || data.length === 0) {
      console.error("updateReportStatus: no rows updated for id", reportId);
      return false;
    }
    return true;
  } catch (e) {
    console.error("updateReportStatus:", e);
    return false;
  }
}

export interface MyReport {
  id: string;
  post_id: string | null;
  reported_user_id: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export async function fetchMyReports(userId: string): Promise<MyReport[]> {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("id, post_id, reported_user_id, reason, status, created_at")
      .eq("reported_by", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { console.error("fetchMyReports:", error); return []; }
    return (data ?? []) as MyReport[];
  } catch (e) {
    console.error("fetchMyReports:", e);
    return [];
  }
}

export async function deletePost(postId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) { console.error("deletePost:", error); return false; }
    return true;
  } catch (e) {
    console.error("deletePost:", e);
    return false;
  }
}

export async function countPendingReports(): Promise<number> {
  try {
    const { count } = await supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    return count ?? 0;
  } catch { return 0; }
}

export async function getOrCreateDirectConversation(
  userId1: string,
  userId2: string,
  forceAccepted = false,
  companyPageId?: string | null,
): Promise<string | null> {
  try {
    // Use SECURITY DEFINER RPC to find existing conversation (bypasses cp_select RLS).
    // The RPC also matches on company_page_id so personal and company threads stay separate.
    const { data: existing } = await supabase.rpc("get_direct_conversation", {
      p_user1:           userId1,
      p_user2:           userId2,
      p_company_page_id: companyPageId ?? null,
    });
    if (existing) return existing as string;

    // Create the conversation via the API server using supabaseAdmin.
    // This ensures BOTH participant rows are inserted without RLS restrictions,
    // fixing the bug where the client-side RLS prevented inserting the recipient's row.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { console.error("getOrCreateDirectConversation: no session token"); return null; }

    const res = await fetch(`${API_URL}/conversations/direct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_id_1:      userId1,
        user_id_2:      userId2,
        company_page_id: companyPageId ?? null,
        force_accepted:  forceAccepted,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("getOrCreateDirectConversation server error:", res.status, errText);
      return null;
    }

    const json = await res.json();
    return (json.conversation_id as string) ?? null;
  } catch (e) {
    console.error("getOrCreateDirectConversation:", e);
    return null;
  }
}

export async function uploadChatMedia(
  conversationId: string,
  uri: string,
  mimeType: string,
  fileObj?: File | null,
  opts?: { accessToken?: string; userId?: string },
): Promise<string | null> {
  try {
    const safeMime = mimeType || "image/jpeg";
    const ext = safeMime.includes("/")
      ? safeMime.split("/")[1]?.replace("jpeg", "jpg").replace("quicktime", "mov").replace("x-m4a", "m4a") ?? "jpg"
      : "jpg";
    const fileName = `upload_${Date.now()}.${ext}`;

    const apiUrl = process.env.EXPO_PUBLIC_API_URL!;
    let token = opts?.accessToken;
    let userId = opts?.userId;
    if (!token || !userId) {
      const { data: sessionData } = await supabase.auth.getSession();
      token = token ?? sessionData?.session?.access_token;
      userId = userId ?? sessionData?.session?.user?.id;
    }
    if (!token || !userId) return null;

    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("mimeType", safeMime);

    if (Platform.OS === "web") {
      if (fileObj) {
        // Prefer the native File object — the blob URL may be revoked by the time we fetch it
        formData.append("file", fileObj, fileName);
      } else {
        // Fallback: fetch the URI (blob: or data: URL) and convert to Blob
        const blobRes = await fetch(uri);
        const blob = await blobRes.blob();
        formData.append("file", blob, fileName);
      }
    } else {
      // On native (iOS/Android), copy ph:// and content:// URIs to a local file:// path first
      let localUri = uri;
      if (localUri.startsWith("ph://") || localUri.startsWith("content://")) {
        const tmpPath = `${(FileSystem as any).cacheDirectory}tmp_upload_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: localUri, to: tmpPath });
        localUri = tmpPath;
      }

      if (safeMime.startsWith("audio/")) {
        // Audio files from expo-audio: convert URI → Blob via fetch() before appending.
        //
        // The { uri, name, type } FormData pattern relies on the RN bridge resolving
        // the file path natively. For expo-audio URIs on Android (and some iOS builds)
        // the bridge can fail silently — the multipart body arrives with 0 bytes and
        // multer receives an empty file. fetch() uses Expo's JS polyfill which
        // correctly reads file:// URIs on both platforms.
        try {
          const blobRes = await fetch(localUri);
          if (!blobRes.ok) throw new Error(`fetch audio URI status ${blobRes.status}`);
          const blob = await blobRes.blob();
          if (blob.size === 0) throw new Error("audio blob resolved to 0 bytes");
          console.log(`[uploadChatMedia] audio blob OK: ${blob.size} bytes, type: ${blob.type || safeMime}`);
          formData.append("file", blob, fileName);
        } catch (blobErr: any) {
          // Fallback: try the native { uri, name, type } pattern anyway
          console.error("[uploadChatMedia] blob conversion failed, trying native fallback:", blobErr?.message ?? blobErr);
          formData.append("file", { uri: localUri, name: fileName, type: safeMime } as any);
        }
      } else {
        // Images, videos, documents: stream via { uri, name, type } to avoid loading
        // the entire file into the JS heap (prevents OOM for large videos).
        formData.append("file", { uri: localUri, name: fileName, type: safeMime } as any);
      }
    }

    const res = await fetch(`${apiUrl}/uploads/chat-form`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type — let fetch set multipart/form-data with boundary
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.status.toString());
      console.error("uploadChatMedia API error:", text);
      return null;
    }

    const json = await res.json();
    return json.url ?? null;
  } catch (e) {
    console.error("uploadChatMedia:", e);
    return null;
  }
}

export async function sendMediaMessage(
  conversationId: string,
  senderId: string,
  mediaUrl: string,
  messageType: "image" | "video" | "audio" | "file",
  caption = "",
  companyPageId?: string | null,
  accessToken?: string,
): Promise<AppMessage | null> {
  try {
    let token = accessToken;
    if (!token) {
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData?.session?.access_token;
    }

    const body: Record<string, any> = {
      conversation_id: conversationId,
      sender_id: senderId,
      content: caption,
      message_type: messageType,
      media_url: mediaUrl,
    };
    if (companyPageId) body.from_company_page_id = companyPageId;

    const res = await fetch(`${API_URL}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[sendMediaMessage] server error:", res.status, errText);
      return null;
    }

    const json = await res.json();
    return json.data as AppMessage;
  } catch (e: any) {
    console.error("[sendMediaMessage] exception:", e?.message ?? e);
    return null;
  }
}
