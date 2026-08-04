import { ApiContractError } from '../../shared/api/contracts.js';

const CHAT_TYPES = new Set(['TEXT', 'IMAGE', 'VIDEO']);

function requireRecord(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiContractError(`${name}이 객체 형식이 아닙니다.`);
  }
  return value;
}

function requirePositiveId(record, field, name) {
  const value = record[field];
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ApiContractError(`${name}의 ${field}가 올바르지 않습니다.`);
  }
  return value;
}

function requireString(record, field, name, { nullable = false } = {}) {
  const value = record[field];
  if (nullable && value === null) return value;
  if (typeof value !== 'string') {
    throw new ApiContractError(`${name}의 ${field}가 문자열이 아닙니다.`);
  }
  return value;
}

function requireNullableString(record, field, name) {
  return requireString(record, field, name, { nullable: true });
}

export function validateDirectRoom(value) {
  const room = requireRecord(value, 'direct room 응답');
  requirePositiveId(room, 'chatRoomId', 'direct room 응답');
  requirePositiveId(room, 'opponentUserId', 'direct room 응답');
  requireString(room, 'nickname', 'direct room 응답');
  requireNullableString(room, 'profileImageUrl', 'direct room 응답');
  if (typeof room.created !== 'boolean') {
    throw new ApiContractError('direct room 응답의 created가 boolean이 아닙니다.');
  }
  return room;
}

export function validateChatRoomSummary(value) {
  const room = requireRecord(value, 'chat room summary');
  requirePositiveId(room, 'chatRoomId', 'chat room summary');
  requirePositiveId(room, 'opponentUserId', 'chat room summary');
  requirePositiveId(room, 'lastMessageId', 'chat room summary');
  requireString(room, 'nickname', 'chat room summary');
  requireNullableString(room, 'profileImageUrl', 'chat room summary');
  requireNullableString(room, 'content', 'chat room summary');
  requireString(room, 'createdAt', 'chat room summary');
  if (!Number.isSafeInteger(room.unreadCount) || room.unreadCount < 0) {
    throw new ApiContractError('chat room summary의 unreadCount가 올바르지 않습니다.');
  }
  return room;
}

export function validateChatRoomInfo(value) {
  const room = requireRecord(value, 'chat room info');
  requirePositiveId(room, 'chatRoomId', 'chat room info');
  requirePositiveId(room, 'opponentUserId', 'chat room info');
  requireString(room, 'nickname', 'chat room info');
  requireNullableString(room, 'profileImageUrl', 'chat room info');
  if (room.lastMessageId !== null) requirePositiveId(room, 'lastMessageId', 'chat room info');
  requireNullableString(room, 'createdAt', 'chat room info');
  return room;
}

export function validateHistoryMessage(value) {
  const message = requireRecord(value, 'history message');
  requirePositiveId(message, 'messageId', 'history message');
  requirePositiveId(message, 'senderId', 'history message');
  requireString(message, 'clientMessageId', 'history message');
  requireNullableString(message, 'content', 'history message');
  requireString(message, 'createdAt', 'history message');
  requireNullableString(message, 'updatedAt', 'history message');
  requireNullableString(message, 'deletedAt', 'history message');
  if (!CHAT_TYPES.has(message.chatType)) {
    throw new ApiContractError('history message의 chatType이 올바르지 않습니다.');
  }
  return message;
}

export function validateLiveMessage(value) {
  const message = requireRecord(value, 'chat message event');
  requirePositiveId(message, 'chatMessageId', 'chat message event');
  requirePositiveId(message, 'userId', 'chat message event');
  requireString(message, 'clientMessageId', 'chat message event');
  requireString(message, 'content', 'chat message event');
  requireString(message, 'createdAt', 'chat message event');
  requireNullableString(message, 'updatedAt', 'chat message event');
  requireNullableString(message, 'deletedAt', 'chat message event');
  if (!CHAT_TYPES.has(message.chatType)) {
    throw new ApiContractError('chat message event의 chatType이 올바르지 않습니다.');
  }
  return message;
}

export function isReadEvent(value) {
  return Boolean(value && typeof value === 'object' && value.message === 'MESSAGE_READ');
}

export function validateChatError(value) {
  const error = requireRecord(value, 'chat error event');
  requireString(error, 'code', 'chat error event');
  requireString(error, 'message', 'chat error event');
  if (error.roomId !== null && error.roomId !== undefined) {
    requirePositiveId(error, 'roomId', 'chat error event');
  }
  return error;
}

export function validateAuthEvent(value) {
  const event = requireRecord(value, 'chat auth event');
  requireString(event, 'type', 'chat auth event');
  requireString(event, 'expiresAt', 'chat auth event');
  if (event.type !== 'REAUTHENTICATED') {
    throw new ApiContractError('알 수 없는 chat auth event입니다.');
  }
  return event;
}
