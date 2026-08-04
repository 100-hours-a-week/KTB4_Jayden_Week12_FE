import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const { unreadState } = vi.hoisted(() => ({ unreadState: { count: 0 } }));
vi.mock('../ChatContext.jsx', () => ({
  useChat: () => ({ totalUnreadCount: unreadState.count }),
}));

import { ChatNotificationButton } from './ChatNotificationButton.jsx';

function Destination() {
  const location = useLocation();
  return <p>이전 경로: {location.state?.from}</p>;
}

function renderButton(route = '/posts/12') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="*" element={<ChatNotificationButton />} />
        <Route path="/chats" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ChatNotificationButton', () => {
  it('unread가 없으면 기본 접근성 이름과 점 없는 아이콘을 표시한다', () => {
    unreadState.count = 0;
    const view = renderButton();
    expect(screen.getByRole('link', { name: '메시지 목록 열기' })).toHaveAttribute('href', '/chats');
    expect(view.container.querySelector('.chat-notification__dot')).not.toBeInTheDocument();
  });

  it('unread count를 접근성 이름에 반영하고 안전한 이전 경로를 전달한다', async () => {
    unreadState.count = 6;
    const user = userEvent.setup();
    const view = renderButton('/posts/12?tab=comments');
    const link = screen.getByRole('link', { name: '읽지 않은 메시지 6개, 메시지 목록 열기' });
    expect(view.container.querySelector('.chat-notification__dot')).toBeInTheDocument();

    await user.click(link);
    expect(screen.getByText('이전 경로: /posts/12?tab=comments')).toBeInTheDocument();
  });
});
