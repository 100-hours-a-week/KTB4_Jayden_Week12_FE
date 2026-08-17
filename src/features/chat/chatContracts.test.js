import { describe, expect, it } from 'vitest';
import { ApiContractError } from '../../shared/api/contracts.js';
import {
  isReadEvent,
  validateAuthEvent,
  validateChatError,
  validateLiveMessage,
  validateReadEvent,
} from './chatContracts.js';

describe('chatContracts', () => {
  it('live message의 필수 field와 chat type을 검증한다', () => {
    const message = {
      chatMessageId: 10,
      clientMessageId: 'client-10',
      userId: 2,
      content: '안녕하세요',
      chatType: 'TEXT',
      createdAt: '2026-08-05T10:00:00Z',
      updatedAt: null,
      deletedAt: null,
    };
    expect(validateLiveMessage(message)).toBe(message);
    expect(() => validateLiveMessage({ ...message, chatMessageId: 0 })).toThrow(ApiContractError);
    expect(() => validateLiveMessage({ ...message, chatType: 'UNKNOWN' })).toThrow(ApiContractError);
  });

  it('read event와 일반 message event를 구분한다', () => {
    expect(isReadEvent({ message: 'MESSAGE_READ', data: {} })).toBe(true);
    expect(isReadEvent({ chatMessageId: 10 })).toBe(false);
  });

  it('read event envelope의 reader와 읽음 위치를 검증한다', () => {
    const event = {
      message: 'MESSAGE_READ',
      data: { code: 'READ_UPDATED', roomId: 20, readerId: 1, lastReadMessageId: 30 },
    };
    expect(validateReadEvent(event)).toBe(event.data);
    expect(() => validateReadEvent({
      ...event,
      data: { ...event.data, lastReadMessageId: 0 },
    })).toThrow(ApiContractError);
    expect(() => validateReadEvent({
      ...event,
      data: { ...event.data, code: 'UNKNOWN' },
    })).toThrow(ApiContractError);
  });

  it('chat error의 roomId는 null이거나 양의 정수여야 한다', () => {
    expect(validateChatError({message: 'ROOM_NOT_FOUND', data: { roomId: 20 }, }))
        .toEqual({code: 'ROOM_NOT_FOUND', message: 'ROOM_NOT_FOUND', roomId: 20, });

    expect(validateChatError({message: 'ACCESS_TOKEN_EXPIRED', data: { roomId: null }, }))
        .toEqual({code: 'ACCESS_TOKEN_EXPIRED', message: 'ACCESS_TOKEN_EXPIRED', roomId: null, });

    expect(() => validateChatError({message: 'ROOM_NOT_FOUND', data: { roomId: -1 }, }))
        .toThrow(ApiContractError);
  });

  it('재인증 성공 event만 auth event로 허용한다', () => {
    expect(validateAuthEvent({ type: 'REAUTHENTICATED', expiresAt: '2026-08-05T11:00:00Z' }))
      .toEqual({ type: 'REAUTHENTICATED', expiresAt: '2026-08-05T11:00:00Z' });
    expect(() => validateAuthEvent({ type: 'UNKNOWN', expiresAt: '2026-08-05T11:00:00Z' }))
      .toThrow(ApiContractError);
  });
});
