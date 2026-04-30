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
   * Accurate count: fetches all conversation_ids the user participates in,
   * then counts messages with read_at IS NULL and sender != user.
   * Two queries total instead of N+1.
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

      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .neq("sender_id", userId)
        .is("read_at", null);

      setUnreadCount(count ?? 0);
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

          // Optimistic increment, then reconcile with DB.
          setUnreadCount((prev) => prev + 1);
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
