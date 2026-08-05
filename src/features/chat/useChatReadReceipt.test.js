import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatReadReceipt } from './useChatReadReceipt.js';

const baseMessage = {
  messageId: 10,
  clientMessageId: 'message-10',
  senderId: 2,
  content: '상대 메시지',
  status: 'sent',
};

function renderReadHook(overrides = {}) {
  const props = {
    currentUserId: 1,
    messages: [baseMessage],
    readError: null,
    readReceipt: null,
    refreshUnread: vi.fn(() => Promise.resolve(0)),
    requestRead: vi.fn(() => true),
    roomId: 20,
    status: 'connected',
    ...overrides,
  };
  const view = renderHook((currentProps) => useChatReadReceipt(currentProps), {
    initialProps: props,
  });
  return { ...view, props };
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useChatReadReceipt', () => {
  it('최신 상대 message를 debounce 후 발행하고 내 receipt에서 unread를 동기화한다', async () => {
    const { props, rerender, unmount } = renderReadHook();
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(props.requestRead).toHaveBeenCalledWith(10);

    rerender({
      ...props,
      readReceipt: { roomId: 20, readerId: 1, lastReadMessageId: 10 },
    });
    expect(props.refreshUnread).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('hidden 상태에서는 발행하지 않고 visible 전환 때 다시 평가한다', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    const { props, unmount } = renderReadHook();
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(props.requestRead).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(props.requestRead).toHaveBeenCalledWith(10);
    unmount();
  });

  it('receipt가 없으면 confirmation timeout 뒤 REST unread를 보정한다', async () => {
    const { props, unmount } = renderReadHook();
    await act(async () => vi.advanceTimersByTimeAsync(1300));
    expect(props.requestRead).toHaveBeenCalledWith(10);
    expect(props.refreshUnread).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('명시적인 read 오류 후 focus에서 같은 message를 다시 시도한다', async () => {
    const { props, rerender, unmount } = renderReadHook();
    await act(async () => vi.advanceTimersByTimeAsync(300));
    rerender({
      ...props,
      readError: { code: 'MESSAGE_NOT_FOUND', roomId: 20 },
    });

    act(() => window.dispatchEvent(new Event('focus')));
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(props.requestRead).toHaveBeenCalledTimes(2);
    unmount();
  });
});
