const MESSAGE_ERROR_CODES = new Set([
  'INVALID_PAYLOAD',
  'MESSAGE_CONTENT_REQUIRED',
  'MESSAGE_CONTENT_TOO_LONG',
  'INVALID_CLIENT_MESSAGE_ID',
  'INTERNAL_SERVER_ERROR',
]);
const ROOM_ERROR_CODES = new Set(['CHAT_ROOM_ACCESS_DENIED', 'ROOM_NOT_FOUND']);
const AUTH_ERROR_CODES = new Set([
  'WEBSOCKET_AUTH_REQUIRED',
  'INVALID_ACCESS_TOKEN',
  'ACCESS_TOKEN_EXPIRED',
]);
const READ_ERROR_CODES = new Set(['MESSAGE_ROOM_MISMATCH', 'MESSAGE_NOT_FOUND']);

export const CHAT_ERROR_KIND = Object.freeze({
  MESSAGE: 'message',
  ROOM: 'room',
  AUTH: 'auth',
  CONNECTION: 'connection',
  READ: 'read',
  UNKNOWN: 'unknown',
});

export function classifyChatError(code) {
  if (MESSAGE_ERROR_CODES.has(code)) return CHAT_ERROR_KIND.MESSAGE;
  if (ROOM_ERROR_CODES.has(code)) return CHAT_ERROR_KIND.ROOM;
  if (AUTH_ERROR_CODES.has(code)) return CHAT_ERROR_KIND.AUTH;
  if (READ_ERROR_CODES.has(code)) return CHAT_ERROR_KIND.READ;
  if (code === 'REAUTH_USER_MISMATCH') return CHAT_ERROR_KIND.CONNECTION;
  return CHAT_ERROR_KIND.UNKNOWN;
}

export function getConversationOpenError(error, { roomResolved }) {
  if (roomResolved) return '채팅 연결이 끊겼습니다.';
  if (error?.status === 403) return '접근할 수 없는 채팅방입니다.';
  if (error?.status === 404) return '채팅방을 찾을 수 없습니다.';
  return '채팅방을 열지 못했습니다.';
}
