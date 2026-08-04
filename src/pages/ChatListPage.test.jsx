import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { getChatRoomsMock, refreshUnreadMock } = vi.hoisted(() => ({
  getChatRoomsMock: vi.fn(),
  refreshUnreadMock: vi.fn(() => Promise.resolve(0)),
}));
vi.mock('../features/chat/chatService.js', () => ({
  CHAT_ROOM_PAGE_SIZE: 20,
  getChatRooms: getChatRoomsMock,
}));
vi.mock('../features/chat/ChatContext.jsx', () => ({
  useChat: () => ({ refreshUnread: refreshUnreadMock }),
}));

import { ChatListPage } from './ChatListPage.jsx';

let intersectionCallback;

function room(chatRoomId, overrides = {}) {
  return {
    chatRoomId,
    opponentUserId: chatRoomId + 100,
    nickname: `하비${chatRoomId}`,
    profileImageUrl: null,
    lastMessageId: chatRoomId * 10,
    content: `마지막 메시지 ${chatRoomId}`,
    createdAt: new Date(Date.now() - chatRoomId * 60000).toISOString(),
    unreadCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  getChatRoomsMock.mockReset();
  refreshUnreadMock.mockClear();
  intersectionCallback = null;
  vi.stubGlobal('IntersectionObserver', class IntersectionObserverMock {
    constructor(callback) { intersectionCallback = callback; }
    observe() {}
    disconnect() {}
  });
});

describe('ChatListPage', () => {
  it('제외 기능 없이 모든 대화와 unread 상태를 표시한다', async () => {
    getChatRoomsMock.mockResolvedValue([
      room(1, { nickname: 'coffee_moon', unreadCount: 120, content: null }),
      room(2, { nickname: 'sourdough_kim' }),
    ]);
    render(<MemoryRouter><ChatListPage /></MemoryRouter>);

    expect(screen.getByLabelText('메시지 목록을 불러오는 중')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'coffee_moon님과의 대화, 읽지 않은 메시지 120개' })).toHaveAttribute('href', '/chats/1');
    expect(screen.getByText('삭제된 메시지입니다.')).toHaveClass('is-unread');
    expect(screen.getByText('99+')).toBeInTheDocument();
    expect(screen.getByText('마지막 메시지 2')).not.toHaveClass('is-unread');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByText('새 대화')).not.toBeInTheDocument();
  });

  it('복합 cursor로 다음 페이지를 조회한다', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => room(index + 1));
    getChatRoomsMock.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([room(21)]);
    render(<MemoryRouter><ChatListPage /></MemoryRouter>);
    await screen.findByText('마지막 메시지 20');
    await waitFor(() => expect(intersectionCallback).toBeTypeOf('function'));

    act(() => intersectionCallback([{ isIntersecting: true }]));
    expect(await screen.findByText('마지막 메시지 21')).toBeInTheDocument();
    expect(getChatRoomsMock.mock.calls[1][0]).toMatchObject({
      createdAtCursor: firstPage[19].createdAt,
      lastMessageIdCursor: firstPage[19].lastMessageId,
    });
  });

  it('목록 오류를 기존 조회로 다시 시도한다', async () => {
    const user = userEvent.setup();
    getChatRoomsMock.mockRejectedValueOnce(new Error('목록 API 오류')).mockResolvedValueOnce([room(1)]);
    render(<MemoryRouter><ChatListPage /></MemoryRouter>);

    expect(await screen.findByText('메시지 목록을 불러오지 못했어요.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('마지막 메시지 1')).toBeInTheDocument();
  });
});
