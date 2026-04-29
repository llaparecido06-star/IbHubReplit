import { supabase } from "@/context/AuthContext";

// ─── ANALYTICS ───────────────────────────────────────────────────────────────

export interface DailyEngagement {
  date: string;
  likes: number;
  comments: number;
}

export interface TopPost {
  id: string;
  content: string;
  likes: number;
  comments: number;
  engagement: number;
}

export interface UserAnalytics {
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalPosts: number;
  followersCount: number;
  dailyEngagement: DailyEngagement[];
  topPosts: TopPost[];
}

export interface CompanyAnalytics {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  followersCount: number;
  currentWeekLikes: number;
  currentWeekComments: number;
  currentWeekPosts: number;
  prevWeekLikes: number;
  prevWeekComments: number;
  prevWeekPosts: number;
  dailyEngagement: DailyEngagement[];
  topPosts: TopPost[];
}

function buildDailyEngagement(
  likesDates: string[],
  commentsDates: string[],
  days = 14,
): DailyEngagement[] {
  const result: DailyEngagement[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      likes: likesDates.filter((s) => s.slice(0, 10) === key).length,
      comments: commentsDates.filter((s) => s.slice(0, 10) === key).length,
    });
  }
  return result;
}

export async function fetchUserAnalytics(userId: string): Promise<UserAnalytics> {
  try {
    const cutoff14 = new Date();
    cutoff14.setDate(cutoff14.getDate() - 14);
    const cutoff14Iso = cutoff14.toISOString();

    const [postsRes, profileRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, content, likes_count, comments_count, shares_count")
        .eq("user_id", userId),
      supabase
        .from("profiles")
        .select("followers_count")
        .eq("id", userId)
        .single(),
    ]);

    const posts: any[] = postsRes.data ?? [];
    const followersCount: number = (profileRes.data as any)?.followers_count ?? 0;

    const totalLikes = posts.reduce((s: number, p: any) => s + (p.likes_count ?? 0), 0);
    const totalComments = posts.reduce((s: number, p: any) => s + (p.comments_count ?? 0), 0);
    const totalShares = posts.reduce((s: number, p: any) => s + (p.shares_count ?? 0), 0);

    const postIds = posts.map((p: any) => p.id);

    let likesDates: string[] = [];
    let commentsDates: string[] = [];

    if (postIds.length > 0) {
      const [likesRes, commentsRes] = await Promise.all([
        supabase
          .from("likes")
          .select("created_at")
          .in("post_id", postIds)
          .gte("created_at", cutoff14Iso),
        supabase
          .from("comments")
          .select("created_at")
          .in("post_id", postIds)
          .gte("created_at", cutoff14Iso),
      ]);
      likesDates = (likesRes.data ?? []).map((r: any) => r.created_at as string);
      commentsDates = (commentsRes.data ?? []).map((r: any) => r.created_at as string);
    }

    const dailyEngagement = buildDailyEngagement(likesDates, commentsDates, 14);

    const topPosts: TopPost[] = posts
      .map((p: any) => ({
        id: p.id,
        content: p.content,
        likes: p.likes_count ?? 0,
        comments: p.comments_count ?? 0,
        engagement: (p.likes_count ?? 0) + (p.comments_count ?? 0),
      }))
      .sort((a: TopPost, b: TopPost) => b.engagement - a.engagement)
      .slice(0, 3);

    return { totalLikes, totalComments, totalShares, totalPosts: posts.length, followersCount, dailyEngagement, topPosts };
  } catch (e) {
    console.error("fetchUserAnalytics:", e);
    return { totalLikes: 0, totalComments: 0, totalShares: 0, totalPosts: 0, followersCount: 0, dailyEngagement: [], topPosts: [] };
  }
}

export async function fetchCompanyAnalytics(companyUserId: string): Promise<CompanyAnalytics> {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    const cutoff14 = new Date(now);
    cutoff14.setDate(now.getDate() - 14);

    const [postsRes, profileRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, content, likes_count, comments_count, shares_count, created_at")
        .eq("user_id", companyUserId),
      supabase
        .from("profiles")
        .select("followers_count")
        .eq("id", companyUserId)
        .single(),
    ]);

    const posts: any[] = postsRes.data ?? [];
    const followersCount: number = (profileRes.data as any)?.followers_count ?? 0;

    const totalLikes = posts.reduce((s: number, p: any) => s + (p.likes_count ?? 0), 0);
    const totalComments = posts.reduce((s: number, p: any) => s + (p.comments_count ?? 0), 0);

    const currentWeekPosts = posts.filter((p: any) => new Date(p.created_at) >= startOfWeek).length;
    const prevWeekPosts = posts.filter((p: any) => {
      const d = new Date(p.created_at);
      return d >= startOfPrevWeek && d < startOfWeek;
    }).length;

    const postIds = posts.map((p: any) => p.id);

    let likesDates: string[] = [];
    let commentsDates: string[] = [];
    let currentWeekLikes = 0;
    let currentWeekComments = 0;
    let prevWeekLikes = 0;
    let prevWeekComments = 0;

    if (postIds.length > 0) {
      const [likesRes, commentsRes] = await Promise.all([
        supabase
          .from("likes")
          .select("created_at")
          .in("post_id", postIds),
        supabase
          .from("comments")
          .select("created_at")
          .in("post_id", postIds),
      ]);
      const allLikesDates: string[] = (likesRes.data ?? []).map((r: any) => r.created_at as string);
      const allCommentsDates: string[] = (commentsRes.data ?? []).map((r: any) => r.created_at as string);

      currentWeekLikes = allLikesDates.filter((d) => new Date(d) >= startOfWeek).length;
      currentWeekComments = allCommentsDates.filter((d) => new Date(d) >= startOfWeek).length;
      prevWeekLikes = allLikesDates.filter((d) => { const dt = new Date(d); return dt >= startOfPrevWeek && dt < startOfWeek; }).length;
      prevWeekComments = allCommentsDates.filter((d) => { const dt = new Date(d); return dt >= startOfPrevWeek && dt < startOfWeek; }).length;

      likesDates = allLikesDates.filter((d) => new Date(d) >= cutoff14);
      commentsDates = allCommentsDates.filter((d) => new Date(d) >= cutoff14);
    }

    const dailyEngagement = buildDailyEngagement(likesDates, commentsDates, 14);

    const topPosts: TopPost[] = posts
      .map((p: any) => ({
        id: p.id,
        content: p.content,
        likes: p.likes_count ?? 0,
        comments: p.comments_count ?? 0,
        engagement: (p.likes_count ?? 0) + (p.comments_count ?? 0),
      }))
      .sort((a: TopPost, b: TopPost) => b.engagement - a.engagement)
      .slice(0, 3);

    return {
      totalPosts: posts.length,
      totalLikes,
      totalComments,
      followersCount,
      currentWeekLikes,
      currentWeekComments,
      currentWeekPosts,
      prevWeekLikes,
      prevWeekComments,
      prevWeekPosts,
      dailyEngagement,
      topPosts,
    };
  } catch (e) {
    console.error("fetchCompanyAnalytics:", e);
    return {
      totalPosts: 0, totalLikes: 0, totalComments: 0, followersCount: 0,
      currentWeekLikes: 0, currentWeekComments: 0, currentWeekPosts: 0,
      prevWeekLikes: 0, prevWeekComments: 0, prevWeekPosts: 0,
      dailyEngagement: [], topPosts: [],
    };
  }
}
