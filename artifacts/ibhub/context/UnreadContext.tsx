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
   * Badge count = number of CONVERSATIONS with at least one unread message,
   * NOT the total number of unread messages.
   *
   * Example: if 3 conversations each have 10 unread messages, badge = 3, not 30.
   *
   * Two queries total:
   *  1. conversation_participants → get the user's conversation IDs.
   *  2. messages → get conversation_ids of unread messages; deduplicate with Set.
   */
  const refreshUnread = useCallback(async (userId: string) => {
    try {
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      const convIds = (participations ?? []).map((p: any) => p.conversation_id as string);
      if (convIds.length === 0) {
        setUnreadCount(0);
        return;
      }

      // Fetch only the conversation_id column (no body/payload) for unread messages.
      // Using Set deduplication we get the count of unique conversations with unread msgs.
      const { data: unreadMsgs } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", convIds)
        .neq("sender_id", userId)
        .is("read_at", null);

      const unreadConvCount = new Set(
        (unreadMsgs ?? []).map((m: any) => m.conversation_id as string),
      ).size;

      setUnreadCount(unreadConvCount);
    } catch {
      // silently ignore — badge simply won't update on network error
    }
  }, []);

  /**
   * Global realtime subscription — active for the entire authenticated session,
   * regardless of which tab/screen the user is on.
   *
   * When a new message arrives that is NOT from the current user:
   *   1. Increment the badge immediately for snappy UX.
   *   2. Refresh from the DB for accuracy (handles edge cases like
   *      messages arriving out of order or for conversations not yet loaded).
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

          // Refresh from DB — no optimistic +1 here because the badge counts
          // unique *conversations* with unread messages, not total messages.
          // Adding +1 per message would inflate the count (e.g. 22 instead of 3).
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
