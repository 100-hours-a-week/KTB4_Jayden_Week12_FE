import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTH_STATUS } from '../auth/authConstants.js';

const mocks = vi.hoisted(() => ({
  authState: {
    user: { userId: 1, nickname: '나' },
    status: 'authenticated',
    markAnonymous: vi.fn(),
  },
  createChatSocket: vi.fn(),
  getAccessToken: vi.fn(),
  subscribeAccessToken: vi.fn(),
  refreshAccessToken: vi.fn(),
  resolveDirectRoom: vi.fn(),
  getChatRoomInfo: vi.fn(),
  getChatHistory: vi.fn(),
}));

vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => mocks.authState }));
vi.mock('../auth/authService.js', () => ({ refreshAccessToken: mocks.refreshAccessToken }));
vi.mock('../../shared/session/tokenStore.js', () => ({
  getAccessToken: mocks.getAccessToken,
  subscribeAccessToken: mocks.subscribeAccessToken,
}));
vi.mock('./chatService.js', () => ({
  resolveDirectRoom: mocks.resolveDirectRoom,
  getChatRoomInfo: mocks.getChatRoomInfo,
  getChatHistory: mocks.getChatHistory,
}));
vi.mock('./chatSocket.js', () => ({ createChatSocket: mocks.createChatSocket }));

import { useChatSession } from './useChatSession.js';

const room = {
  chatRoomId: 20,
  opponentUserId: 2,
  nickname: '상대방',
  profileImageUrl: null,
};

let socket;
let socketCallbacks;
let tokenSubscriber;
let removeTokenSubscriber;

