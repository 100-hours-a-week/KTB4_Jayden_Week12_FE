import { describe, expect, it } from 'vitest';
import {
  CHAT_SESSION_ACTION,
  CHAT_SESSION_STATUS,
  INITIAL_CHAT_SESSION_STATE,
  chatSessionReducer,
} from './chatSessionReducer.js';

describe('chatSessionReducer', () => {
  it('대화 열기부터 room resolve와 socket 연결까지 상태를 전이한다', () => {
    const opening = chatSessionReducer(INITIAL_CHAT_SESSION_STATE, {
      type: CHAT_SESSION_ACTION.OPEN_REQUESTED,
      target: { userId: 2, nickname: '하비' },
    });
    expect(opening).toMatchObject({ isOpen: true, status: CHAT_SESSION_STATUS.RESOLVING_ROOM });

    const room = { chatRoomId: 20, nickname: '하비' };
    const connecting = chatSessionReducer(opening, {
      type: CHAT_SESSION_ACTION.ROOM_RESOLVED,
      room,
    });
    expect(connecting).toMatchObject({ room, target: room, status: CHAT_SESSION_STATUS.CONNECTING });

    expect(chatSessionReducer(connecting, {
      type: CHAT_SESSION_ACTION.SOCKET_CONNECTED,
    })).toMatchObject({ status: CHAT_SESSION_STATUS.CONNECTED, error: '' });
  });

  it('history와 live message를 reducer의 단일 병합 규칙으로 반영한다', () => {
    const connected = { ...INITIAL_CHAT_SESSION_STATE, isOpen: true, status: CHAT_SESSION_STATUS.CONNECTED };
    const withHistory = chatSessionReducer(connected, {
      type: CHAT_SESSION_ACTION.HISTORY_RECEIVED,
      messages: [{ messageId: 1, clientMessageId: 'one', status: 'sent' }],
    });
    const withLive = chatSessionReducer(withHistory, {
      type: CHAT_SESSION_ACTION.LIVE_MESSAGE_RECEIVED,
      message: { messageId: 2, clientMessageId: 'two', status: 'sent' },
    });
    expect(withLive.messages.map((message) => message.messageId)).toEqual([1, 2]);
  });

  it('전송 실패와 연결 실패를 다른 상태로 표현한다', () => {
    const sending = {
      ...INITIAL_CHAT_SESSION_STATE,
      isOpen: true,
      status: CHAT_SESSION_STATUS.CONNECTED,
      messages: [{ clientMessageId: 'one', status: 'sending' }],
    };
    const messageFailed = chatSessionReducer(sending, {
      type: CHAT_SESSION_ACTION.MESSAGE_SEND_FAILED,
      clientMessageId: 'one',
      error: '메시지를 보내지 못했습니다.',
    });
    expect(messageFailed.status).toBe(CHAT_SESSION_STATUS.CONNECTED);
    expect(messageFailed.messages[0].status).toBe('failed');

    const disconnected = chatSessionReducer(messageFailed, {
      type: CHAT_SESSION_ACTION.SESSION_DISCONNECTED,
      error: '채팅 연결이 끊겼습니다.',
    });
    expect(disconnected.status).toBe(CHAT_SESSION_STATUS.CONNECTION_ERROR);
  });

  it('읽음 성공과 실패를 message 및 connection 상태와 분리한다', () => {
    const connected = { ...INITIAL_CHAT_SESSION_STATE, isOpen: true, status: CHAT_SESSION_STATUS.CONNECTED };
    const receipt = { roomId: 20, readerId: 1, lastReadMessageId: 30 };
    const read = chatSessionReducer(connected, {
      type: CHAT_SESSION_ACTION.READ_RECEIVED,
      receipt,
    });
    expect(read).toMatchObject({ status: CHAT_SESSION_STATUS.CONNECTED, readReceipt: receipt });

    const error = { code: 'MESSAGE_NOT_FOUND', roomId: 20 };
    expect(chatSessionReducer(read, {
      type: CHAT_SESSION_ACTION.READ_FAILED,
      error,
    })).toMatchObject({ status: CHAT_SESSION_STATUS.CONNECTED, readError: error });
  });

  it('닫힌 session은 재인증 성공이나 연결 실패 event로 다시 열리지 않는다', () => {
    expect(chatSessionReducer(INITIAL_CHAT_SESSION_STATE, {
      type: CHAT_SESSION_ACTION.REAUTH_SUCCEEDED,
    })).toBe(INITIAL_CHAT_SESSION_STATE);
    expect(chatSessionReducer(INITIAL_CHAT_SESSION_STATE, {
      type: CHAT_SESSION_ACTION.SESSION_DISCONNECTED,
      error: '연결 실패',
    })).toBe(INITIAL_CHAT_SESSION_STATE);
    expect(chatSessionReducer(INITIAL_CHAT_SESSION_STATE, {
      type: CHAT_SESSION_ACTION.ERROR_REPORTED,
      error: '늦게 도착한 오류',
    })).toBe(INITIAL_CHAT_SESSION_STATE);
  });
});
