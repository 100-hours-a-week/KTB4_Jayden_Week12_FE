import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getChatRooms: vi.fn() }));
vi.mock('./chatService.js', () => ({
  CHAT_ROOM_PAGE_SIZE: 20,
  getChatRooms: mocks.getChatRooms,
}));

import { useChatList } from './useChatList.js';

function room(chatRoomId) {
  return {
    chatRoomId,
    createdAt: `2026-08-05T10:${String(chatRoomId).padStart(2, '0')}:00Z`,
    lastMessageId: chatRoomId * 10,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.getChatRooms.mockReset().mockResolvedValue([room(1)]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useChatList', () => {
  it('화면이 visible이면 30초마다 첫 페이지를 background refresh한다', async () => {
    const { result, unmount } = renderHook(() => useChatList());
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(result.current.status).toBe('success');
    expect(mocks.getChatRooms).toHaveBeenCalledTimes(1);

    mocks.getChatRooms.mockResolvedValue([room(2)]);
    await act(async () => vi.advanceTimersByTimeAsync(30000));

    expect(result.current.items).toEqual([room(2)]);
    expect(mocks.getChatRooms).toHaveBeenCalledTimes(2);
    expect(mocks.getChatRooms.mock.calls[1][0]).toMatchObject({
      createdAtCursor: undefined,
      lastMessageIdCursor: undefined,
    });
    unmount();
  });
});