function historyMessage(overrides = {}) {
  return {
    messageId: 10,
    clientMessageId: 'history-10',
    senderId: 2,
    content: '기존 메시지',
    chatType: 'TEXT',
    createdAt: '2026-08-05T10:00:00Z',
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function liveMessage(overrides = {}) {
  return {
    chatMessageId: 11,
    clientMessageId: 'live-11',
    userId: 2,
    content: '새 메시지',
    chatType: 'TEXT',
    createdAt: '2026-08-05T10:01:00Z',
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authState.user = { userId: 1, nickname: '나' };
  mocks.authState.status = AUTH_STATUS.AUTHENTICATED;
  mocks.getAccessToken.mockReturnValue('access-token-1');
  mocks.resolveDirectRoom.mockResolvedValue(room);
  mocks.getChatRoomInfo.mockResolvedValue(room);
  mocks.getChatHistory.mockResolvedValue([historyMessage()]);
  mocks.refreshAccessToken.mockResolvedValue(undefined);

  socketCallbacks = new Map();
  socket = {
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((destination, callback) => {
      socketCallbacks.set(destination, callback);
      return { unsubscribe: vi.fn() };
    }),
    publishMessage: vi.fn(),
    publishRead: vi.fn(),
    reauthenticate: vi.fn(),
    isConnected: vi.fn(() => true),
    deactivate: vi.fn().mockResolvedValue(undefined),
  };
  mocks.createChatSocket.mockReturnValue(socket);
  removeTokenSubscriber = vi.fn();
  mocks.subscribeAccessToken.mockImplementation((callback) => {
    tokenSubscriber = callback;
    return removeTokenSubscriber;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useChatSession', () => {
  it('direct room을 resolve하고 구독을 완료한 뒤 history를 화면 model로 제공한다', async () => {
    const { result, unmount } = renderHook(() => useChatSession());

    await act(async () => {
      await result.current.openChat({ userId: 2, nickname: '상대방', profileImageUrl: null });
    });

    expect(mocks.resolveDirectRoom).toHaveBeenCalledWith(2, { signal: expect.any(AbortSignal) });
    expect(mocks.createChatSocket).toHaveBeenCalledWith({
      accessToken: 'access-token-1',
      onDisconnect: expect.any(Function),
      onProtocolError: expect.any(Function),
    });
    expect([...socketCallbacks.keys()]).toEqual([
      '/user/queue/auth',
      '/user/queue/chat-errors',
      '/sub/chatrooms/20',
    ]);
    expect(socket.reauthenticate).toHaveBeenCalledWith('access-token-1');
    expect(result.current.status).toBe('reauthenticating');

    act(() => socketCallbacks.get('/user/queue/auth')({
      type: 'REAUTHENTICATED',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
    expect(result.current).toMatchObject({
      isOpen: true,
      status: 'connected',
      room,
      target: room,
    });
    expect(result.current.messages).toEqual([expect.objectContaining({
      messageId: 10,
      senderId: 2,
      status: 'sent',
    })]);

    unmount();
    await waitFor(() => expect(socket.deactivate).toHaveBeenCalledTimes(1));
    expect(removeTokenSubscriber).toHaveBeenCalledTimes(1);
  });

  it('optimistic message를 live echo와 병합해 한 개의 sent message로 확정한다', async () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'client-new') });
    mocks.getChatHistory.mockResolvedValue([]);
    const { result, unmount } = renderHook(() => useChatSession());
    await act(async () => {
      await result.current.openRoom(20);
    });

    act(() => {
      expect(result.current.sendMessage('  안녕하세요  ')).toBe(true);
    });
    expect(socket.publishMessage).toHaveBeenCalledWith(20, {
      clientMessageId: 'client-new',
      content: '안녕하세요',
    });
    expect(result.current.messages).toEqual([expect.objectContaining({
      clientMessageId: 'client-new',
      status: 'sending',
    })]);

    act(() => {
      socketCallbacks.get('/sub/chatrooms/20')(liveMessage({
        chatMessageId: 12,
        clientMessageId: 'client-new',
        userId: 1,
        content: '안녕하세요',
      }));
    });
    expect(result.current.messages).toEqual([expect.objectContaining({
      messageId: 12,
      clientMessageId: 'client-new',
      status: 'sent',
    })]);

    unmount();
  });

  it('token 변경과 auth event 사이에 재인증 상태를 명시한다', async () => {
    const { result, unmount } = renderHook(() => useChatSession());
    await act(async () => {
      await result.current.openRoom(20);
    });

    expect(socket.reauthenticate).toHaveBeenNthCalledWith(1, 'access-token-1');
    expect(result.current.status).toBe('reauthenticating');

    act(() => socketCallbacks.get('/user/queue/auth')({
      type: 'REAUTHENTICATED',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
    expect(result.current.status).toBe('connected');

    act(() => tokenSubscriber('access-token-2'));
    expect(socket.reauthenticate).toHaveBeenNthCalledWith(2, 'access-token-2');
    expect(result.current.status).toBe('reauthenticating');

    act(() => socketCallbacks.get('/user/queue/auth')({
      type: 'REAUTHENTICATED',
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    }));
    expect(result.current.status).toBe('connected');

    unmount();
  });

  it('auth event의 만료 시각 15초 전에 access token을 갱신한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-05T10:00:00Z');
    const { result, unmount } = renderHook(() => useChatSession());
    await act(async () => {
      await result.current.openRoom(20);
    });

    act(() => socketCallbacks.get('/user/queue/auth')({
      type: 'REAUTHENTICATED',
      expiresAt: '2026-08-05T11:00:00Z',
    }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_584_999);
    });
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('예약된 access token 갱신이 실패하면 익명 상태로 전환한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-05T10:00:00Z');
    mocks.refreshAccessToken.mockRejectedValueOnce(new Error('refresh failed'));
    const { result, unmount } = renderHook(() => useChatSession());
    await act(async () => {
      await result.current.openRoom(20);
    });

    act(() => socketCallbacks.get('/user/queue/auth')({
      type: 'REAUTHENTICATED',
      expiresAt: '2026-08-05T10:00:15Z',
    }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(mocks.authState.markAnonymous).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('close 시 예약된 access token 갱신을 취소한다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime('2026-08-05T10:00:00Z');
    const { result } = renderHook(() => useChatSession());
    await act(async () => {
      await result.current.openRoom(20);
    });
    act(() => socketCallbacks.get('/user/queue/auth')({
      type: 'REAUTHENTICATED',
      expiresAt: '2026-08-05T10:01:00Z',
    }));

    act(() => result.current.closeChat());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });

    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
  });

  it('read event를 검증해 내 receipt와 상대의 마지막 읽음 위치를 제공한다', async () => {
    const { result, unmount } = renderHook(() => useChatSession());
    await act(async () => {
      await result.current.openRoom(20);
    });

    act(() => {
      expect(result.current.requestRead(10)).toBe(true);
      socketCallbacks.get('/sub/chatrooms/20')({
        message: 'MESSAGE_READ',
        data: { code: 'READ_UPDATED', roomId: 20, readerId: 1, lastReadMessageId: 10 },
      });
    });

    expect(socket.publishRead).toHaveBeenCalledWith(20, 10);
    expect(result.current.readReceipt).toEqual({
      code: 'READ_UPDATED',
      roomId: 20,
      readerId: 1,
      lastReadMessageId: 10,
    });

    act(() => socketCallbacks.get('/sub/chatrooms/20')({
      message: 'MESSAGE_READ',
      data: { code: 'READ_UPDATED', roomId: 20, readerId: 2, lastReadMessageId: 8 },
    }));
    expect(result.current.opponentLastReadMessageId).toBe(8);
    expect(result.current.messages).toHaveLength(1);
    unmount();
  });

  it('close 시 session 상태와 socket 자원을 함께 정리한다', async () => {
    const { result } = renderHook(() => useChatSession());
    await act(async () => {
      await result.current.openRoom(20);
    });

    act(() => result.current.closeChat());

    expect(result.current).toMatchObject({ isOpen: false, status: 'closed', messages: [] });
    await waitFor(() => expect(socket.deactivate).toHaveBeenCalledTimes(1));
    socket.subscribe.mock.results.forEach(({ value }) => {
      expect(value.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
