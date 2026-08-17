import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refreshUnread: vi.fn(() => Promise.resolve(0)),
  useChatSession: vi.fn(),
}));
vi.mock('./ChatUnreadContext.jsx', () => ({
  useChatUnread: () => ({ refreshUnread: mocks.refreshUnread }),
}));
vi.mock('./useChatSession.js', () => ({ useChatSession: mocks.useChatSession }));
vi.mock('./ChatUnreadContext.jsx', () => ({
  useChatUnread: () => ({refreshUnread: vi.fn(() => Promise.resolve(0)),}),
}));

import { ChatSessionProvider, useChatSessionContext } from './ChatSessionContext.jsx';

function useFakeChatSession() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    status: isOpen ? 'connected' : 'closed',
    target: { userId: 2, nickname: '하비', profileImageUrl: null },
    currentUser: { userId: 1 },
    messages: [],
    error: '',
    openChat: vi.fn(() => {
      setIsOpen(true);
      return Promise.resolve();
    }),
    openRoom: vi.fn(() => Promise.resolve()),
    closeChat: vi.fn(() => setIsOpen(false)),
    sendMessage: vi.fn(() => true),
    requestRead: vi.fn(() => true),
  };
}

function Consumer() {
  const chat = useChatSessionContext();
  return (
    <button type="button" onClick={() => chat.openChat({ userId: 2, nickname: '하비' })}>
      채팅 열기
    </button>
  );
}

beforeEach(() => {
  mocks.refreshUnread.mockClear();
  mocks.useChatSession.mockImplementation(useFakeChatSession);
});

describe('ChatSessionProvider', () => {
  it('modal을 연 trigger로 닫힌 뒤 focus를 복원한다', async () => {
    const user = userEvent.setup();
    render(<ChatSessionProvider><Consumer /></ChatSessionProvider>);
    const trigger = screen.getByRole('button', { name: '채팅 열기' });

    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: '하비' })).toBeInTheDocument();
    expect(screen.getByLabelText('메시지')).toHaveFocus();

    await user.click(screen.getByRole('button', { name: '채팅 닫기' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
