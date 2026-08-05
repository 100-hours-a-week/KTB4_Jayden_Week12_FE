import { useCallback, useEffect, useRef, useState } from 'react';

function appendUniqueById(currentItems, nextItems, getItemId) {
  const existingIds = new Set(currentItems.map((item) => String(getItemId(item))));
  return [...currentItems, ...nextItems.filter((item) => !existingIds.has(String(getItemId(item))))];
}

export function useCursorPagination({
  fetchPage,
  getCursor,
  getItemId,
  mergeRefreshedPage,
  pageSize,
}) {
  const [items, setItemsState] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [hasNext, setHasNext] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const isRequestingRef = useRef(false);
  const itemsRef = useRef([]);
  const cursorRef = useRef(null);
  const hasNextRef = useRef(true);
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const setItems = useCallback((nextItemsOrUpdater) => {
    setItemsState((currentItems) => {
      const nextItems = typeof nextItemsOrUpdater === 'function'
        ? nextItemsOrUpdater(currentItems)
        : nextItemsOrUpdater;
      itemsRef.current = nextItems;
      return nextItems;
    });
  }, []);

  const loadPage = useCallback(async ({
    refresh = false,
    reset = false,
    throwOnError = false,
  } = {}) => {
    if (refresh && isRequestingRef.current) return;
    if (!reset && !refresh && (isRequestingRef.current || !hasNextRef.current)) return;
    if (reset) controllerRef.current?.abort();

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    controllerRef.current = controller;
    isRequestingRef.current = true;

    if (refresh) {
      setIsRefreshing(true);
      setRefreshError(null);
    } else if (reset) {
      setStatus('loading');
      setError(null);
      setLoadMoreError(null);
      setRefreshError(null);
    } else {
      setIsLoadingMore(true);
      setLoadMoreError(null);
    }

    try {
      const nextItems = await fetchPage({
        cursor: reset || refresh ? null : cursorRef.current,
        signal: controller.signal,
      });
      if (requestIdRef.current !== requestId) return;

      const nextHasNext = nextItems.length === pageSize;
      const committedItems = refresh
        ? mergeRefreshedPage?.(itemsRef.current, nextItems) ?? nextItems
        : reset
          ? nextItems
          : appendUniqueById(itemsRef.current, nextItems, getItemId);
      itemsRef.current = committedItems;
      setItemsState(committedItems);
      if (reset || refresh) {
        setError(null);
        setStatus(committedItems.length === 0 ? 'empty' : 'success');
      }
      cursorRef.current = committedItems.length > 0 ? getCursor(committedItems.at(-1)) : null;
      const committedHasNext = refresh && committedItems.length > nextItems.length
        ? hasNextRef.current
        : nextHasNext;
      hasNextRef.current = committedHasNext;
      setHasNext(committedHasNext);
    } catch (requestError) {
      if (requestError?.name === 'AbortError' || requestIdRef.current !== requestId) return;
      if (refresh) {
        setRefreshError(requestError);
      } else if (reset) {
        setError(requestError);
        setStatus('error');
      } else {
        setLoadMoreError(requestError);
      }
      if (throwOnError) throw requestError;
    } finally {
      if (requestIdRef.current === requestId) {
        isRequestingRef.current = false;
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    }
  }, [fetchPage, getCursor, getItemId, mergeRefreshedPage, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage({ reset: true }), 0);
    return () => {
      window.clearTimeout(timer);
      requestIdRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [loadPage]);

  const reset = useCallback(
    (options = {}) => loadPage({ ...options, reset: true }),
    [loadPage],
  );
  const loadMore = useCallback(() => loadPage(), [loadPage]);
  const refresh = useCallback(() => loadPage({ refresh: true }), [loadPage]);
  const appendItem = useCallback((item) => {
    setItems((currentItems) => appendUniqueById(currentItems, [item], getItemId));
    setStatus('success');
  }, [getItemId, setItems]);

  return {
    items,
    setItems,
    status,
    error,
    hasNext,
    isLoadingMore,
    loadMoreError,
    isRefreshing,
    refreshError,
    reset,
    refresh,
    loadMore,
    appendItem,
    retryLoadMore: loadMore,
  };
}
