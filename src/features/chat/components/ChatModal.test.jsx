import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatModal } from './ChatModal.jsx';

function createChat(overrides = {}) {
  return {
    isOpen: true,
    status: 'connected',
    target: { userId: 31, nickname: '하비', profileImageUrl: null },
    currentUser: { userId: 1 },
    messages: [],
    error: '',
    closeChat: vi.fn(),
    sendMessage: vi.fn(() => true),
    ...overrides,
  };
}

describe('ChatModal', () => {
  it('대화 상대와 메시지 composer를 접근 가능한 dialog로 표시한다', () => {
    render(<ChatModal chat={createChat()} />);

    expect(screen.getByRole('dialog', { name: '하비' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('메시지')).toHaveFocus();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
  });

  it('Enter 전송은 trim 검증을 session에 맡기고 입력을 비운다', async () => {
    const user = userEvent.setup();
    const chat = createChat();
    render(<ChatModal chat={chat} />);
    const input = screen.getByLabelText('메시지');

    await user.type(input, '  안녕하세요  {Enter}');

    expect(chat.sendMessage).toHaveBeenCalledWith('  안녕하세요  ');
    expect(input).toHaveValue('');
  });

  it('연결 전에는 입력을 막고 Escape로 닫는다', async () => {
    const user = userEvent.setup();
    const chat = createChat({ status: 'connecting' });
    render(<ChatModal chat={chat} />);

    expect(screen.getByLabelText('메시지')).toBeDisabled();
    expect(screen.getByText('채팅에 연결하는 중…')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(chat.closeChat).toHaveBeenCalledTimes(1);
  });

  it('내 메시지와 상대 메시지를 구분하고 삭제 tombstone을 표시한다', () => {
    const base = {
      chatType: 'TEXT',
      createdAt: '2026-08-04T14:30:00',
      deletedAt: null,
      status: 'sent',
    };
    render(<ChatModal chat={createChat({
      messages: [
        { ...base, messageId: 1, clientMessageId: 'one', senderId: 31, content: '상대 메시지' },
        { ...base, messageId: 2, clientMessageId: 'two', senderId: 1, content: '내 메시지' },
        { ...base, messageId: 3, clientMessageId: 'three', senderId: 31, content: null, deletedAt: '2026-08-04T15:00:00' },
      ],
    })} />);

    expect(screen.getByText('상대 메시지').closest('li')).toHaveClass('chat-message--theirs');
    expect(screen.getByText('내 메시지').closest('li')).toHaveClass('chat-message--mine');
    expect(screen.getByText('삭제된 메시지입니다.')).toBeInTheDocument();
  });
});
