import React, { createContext, useCallback, useContext, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "market_feed_last_seen_v1";

interface MarketFeedBadgeContextType {
  hasNewPost: boolean;
  checkForNewPosts: (latestCreatedAt: string | null) => Promise<void>;
  markFeedSeen: () => Promise<void>;
}

const MarketFeedBadgeContext = createContext<MarketFeedBadgeContextType>({
  hasNewPost: false,
  checkForNewPosts: async () => {},
  markFeedSeen: async () => {},
});

export function MarketFeedBadgeProvider({ children }: { children: React.ReactNode }) {
  const [hasNewPost, setHasNewPost] = useState(false);

  const checkForNewPosts = useCallback(async (latestCreatedAt: string | null) => {
    if (!latestCreatedAt) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const lastSeen = stored ? new Date(stored) : new Date(0);
      const latest   = new Date(latestCreatedAt);
      if (latest > lastSeen) setHasNewPost(true);
    } catch {}
  }, []);

  const markFeedSeen = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, new Date().toISOString());
      setHasNewPost(false);
    } catch {}
  }, []);

  return (
    <MarketFeedBadgeContext.Provider value={{ hasNewPost, checkForNewPosts, markFeedSeen }}>
      {children}
    </MarketFeedBadgeContext.Provider>
  );
}

export function useMarketFeedBadge() {
  return useContext(MarketFeedBadgeContext);
}
