import React, { createContext, useCallback, useContext, useState } from "react";
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

  const refreshUnread = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from("conversation_participants")
        .select("unread_count")
        .eq("user_id", userId);
      if (data) {
        const total = (data as any[]).reduce((acc, r) => acc + (r.unread_count ?? 0), 0);
        setUnreadCount(total);
      }
    } catch {
      // silently ignore
    }
  }, []);

  return (
    <UnreadContext.Provider value={{ unreadCount, setUnreadCount, refreshUnread }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
