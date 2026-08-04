import { requireArray, requireRecord } from '../../shared/api/contracts.js';
import { request } from '../../shared/api/httpClient.js';
import { validateChatRoomInfo, validateChatRoomSummary, validateDirectRoom, validateHistoryMessage } from './chatContracts.js';

export const CHAT_HISTORY_PAGE_SIZE = 30;
export const CHAT_ROOM_PAGE_SIZE = 20;

export async function resolveDirectRoom(opponentId, { signal } = {}) {
  const { payload, status } = await request('/chatrooms/direct', {
    method: 'POST',
    body: { opponentId },
    signal,
    includeResponseMeta: true,
  });
  const envelope = requireRecord(payload, 'direct room');
  const room = validateDirectRoom(envelope.data);
  const expectedStatus = room.created ? 201 : 200;
  const expectedMessage = room.created ? 'chat_room_created' : 'chat_room_read_success';
  if (status !== expectedStatus || envelope.message !== expectedMessage) {
    throw new Error('채팅방 응답 상태가 API 계약과 다릅니다.');
  }
  return room;
}

export async function getChatHistory(roomId, {
  lastMessageId,
  pageSize = CHAT_HISTORY_PAGE_SIZE,
  signal,
} = {}) {
  const params = new URLSearchParams({ pageSize: String(pageSize) });
  if (lastMessageId !== undefined && lastMessageId !== null) {
    params.set('lastMessageId', String(lastMessageId));
  }
  const payload = await request(`/chatrooms/${encodeURIComponent(roomId)}/messages?${params}`, { signal });
  const envelope = requireRecord(payload, 'chat history');
  if (envelope.message !== 'messages_read_success') {
    throw new Error('채팅 메시지 응답 상태가 API 계약과 다릅니다.');
  }
  return requireArray(envelope.data, 'chat history').map(validateHistoryMessage);
}

export async function getChatRooms({
  createdAtCursor,
  lastMessageIdCursor,
  pageSize = CHAT_ROOM_PAGE_SIZE,
  signal,
} = {}) {
  const hasCreatedAtCursor = createdAtCursor !== undefined && createdAtCursor !== null;
  const hasMessageIdCursor = lastMessageIdCursor !== undefined && lastMessageIdCursor !== null;
  if (hasCreatedAtCursor !== hasMessageIdCursor) {
    throw new Error('채팅방 목록 cursor는 createdAt과 lastMessageId를 함께 전달해야 합니다.');
  }

  const params = new URLSearchParams({ pageSize: String(pageSize) });
  if (hasCreatedAtCursor) {
    params.set('createdAtCursor', createdAtCursor);
    params.set('lastMessageIdCursor', String(lastMessageIdCursor));
  }
  const payload = await request(`/chatrooms?${params}`, { signal });
  const envelope = requireRecord(payload, 'chat room list');
  if (envelope.message !== 'chat_room_list_read_success') {
    throw new Error('채팅방 목록 응답 상태가 API 계약과 다릅니다.');
  }
  return requireArray(envelope.data, 'chat room list').map(validateChatRoomSummary);
}

export async function getTotalUnreadCount({ signal } = {}) {
  const payload = await request('/chatrooms/unread-count', { signal });
  const envelope = requireRecord(payload, 'unread count');
  if (envelope.message !== 'unread_count_load_success') {
    throw new Error('안 읽은 메시지 응답 상태가 API 계약과 다릅니다.');
  }
  if (!Number.isSafeInteger(envelope.data) || envelope.data < 0) {
    throw new Error('안 읽은 메시지 수가 올바르지 않습니다.');
  }
  return envelope.data;
}

export async function getChatRoomInfo(roomId, { signal } = {}) {
  const payload = await request(`/chatrooms/${encodeURIComponent(roomId)}`, { signal });
  const envelope = requireRecord(payload, 'chat room info');
  if (envelope.message !== 'chat_room_info_read_success') {
    throw new Error('채팅방 정보 응답 상태가 API 계약과 다릅니다.');
  }
  return validateChatRoomInfo(envelope.data);
}
