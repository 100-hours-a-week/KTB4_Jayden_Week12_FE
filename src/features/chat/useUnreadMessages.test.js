import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authState: { status: 'authenticated', user: { userId: 1 } },
  getTotalUnreadCount: vi.fn(),
}));

vi.mock('../auth/AuthContext.jsx', () => ({ useAuth: () => mocks.authState }));
vi.mock('./chatService.js', () => ({ getTotalUnreadCount: mocks.getTotalUnreadCount }));

import { useUnreadMessages } from './useUnreadMessages.js';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authState.status = 'authenticated';
  mocks.authState.user = { userId: 1 };
  mocks.getTotalUnreadCount.mockResolvedValue(4);
});

describe('useUnreadMessages', () => {
  it('인증 사용자에게 최초 count를 조회하고 focus 때 다시 동기화한다', async () => {
    const { result, unmount } = renderHook(() => useUnreadMessages());
    await waitFor(() => expect(result.current.totalUnreadCount).toBe(4));
    expect(mocks.getTotalUnreadCount).toHaveBeenCalledTimes(1);

    mocks.getTotalUnreadCount.mockResolvedValue(2);
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(result.current.totalUnreadCount).toBe(2));
    expect(mocks.getTotalUnreadCount).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('진행 중인 count 요청은 하나의 promise로 합친다', async () => {
    let resolveCount;
    mocks.getTotalUnreadCount.mockImplementation(() => new Promise((resolve) => {
      resolveCount = resolve;
    }));
    const { result, unmount } = renderHook(() => useUnreadMessages());
    await waitFor(() => expect(mocks.getTotalUnreadCount).toHaveBeenCalledTimes(1));

    let first;
    let second;
    act(() => {
      first = result.current.refreshUnread();
      second = result.current.refreshUnread();
    });
    expect(first).toBe(second);
    expect(mocks.getTotalUnreadCount).toHaveBeenCalledTimes(1);

    await act(async () => resolveCount(7));
    expect(result.current.totalUnreadCount).toBe(7);
    unmount();
  });

  it('anonymous 상태가 되면 이전 unread count를 0으로 초기화한다', async () => {
    const { result, rerender, unmount } = renderHook(() => useUnreadMessages());
    await waitFor(() => expect(result.current.totalUnreadCount).toBe(4));

    mocks.authState.status = 'anonymous';
    rerender();
    await waitFor(() => expect(result.current.totalUnreadCount).toBe(0));
    unmount();
  });
});
