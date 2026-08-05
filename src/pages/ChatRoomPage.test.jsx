import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: {
    closeChat: vi.fn(),
    currentUser: { userId: 1 },
    error: '',
    messages: [],
    openRoom: vi.fn(() => Promise.resolve()),
    readError: null,
    readReceipt: null,
    requestRead: vi.fn(() => true),
    room: { chatRoomId: 20 },
    sendMessage: vi.fn(() => true),
    status: 'connected',
    target: { nickname: '하비', profileImageUrl: null },
  },
  refreshUnread: vi.fn(() => Promise.resolve(0)),
  useChatReadReceipt: vi.fn(),
}));

vi.mock('../features/chat/ChatSessionContext.jsx', () => ({
  useChatSessionContext: () => mocks.session,
}));
vi.mock('../features/chat/ChatUnreadContext.jsx', () => ({
  useChatUnread: () => ({ refreshUnread: mocks.refreshUnread }),
}));
vi.mock('../features/chat/useChatReadReceipt.js', () => ({
  useChatReadReceipt: mocks.useChatReadReceipt,
}));

import { ChatRoomPage } from './ChatRoomPage.jsx';

function renderPage(route = '/chats/20') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/chats/:roomId" element={<ChatRoomPage />} />
        <Route path="/chats" element={<p>메시지 목록</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks.session, {
    error: '',
    messages: [],
    readError: null,
    readReceipt: null,
    room: { chatRoomId: 20 },
    status: 'connected',
    target: { nickname: '하비', profileImageUrl: null },
  });
});

describe('ChatRoomPage', () => {
  it('route room을 열고 공통 conversation에 session 상태를 전달한다', async () => {
    const view = renderPage();

    await waitFor(() => expect(mocks.session.openRoom).toHaveBeenCalledWith(20));
    expect(screen.getByRole('heading', { level: 1, name: '하비' })).toBeInTheDocument();
    expect(screen.getByLabelText('메시지')).toBeEnabled();
    expect(mocks.useChatReadReceipt).toHaveBeenCalledWith(expect.objectContaining({
      roomId: 20,
      currentUserId: 1,
      requestRead: mocks.session.requestRead,
      refreshUnread: mocks.refreshUnread,
    }));

    view.unmount();
    expect(mocks.session.closeChat).toHaveBeenCalledTimes(1);
  });

  it('잘못된 room ID는 session을 열지 않고 목록 복귀 경로를 표시한다', () => {
    renderPage('/chats/not-a-room');

    expect(screen.getByRole('heading', { name: '채팅방을 찾을 수 없습니다.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '메시지 목록으로' })).toHaveAttribute('href', '/chats');
    expect(mocks.session.openRoom).not.toHaveBeenCalled();
  });

  it('연결 오류는 기존 메시지와 목록 복귀 action을 함께 표시한다', () => {
    Object.assign(mocks.session, {
      error: '채팅 연결이 끊겼습니다.',
      messages: [{
        messageId: 10,
        clientMessageId: 'message-10',
        senderId: 2,
        content: '기존 메시지',
        chatType: 'TEXT',
        deletedAt: null,
        status: 'sent',
      }],
      status: 'connection-error',
    });
    renderPage();

    expect(screen.getByText('기존 메시지')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('채팅 연결이 끊겼습니다.');
    expect(screen.getByRole('link', { name: '메시지 목록으로 돌아가기' })).toHaveAttribute('href', '/chats');
    expect(screen.getByLabelText('메시지')).toBeDisabled();
  });
});
