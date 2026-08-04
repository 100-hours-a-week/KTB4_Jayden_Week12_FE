import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '../shared/api/ApiError.js';

const { getArticleMock, incrementArticleViewMock, addArticleLikeMock, removeArticleLikeMock, deleteArticleMock, authState, openChatMock } = vi.hoisted(() => ({
  getArticleMock: vi.fn(),
  incrementArticleViewMock: vi.fn(),
  addArticleLikeMock: vi.fn(),
  removeArticleLikeMock: vi.fn(),
  deleteArticleMock: vi.fn(),
  authState: { user: { userId: 99, nickname: '다른 사용자' } },
  openChatMock: vi.fn(),
}));
vi.mock('../features/articles/articleService.js', () => ({
  getArticle: getArticleMock,
  incrementArticleView: incrementArticleViewMock,
  addArticleLike: addArticleLikeMock,
  removeArticleLike: removeArticleLikeMock,
  deleteArticle: deleteArticleMock,
}));
vi.mock('../features/comments/components/CommentSection.jsx', () => ({
  CommentSection: ({ articleId }) => `댓글 영역 ${articleId}`,
}));
vi.mock('../features/auth/AuthContext.jsx', () => ({ useAuth: () => authState }));
vi.mock('../features/chat/ChatContext.jsx', () => ({ useOptionalChat: () => ({ openChat: openChatMock }) }));

import { PostDetailPage } from './PostDetailPage.jsx';

function article(overrides = {}) {
  return {
    articleId: 12,
    userId: 31,
    title: '클라이밍 입문기',
    content: '첫 클라이밍 기록\n다음 목표는 완등입니다.',
    imageUrls: ['/images/one.jpg', '/images/two.jpg'],
    nickname: '하비',
    profileImageUrl: '',
    createdAt: '2026-07-19T12:34:56',
    isUpdated: true,
    likeCount: 5,
    likedByMe: false,
    viewCount: 30,
    commentCount: 2,
    ...overrides,
  };
}

