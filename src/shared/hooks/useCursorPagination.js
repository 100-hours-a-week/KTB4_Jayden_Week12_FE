import { useCallback, useEffect, useRef, useState } from 'react';

function appendUniqueById(currentItems, nextItems, getItemId) {
  const existingIds = new Set(currentItems.map((item) => String(getItemId(item))));
  return [...currentItems, ...nextItems.filter((item) => !existingIds.has(String(getItemId(item))))];
}

export function useCursorPagination({ fetchPage, getCursor, getItemId, pageSize }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [hasNext, setHasNext] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);
  const isRequestingRef = useRef(false);
  const cursorRef = useRef(null);
  const hasNextRef = useRef(true);
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);

  const loadPage = useCallback(async ({ reset = false, throwOnError = false } = {}) => {
    if (!reset && (isRequestingRef.current || !hasNextRef.current)) return;
    if (reset) controllerRef.current?.abort();

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const controller = new AbortController();
    controllerRef.current = controller;
    isRequestingRef.current = true;

    if (reset) {
      setStatus('loading');
      setError(null);
      setLoadMoreError(null);
    } else {
      setIsLoadingMore(true);
      setLoadMoreError(null);
    }

    try {
      const nextItems = await fetchPage({
        cursor: reset ? null : cursorRef.current,
        signal: controller.signal,
      });
      if (requestIdRef.current !== requestId) return;

      const nextHasNext = nextItems.length === pageSize;
      setItems((currentItems) => reset
        ? nextItems
        : appendUniqueById(currentItems, nextItems, getItemId));
      if (reset) setStatus(nextItems.length === 0 ? 'empty' : 'success');
      cursorRef.current = nextItems.length > 0 ? getCursor(nextItems.at(-1)) : null;
      hasNextRef.current = nextHasNext;
      setHasNext(nextHasNext);
    } catch (requestError) {
      if (requestError?.name === 'AbortError' || requestIdRef.current !== requestId) return;
      if (reset) {
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
      }
    }
  }, [fetchPage, getCursor, getItemId, pageSize]);

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
  const appendItem = useCallback((item) => {
    setItems((currentItems) => appendUniqueById(currentItems, [item], getItemId));
    setStatus('success');
  }, [getItemId]);

  return {
    items,
    setItems,
    status,
    error,
    hasNext,
    isLoadingMore,
    loadMoreError,
    reset,
    loadMore,
    appendItem,
    retryLoadMore: loadMore,
  };
}
