import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/context/AuthContext";

interface UnreadContextType {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  refreshUnread: (userId: string) => Promise<void>;
}

const UnreadContext = createContext<UnreadContextType>({
  unreadCount: 0,
  setUnreadCount: () => {},
  refreshUnread: async () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  /**
   * Badge count = number of CONVERSATIONS with at least one truly unread message.
   *
   * Uses the same two-condition filter as fetchConversations to avoid false
   * positives from old messages where read_at was never set:
   *   1. read_at IS NULL  — message hasn't been individually marked as read
   *   2. created_at > last_read_at — message arrived after the last time the
   *      user opened this conversation (client-side filter using last_read_at
   *      from conversation_participants)
   *
   * Without condition 2, historical messages that pre-date the read_at column
   * (or whose read_at update failed silently) would produce a permanent false
   * positive badge that never clears.
   */
  const refreshUnread = useCallback(async (userId: string) => {
    try {
      // Fetch conversation membership + last_read_at in one query.
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId);

      const convIds = (participations ?? []).map((p: any) => p.conversation_id as string);
      if (convIds.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Build a map: conversation_id → last_read_at (may be null for never-opened convos)
      const lastReadMap = new Map<string, string | null>(
        (participations ?? []).map((p: any) => [
          p.conversation_id as string,
          (p.last_read_at as string | null) ?? null,
        ]),
      );

      // Fetch candidate unread messages (read_at IS NULL, not from self).
      // We also select created_at so we can apply the last_read_at filter client-side.
      const { data: candidateMsgs } = await supabase
        .from("messages")
        .select("conversation_id, created_at")
        .in("conversation_id", convIds)
        .neq("sender_id", userId)
        .is("read_at", null);

      // Apply the last_read_at guard client-side (mirrors fetchConversations logic).
      // A message is truly unread only if it arrived AFTER the last time the
      // user opened that conversation.
      const unreadConvCount = new Set(
        (candidateMsgs ?? [])
          .filter((m: any) => {
            const lastRead = lastReadMap.get(m.conversation_id as string);
            // No last_read_at → conversation was never opened → all messages are unread
            if (!lastRead) return true;
            return new Date(m.created_at as string) > new Date(lastRead);
          })
          .map((m: any) => m.conversation_id as string),
      ).size;

      setUnreadCount(unreadConvCount);
    } catch {
      // silently ignore — badge simply won't update on network error
    }
  }, []);

  /**
   * Global realtime subscription — active for the entire authenticated session,
   * regardless of which tab/screen the user is on.
   */
  useEffect(() => {
    if (!user?.id) return;

    // Initial badge load when the user logs in / app starts.
    refreshUnread(user.id);

    const uid = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`global-unread-${user.id}_${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any;
          if (!msg?.conversation_id) return;
          // Ignore own messages
          if (msg.sender_id === user.id) return;

          // Refresh from DB — no optimistic +1 because the badge counts
          // unique conversations with unread messages, not total messages.
          refreshUnread(user.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshUnread]);

  return (
    <UnreadContext.Provider value={{ unreadCount, setUnreadCount, refreshUnread }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
