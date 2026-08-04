import { useCallback } from 'react';
import { useCursorPagination } from '../../shared/hooks/useCursorPagination.js';
import { CHAT_ROOM_PAGE_SIZE, getChatRooms } from './chatService.js';

const getRoomId = (room) => room.chatRoomId;
const getRoomCursor = (room) => ({
  createdAt: room.createdAt,
  lastMessageId: room.lastMessageId,
});

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
    pageSize: CHAT_ROOM_PAGE_SIZE,
  });
  return { ...pagination, retry: pagination.reset };
}
