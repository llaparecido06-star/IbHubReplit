import { useState, useCallback, useRef } from "react";

const DEFAULT_PAGE_SIZE = 15;

export interface UsePaginatedQueryResult<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * Generic infinite-scroll pagination hook.
 * Screens call `refresh()` on mount and `loadMore()` from `onEndReached`.
 * The fetcher receives (offset, limit) and returns an array of items.
 */
export function usePaginatedQuery<T>(
  fetcher: (offset: number, limit: number) => Promise<T[]>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): UsePaginatedQueryResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const offsetRef = useRef(0);
  const isLoadingRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    offsetRef.current = 0;
    try {
      const data = await fetcherRef.current(0, pageSize);
      setItems(data as T[]);
      setHasMore(data.length >= pageSize);
      offsetRef.current = data.length;
    } catch (e) {
      console.warn("usePaginatedQuery refresh:", e);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [pageSize]);

  const loadMore = useCallback(() => {
    if (isLoadingRef.current || !hasMore) return;
    isLoadingRef.current = true;
    setLoadingMore(true);
    fetcherRef.current(offsetRef.current, pageSize).then((data) => {
      if (data.length > 0) {
        setItems((prev) => {
          const existingIds = new Set((prev as any[]).map((item: any) => item.id));
          const fresh = (data as any[]).filter((item: any) => !existingIds.has(item.id));
          return [...prev, ...(fresh as T[])];
        });
        offsetRef.current += data.length;
      }
      setHasMore(data.length >= pageSize);
    }).catch((e) => {
      console.warn("usePaginatedQuery loadMore:", e);
    }).finally(() => {
      setLoadingMore(false);
      isLoadingRef.current = false;
    });
  }, [hasMore, pageSize]);

  return { items, loading, loadingMore, hasMore, loadMore, refresh, setItems };
}
