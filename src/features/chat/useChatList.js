import { useCallback, useEffect } from 'react';
import { useCursorPagination } from '../../shared/hooks/useCursorPagination.js';
import { CHAT_ROOM_PAGE_SIZE, getChatRooms } from './chatService.js';

const getRoomId = (room) => room.chatRoomId;
const getRoomCursor = (room) => ({
  createdAt: room.createdAt,
  lastMessageId: room.lastMessageId,
});
const CHAT_LIST_SYNC_INTERVAL_MS = 30000;

function mergeRefreshedRooms(currentRooms, firstPageRooms) {
  if (firstPageRooms.length < CHAT_ROOM_PAGE_SIZE) return firstPageRooms;
  const firstPageIds = new Set(firstPageRooms.map((room) => String(room.chatRoomId)));
  return [
    ...firstPageRooms,
    ...currentRooms.filter((room) => !firstPageIds.has(String(room.chatRoomId))),
  ];
}

export function useChatList() {
  const fetchPage = useCallback(({ cursor, signal }) => getChatRooms({
    createdAtCursor: cursor?.createdAt,
    lastMessageIdCursor: cursor?.lastMessageId,
    pageSize: CHAT_ROOM_PAGE_SIZE,
    signal,
  }), []);
  const pagination = useCursorPagination({
    fetchPage,
    getCursor: getRoomCursor,
    getItemId: getRoomId,
    mergeRefreshedPage: mergeRefreshedRooms,
    pageSize: CHAT_ROOM_PAGE_SIZE,
  });
  const { refresh } = pagination;

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(refreshWhenVisible, CHAT_LIST_SYNC_INTERVAL_MS);
    window.addEventListener('focus', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [refresh]);

  return {
    ...pagination,
    retry: pagination.reset,
    retryRefresh: refresh,
  };
}
