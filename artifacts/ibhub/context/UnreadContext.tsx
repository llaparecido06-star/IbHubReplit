import React, { createContext, useContext, useState } from "react";

interface UnreadContextType {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
}

const UnreadContext = createContext<UnreadContextType>({
  unreadCount: 0,
  setUnreadCount: () => {},
});

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  return (
    <UnreadContext.Provider value={{ unreadCount, setUnreadCount }}>
      {children}
    </UnreadContext.Provider>
  );
}

export function useUnread() {
  return useContext(UnreadContext);
}
