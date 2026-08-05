import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { authState, openChatMock } = vi.hoisted(() => ({
  authState: { user: { userId: 1 } },
  openChatMock: vi.fn(),
}));
vi.mock('../../auth/AuthContext.jsx', () => ({ useOptionalAuth: () => authState }));
vi.mock('../../chat/ChatSessionContext.jsx', () => ({
  useOptionalChatSession: () => ({ openChat: openChatMock }),
}));

import { PostCard } from './PostCard.jsx';

const article = {
  articleId: 12,
  userId: 31,
  title: '클라이밍 입문기',
  thumbnailUrl: '',
  likeCount: 5,
  commentCount: 2,
  viewCount: 30,
  createdAt: '2026-07-19T12:34:56',
  isUpdated: false,
  nickname: '하비',
  profileImageUrl: '/profile.jpg',
};

beforeEach(() => {
  authState.user = { userId: 1 };
  openChatMock.mockReset();
});

describe('PostCard author chat trigger', () => {
  it('작성자 버튼은 상세 링크와 분리되고 올바른 사용자로 채팅을 연다', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PostCard article={article} /></MemoryRouter>);

    const link = screen.getByRole('link', { name: '클라이밍 입문기 게시글 상세 보기' });
    const authorButton = screen.getByRole('button', { name: '하비님에게 메시지 보내기' });
    expect(link).not.toContainElement(authorButton);

    await user.click(authorButton);
    expect(openChatMock).toHaveBeenCalledWith({
      userId: 31,
      nickname: '하비',
      profileImageUrl: '/profile.jpg',
    });
  });

  it('내 게시글에는 DM 버튼을 표시하지 않는다', () => {
    authState.user = { userId: 31 };
    render(<MemoryRouter><PostCard article={article} /></MemoryRouter>);

    expect(screen.queryByRole('button', { name: '하비님에게 메시지 보내기' })).not.toBeInTheDocument();
    expect(screen.getByText('하비').closest('footer')).toHaveClass('article-card__author');
  });
});