function renderPage(articleId = '12') {
  return render(
    <MemoryRouter initialEntries={[`/posts/${articleId}`]}>
      <Routes><Route path="/posts/:articleId" element={<PostDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getArticleMock.mockReset();
  incrementArticleViewMock.mockReset().mockResolvedValue(null);
  addArticleLikeMock.mockReset().mockResolvedValue(null);
  removeArticleLikeMock.mockReset().mockResolvedValue(null);
  deleteArticleMock.mockReset();
  openChatMock.mockReset();
  authState.user = { userId: 99, nickname: '다른 사용자' };
});

describe('PostDetailPage', () => {
  it('상세 본문·gallery·통계를 표시하고 조회수를 증가시킨다', async () => {
    const user = userEvent.setup();
    getArticleMock.mockResolvedValue(article());
    incrementArticleViewMock.mockResolvedValue(201);
    renderPage();

    expect(screen.getByLabelText('게시글을 불러오는 중')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '클라이밍 입문기' })).toBeInTheDocument();
    expect(screen.getByText(/첫 클라이밍 기록/)).toBeInTheDocument();
    expect(screen.getByText('(수정됨)')).toBeInTheDocument();
    expect(screen.getByText('댓글 영역 12')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '게시글 이미지 1' }).closest('figure')).toHaveClass('is-active');

    await user.click(screen.getByRole('button', { name: '다음 이미지' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '게시글 이미지 2' }).closest('figure')).toHaveClass('is-active');

    await waitFor(() => expect(incrementArticleViewMock).toHaveBeenCalledWith(12));
    await waitFor(() => expect(screen.getByText('조회수').previousSibling).toHaveTextContent('31'));
    expect(screen.getByText('좋아요수').previousSibling).toHaveTextContent('5');
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  it('이미지가 없으면 gallery를 렌더링하지 않는다', async () => {
    getArticleMock.mockResolvedValue(article({ imageUrls: [] }));
    renderPage();

    await screen.findByRole('heading', { name: '클라이밍 입문기' });
    expect(screen.queryByRole('region', { name: '게시글 이미지' })).not.toBeInTheDocument();
  });

  it('현재 사용자 ID가 작성자와 일치할 때만 수정·삭제 액션을 표시한다', async () => {
    authState.user = { userId: 31, nickname: '변경된 닉네임' };
    getArticleMock.mockResolvedValue(article());
    renderPage();

    await screen.findByRole('heading', { name: '클라이밍 입문기' });
    expect(screen.getByRole('link', { name: '수정' })).toHaveAttribute('href', '/posts/12/edit');
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it('닉네임이 같아도 사용자 ID가 다르면 수정·삭제 액션을 표시하지 않는다', async () => {
    authState.user = { userId: 99, nickname: '하비' };
    getArticleMock.mockResolvedValue(article());
    renderPage();
    await screen.findByRole('heading', { name: '클라이밍 입문기' });
    expect(screen.queryByRole('link', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  it('상세 작성자 버튼으로 올바른 상대와 채팅을 연다', async () => {
    const user = userEvent.setup();
    getArticleMock.mockResolvedValue(article({ profileImageUrl: '/profile.jpg' }));
    renderPage();

    await user.click(await screen.findByRole('button', { name: '하비님에게 메시지 보내기' }));
    expect(openChatMock).toHaveBeenCalledWith({
      userId: 31,
      nickname: '하비',
      profileImageUrl: '/profile.jpg',
    });
  });

  it('좋아요 성공 후 상태와 count를 갱신하고 다시 누르면 취소한다', async () => {
    const user = userEvent.setup();
    getArticleMock.mockResolvedValue(article());
    renderPage();

    const likeButton = await screen.findByRole('button', { name: '좋아요 추가' });
    await user.click(likeButton);
    expect(await screen.findByRole('button', { name: '좋아요 취소' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('좋아요수').previousSibling).toHaveTextContent('6');
    expect(addArticleLikeMock).toHaveBeenCalledWith(12);

    await user.click(screen.getByRole('button', { name: '좋아요 취소' }));
    expect(await screen.findByRole('button', { name: '좋아요 추가' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('좋아요수').previousSibling).toHaveTextContent('5');
    expect(removeArticleLikeMock).toHaveBeenCalledWith(12);
  });

  it('좋아요 실패 시 기존 상태와 count를 유지하고 오류를 표시한다', async () => {
    const user = userEvent.setup();
    addArticleLikeMock.mockRejectedValue(Object.assign(new Error('conflict'), { status: 409 }));
    getArticleMock.mockResolvedValue(article());
    renderPage();

    await user.click(await screen.findByRole('button', { name: '좋아요 추가' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('좋아요를 변경하지 못했습니다');
    expect(screen.getByRole('button', { name: '좋아요 추가' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('좋아요수').previousSibling).toHaveTextContent('5');
  });

  it('좋아요 요청 중 중복 클릭을 차단한다', async () => {
    const user = userEvent.setup();
    let resolveLike;
    addArticleLikeMock.mockReturnValue(new Promise((resolve) => { resolveLike = resolve; }));
    getArticleMock.mockResolvedValue(article());
    renderPage();

    const likeButton = await screen.findByRole('button', { name: '좋아요 추가' });
    await user.click(likeButton);
    expect(screen.getByRole('button', { name: '좋아요 추가' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '좋아요 추가' }));
    expect(addArticleLikeMock).toHaveBeenCalledTimes(1);
    resolveLike(null);
    expect(await screen.findByRole('button', { name: '좋아요 취소' })).toBeEnabled();
  });

  it('잘못된 route param은 API를 호출하지 않고 not-found를 표시한다', async () => {
    renderPage('invalid-id');
    expect(await screen.findByText('게시글을 찾을 수 없어요.')).toBeInTheDocument();
    expect(getArticleMock).not.toHaveBeenCalled();
  });

  it('상세 API 404를 게시글 not-found로 구분한다', async () => {
    getArticleMock.mockRejectedValue(new ApiError('not found', { status: 404 }));
    renderPage();
    expect(await screen.findByText('게시글을 찾을 수 없어요.')).toBeInTheDocument();
  });

  it('조회 오류에서 같은 상세 요청을 다시 시도한다', async () => {
    const user = userEvent.setup();
    getArticleMock
      .mockRejectedValueOnce(new ApiError('server error', { status: 503 }))
      .mockResolvedValueOnce(article());
    renderPage();

    expect(await screen.findByText('게시글을 불러오지 못했어요.')).toBeInTheDocument();
    expect(screen.getByText('server error')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('heading', { name: '클라이밍 입문기' })).toBeInTheDocument();
    expect(getArticleMock).toHaveBeenCalledTimes(2);
  });

  it('조회수 증가 실패가 상세 본문 표시를 막지 않는다', async () => {
    getArticleMock.mockResolvedValue(article());
    incrementArticleViewMock.mockRejectedValue(new Error('view error'));
    renderPage();

    expect(await screen.findByRole('heading', { name: '클라이밍 입문기' })).toBeInTheDocument();
    await waitFor(() => expect(incrementArticleViewMock).toHaveBeenCalledTimes(1));
  });

  it('unmount에서 진행 중인 상세 GET을 취소한다', async () => {
    let requestSignal;
    getArticleMock.mockImplementation((articleId, { signal }) => {
      requestSignal = signal;
      return new Promise(() => {});
    });
    const view = renderPage();
    await waitFor(() => expect(requestSignal).toBeDefined());

    view.unmount();
    expect(requestSignal.aborted).toBe(true);
  });
});
