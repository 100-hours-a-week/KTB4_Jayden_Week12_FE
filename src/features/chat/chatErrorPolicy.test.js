import { describe, expect, it } from 'vitest';
import {
  CHAT_ERROR_KIND,
  classifyChatError,
  getConversationOpenError,
} from './chatErrorPolicy.js';

describe('chatErrorPolicy', () => {
  it.each([
    ['MESSAGE_CONTENT_REQUIRED', CHAT_ERROR_KIND.MESSAGE],
    ['ROOM_NOT_FOUND', CHAT_ERROR_KIND.ROOM],
    ['ACCESS_TOKEN_EXPIRED', CHAT_ERROR_KIND.AUTH],
    ['MESSAGE_NOT_FOUND', CHAT_ERROR_KIND.READ],
    ['REAUTH_USER_MISMATCH', CHAT_ERROR_KIND.CONNECTION],
    ['SOMETHING_NEW', CHAT_ERROR_KIND.UNKNOWN],
  ])('%s 오류를 %s 종류로 분류한다', (code, kind) => {
    expect(classifyChatError(code)).toBe(kind);
  });

  it('방 resolve 단계와 연결 단계의 오류 문구를 구분한다', () => {
    expect(getConversationOpenError({ status: 403 }, { roomResolved: false }))
      .toBe('접근할 수 없는 채팅방입니다.');
    expect(getConversationOpenError({ status: 404 }, { roomResolved: false }))
      .toBe('채팅방을 찾을 수 없습니다.');
    expect(getConversationOpenError(new Error('socket'), { roomResolved: true }))
      .toBe('채팅 연결이 끊겼습니다.');
  });
});
