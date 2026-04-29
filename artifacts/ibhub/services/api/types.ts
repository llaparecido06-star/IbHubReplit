

// ─── Types ───────────────────────────────────────────────────────────────────

/** Lightweight profile shape returned by AUTHOR_SELECT (fetchProfilesForIds). */
export interface ProfileLite {
  id: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
  position?: string | null;
  company?: string | null;
  plan?: string | null;
  is_shadowbanned?: boolean | null;
  /** Computed from position + company by normaliseAuthor. */
  headline?: string | null;
}

/** Even slimmer profile shape (no plan/shadowban) returned by COMMENT_AUTHOR_SELECT. */
export interface CommentProfileLite {
  id: string;
  full_name: string;
  avatar_url: string | null;
  position?: string | null;
  company?: string | null;
  headline?: string | null;
  /** Not always selected; some callers read it. May be undefined. */
  username?: string | null;
}

/** Slim company-page shape returned by fetchCompanyPagesForIds. */
export interface CompanyPageLite {
  id: string;
  owner_id: string;
  name: string;
  avatar_url: string | null;
  industry: string | null;
}

/** Raw post row from Supabase (POST_SELECT_BASE). Author/company are attached separately. */
export interface RawPostRow {
  id: string;
  user_id: string;
  company_page_id?: string | null;
  content: string;
  image_url?: string | null;
  image_urls?: string[] | null;
  video_url?: string | null;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  view_count?: number;
  location?: string | null;
  hashtags?: string[] | null;
  poll?: PollData | null;
  created_at: string;
}

export interface PollData {
  options: string[];
  votes: Record<string, number>;
  user_votes?: Record<string, number | number[]>;
  multi?: boolean;
  ends_at?: string | null;
  /** Computed client-side: indices the current user voted for. */
  user_voted_indices?: number[];
  /** Computed client-side: convenience first index from user_voted_indices. */
  user_voted_index?: number | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  actor_id?: string | null;
  actor_company_id?: string | null;
  type: string;
  post_id?: string | null;
  comment_id?: string | null;
  message?: string | null;
  read: boolean;
  created_at: string;
  actor?: { id: string; full_name: string; avatar_url?: string | null } | null;
  actor_company?: { id: string; name: string; avatar_url?: string | null } | null;
  connection_id?: string | null;
  connection_status?: "pending" | "accepted" | "rejected" | null;
  metadata?: Record<string, any> | null;
}

export interface AppComment {
  id: string;
  post_id: string;
  parent_comment_id?: string | null;
  user_id: string;
  company_page_id?: string | null;
  content: string;
  created_at: string;
  likes_count?: number;
  is_liked?: boolean;
  author?: { id: string; full_name: string; avatar_url?: string | null; headline?: string | null } | null;
  company_page?: { id: string; name: string; avatar_url?: string | null } | null;
  replies?: AppComment[];
}

export interface AppStory {
  id: string;
  user_id: string;
  image_url?: string | null;
  video_url?: string | null;
  text?: string | null;
  tagged_users?: string[] | null;
  created_at: string;
  expires_at: string;
  author?: { id: string; full_name: string; avatar_url?: string | null } | null;
  company_page_id?: string | null;
  company_page?: { id: string; name: string; avatar_url?: string | null } | null;
  viewed?: boolean;
}

export interface StoryGroup {
  userId: string;
  author: { id: string; full_name: string; avatar_url?: string | null };
  companyPageId?: string | null;
  companyPage?: { id: string; name: string; avatar_url?: string | null } | null;
  stories: AppStory[];
  hasUnseen: boolean;
}

export interface AppMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  from_company_page_id?: string | null;
  from_company_page?: { id: string; name: string; avatar_url?: string | null } | null;
  content: string;
  created_at: string;
  message_type?: "text" | "image" | "video" | "audio" | "file" | "post_share" | "wine_card";
  media_url?: string | null;
  reply_to_id?: string | null;
  reply_to?: { content: string; sender_id: string } | null;
  read_at?: string | null;
  metadata?: Record<string, any> | null;
  reactions?: AppMessageReaction[];
}

export interface AppMessageReaction {
  emoji: string;
  count: number;
  mine: boolean;
  users?: string[];
}

export interface AppConversation {
  id: string;
  is_group: boolean;
  name?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count: number;
  participant?: { id: string; full_name: string; avatar_url?: string | null } | null;
  participant_company?: { id: string; name: string; avatar_url?: string | null } | null;
  accepted?: boolean;
  company_page_id?: string | null;
}
