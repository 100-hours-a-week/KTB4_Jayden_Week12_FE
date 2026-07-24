import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { getCommentsMock, createCommentMock, updateCommentMock, deleteCommentMock } = vi.hoisted(() => ({
  getCommentsMock: vi.fn(),
  createCommentMock: vi.fn(),
  updateCommentMock: vi.fn(),
  deleteCommentMock: vi.fn(),
}));
vi.mock('../commentService.js', () => ({
  COMMENT_PAGE_SIZE: 10,
  getComments: getCommentsMock,
  createComment: createCommentMock,
  updateComment: updateCommentMock,
  deleteComment: deleteCommentMock,
  orderComments(comments) {
    const roots = comments.filter((comment) => comment.parentCommentId === null);
    const ordered = roots.flatMap((root) => [
      root,
      ...comments.filter((comment) => String(comment.parentCommentId) === String(root.commentId)),
    ]);
    const orderedIds = new Set(ordered.map((comment) => comment.commentId));
    return [...ordered, ...comments.filter((comment) => !orderedIds.has(comment.commentId))];
  },
}));
vi.mock('../../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { userId: 1, nickname: '현재 닉네임' } }),
}));

import { CommentSection } from './CommentSection.jsx';

let intersectionCallback;

function comment(commentId, overrides = {}) {
  return {
    commentId,
    userId: commentId,
    parentCommentId: null,
    commentText: `댓글 ${commentId}`,
    nickname: `작성자 ${commentId}`,
    profileImageUrl: '',
    createdAt: '2026-07-19T12:34:56',
    isDeleted: false,
    ...overrides,
  };
}

beforeEach(() => {
  getCommentsMock.mockReset();
  createCommentMock.mockReset();
  updateCommentMock.mockReset();
  deleteCommentMock.mockReset();
  intersectionCallback = null;
  vi.stubGlobal('IntersectionObserver', class IntersectionObserverMock {
    constructor(callback) {
      intersectionCallback = callback;
    }
    observe() {}
    disconnect() {}
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('CommentSection', () => {
  it('부모 아래에 대댓글을 표시하고 삭제된 부모의 답글도 유지한다', async () => {
    getCommentsMock.mockResolvedValue([
      comment(2, { parentCommentId: 1, commentText: '첫 답글' }),
      comment(1, { commentText: '첫 부모' }),
      comment(4, { parentCommentId: 3, commentText: '삭제 부모의 답글' }),
      comment(3, { isDeleted: true }),
    ]);
    render(<CommentSection articleId={12} />);

    await screen.findByText('첫 부모');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.textContent)).toEqual(expect.arrayContaining([
      expect.stringContaining('첫 부모'),
      expect.stringContaining('첫 답글'),
      expect.stringContaining('해당 댓글은 삭제되었습니다.'),
      expect.stringContaining('삭제 부모의 답글'),
    ]));
    expect(items[1]).toHaveClass('is-reply');
    expect(items[2]).toHaveClass('is-deleted');
    expect(items[3]).toHaveClass('is-reply');
  });

  it('첫 조회 결과가 없으면 빈 결과를 표시한다', async () => {
    getCommentsMock.mockResolvedValue([]);
    render(<CommentSection articleId={12} />);
    expect(await screen.findByText('첫 댓글을 남겨주세요.')).toBeInTheDocument();
  });

  it('빈 목록에 댓글을 작성하면 생성 응답만 목록에 추가한다', async () => {
    const user = userEvent.setup();
    getCommentsMock.mockResolvedValue([]);
    createCommentMock.mockResolvedValue(comment(1, { userId: 1, commentText: '첫 댓글' }));
    render(<CommentSection articleId={12} />);

    await screen.findByText('첫 댓글을 남겨주세요.');
    const input = screen.getByPlaceholderText('댓글을 남겨주세요!');
    await user.type(input, '첫 댓글');
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));

    expect(await screen.findByText('첫 댓글')).toBeInTheDocument();
    expect(screen.queryByText('첫 댓글을 남겨주세요.')).not.toBeInTheDocument();
    expect(getCommentsMock).toHaveBeenCalledTimes(1);
  });

  it('최초 댓글 조회가 끝날 때까지 댓글 등록을 비활성화한다', async () => {
    let resolveInitialRequest;
    getCommentsMock.mockReturnValue(new Promise((resolve) => { resolveInitialRequest = resolve; }));
    render(<CommentSection articleId={12} />);

    const input = screen.getByPlaceholderText('댓글을 남겨주세요!');
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: '댓글 등록' })).toBeDisabled();

    await act(async () => resolveInitialRequest([]));
    await screen.findByText('첫 댓글을 남겨주세요.');
    expect(input).toBeEnabled();
  });

  it('첫 조회 오류에서 같은 댓글 조회를 다시 시도한다', async () => {
    const user = userEvent.setup();
    getCommentsMock
      .mockRejectedValueOnce(new Error('댓글 API 오류'))
      .mockResolvedValueOnce([comment(1)]);
    render(<CommentSection articleId={12} />);

    expect(await screen.findByText(/댓글을 불러오지 못했습니다/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByText('댓글 1')).toBeInTheDocument();
    expect(getCommentsMock).toHaveBeenCalledTimes(2);
  });

  it('sentinel 교차 시 두 cursor로 다음 페이지를 요청하고 중복 댓글을 제거한다', async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) => (
      comment(index + 1, index === 9 ? { parentCommentId: 1 } : {})
    ));
    getCommentsMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([comment(10, { parentCommentId: 1 }), comment(11)]);
    render(<CommentSection articleId={12} />);

    expect(await screen.findByText('댓글 10')).toBeInTheDocument();
    await waitFor(() => expect(intersectionCallback).toBeTypeOf('function'));
    act(() => intersectionCallback([{ isIntersecting: true }]));

    expect(await screen.findByText('댓글 11')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(11);
    expect(getCommentsMock.mock.calls[1][1]).toMatchObject({
      lastCommentId: 10,
      lastParentCommentId: 1,
    });
  });

  it('추가 조회 오류에서 기존 댓글을 유지하고 추가 조회만 재시도한다', async () => {
    const user = userEvent.setup();
    const firstPage = Array.from({ length: 10 }, (_, index) => comment(index + 1));
    getCommentsMock
      .mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(new Error('추가 오류'))
      .mockResolvedValueOnce([comment(11)]);
    render(<CommentSection articleId={12} />);

    await screen.findByText('댓글 10');
    await waitFor(() => expect(intersectionCallback).toBeTypeOf('function'));
    act(() => intersectionCallback([{ isIntersecting: true }]));

    expect(await screen.findByText('댓글을 더 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('댓글 1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('댓글 11')).toBeInTheDocument();
  });

  it('댓글과 답글을 생성하고 입력을 초기화하며 댓글 수를 갱신한다', async () => {
    const user = userEvent.setup();
    const onCommentCountChange = vi.fn();
    getCommentsMock.mockResolvedValueOnce([comment(1)]);
    createCommentMock
      .mockResolvedValueOnce(comment(2, { nickname: '현재 닉네임', commentText: '새 댓글' }))
      .mockResolvedValueOnce(comment(3, { parentCommentId: 1, commentText: '새 답글' }));
    render(<CommentSection articleId={12} onCommentCountChange={onCommentCountChange} />);

    await screen.findByText('댓글 1');
    const mainInput = screen.getByPlaceholderText('댓글을 남겨주세요!');
    await user.type(mainInput, ' 새 댓글 ');
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));
    expect(await screen.findByText('새 댓글')).toBeInTheDocument();
    expect(mainInput).toHaveValue('');

    await user.click(screen.getAllByRole('button', { name: '답글' })[0]);
    const replyInput = screen.getByPlaceholderText('작성자 1님에게 답글 남기기');
    await user.type(replyInput, '새 답글');
    await user.click(screen.getByRole('button', { name: '답글 등록' }));

    expect(await screen.findByText('새 답글')).toBeInTheDocument();
    expect(createCommentMock.mock.calls).toEqual([
      [12, { commentText: '새 댓글', parentCommentId: null }],
      [12, { commentText: '새 답글', parentCommentId: 1 }],
    ]);
    expect(getCommentsMock).toHaveBeenCalledTimes(1);
    expect(onCommentCountChange).toHaveBeenCalledTimes(2);
    expect(onCommentCountChange).toHaveBeenNthCalledWith(1, 1);
  });

  it('추가 조회 중 댓글을 작성하면 GET 결과와 생성 댓글을 모두 유지한다', async () => {
    const user = userEvent.setup();
    const firstPage = Array.from({ length: 10 }, (_, index) => comment(index + 1));
    let resolveLoadMore;
    getCommentsMock
      .mockResolvedValueOnce(firstPage)
      .mockReturnValueOnce(new Promise((resolve) => { resolveLoadMore = resolve; }));
    createCommentMock.mockResolvedValue(comment(20, { commentText: '방금 작성한 댓글' }));
    render(<CommentSection articleId={12} />);

    await screen.findByText('댓글 10');
    await waitFor(() => expect(intersectionCallback).toBeTypeOf('function'));
    act(() => intersectionCallback([{ isIntersecting: true }]));
    await waitFor(() => expect(getCommentsMock).toHaveBeenCalledTimes(2));

    const input = screen.getByPlaceholderText('댓글을 남겨주세요!');
    await user.type(input, '방금 작성한 댓글');
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));

    expect(await screen.findByText('방금 작성한 댓글')).toBeInTheDocument();
    expect(getCommentsMock).toHaveBeenCalledTimes(2);
    expect(getCommentsMock.mock.calls[1][1].signal.aborted).toBe(false);

    await act(async () => resolveLoadMore([comment(11)]));
    expect(await screen.findByText('댓글 11')).toBeInTheDocument();
    expect(screen.getByText('방금 작성한 댓글')).toBeInTheDocument();
  });

  it('생성 응답 ID가 기존 댓글과 같으면 중복 표시하지 않는다', async () => {
    const user = userEvent.setup();
    getCommentsMock.mockResolvedValue([comment(1)]);
    createCommentMock.mockResolvedValue(comment(1, { commentText: '중복 응답' }));
    render(<CommentSection articleId={12} />);

    await screen.findByText('댓글 1');
    const input = screen.getByPlaceholderText('댓글을 남겨주세요!');
    await user.type(input, '중복 응답');
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));

    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('중복 응답')).not.toBeInTheDocument();
    expect(getCommentsMock).toHaveBeenCalledTimes(1);
  });

  it('본인 댓글을 수정·삭제하고 삭제 실패 시 dialog를 유지한다', async () => {
    const user = userEvent.setup();
    const onCommentCountChange = vi.fn();
    getCommentsMock.mockResolvedValue([comment(1)]);
    updateCommentMock.mockResolvedValue(null);
    deleteCommentMock
      .mockRejectedValueOnce(Object.assign(new Error('권한 없음'), { status: 403 }))
      .mockResolvedValueOnce(null);
    render(<CommentSection articleId={12} onCommentCountChange={onCommentCountChange} />);

    await screen.findByText('댓글 1');
    await user.click(screen.getByRole('button', { name: '수정' }));
    const editInput = screen.getByDisplayValue('댓글 1');
    await user.clear(editInput);
    await user.type(editInput, '수정 댓글');
    await user.click(screen.getByRole('button', { name: '수정 완료' }));
    expect(await screen.findByText('수정 댓글')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '삭제' }));
    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(await screen.findByText('이 댓글을 삭제할 권한이 없습니다.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(await screen.findByText('해당 댓글은 삭제되었습니다.')).toBeInTheDocument();
    expect(onCommentCountChange).toHaveBeenCalledWith(-1);
  });

  it('닉네임이 같아도 사용자 ID가 다르면 수정·삭제를 표시하지 않는다', async () => {
    getCommentsMock.mockResolvedValue([comment(2, { nickname: '현재 닉네임' })]);
    render(<CommentSection articleId={12} />);
    await screen.findByText('댓글 2');
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  it('댓글 생성 실패 시 입력을 보존하고 오류를 표시한다', async () => {
    const user = userEvent.setup();
    getCommentsMock.mockResolvedValue([]);
    createCommentMock.mockRejectedValue(new Error('서버 오류'));
    render(<CommentSection articleId={12} />);

    await screen.findByText('첫 댓글을 남겨주세요.');
    const input = screen.getByPlaceholderText('댓글을 남겨주세요!');
    await user.type(input, '보존할 댓글');
    await user.click(screen.getByRole('button', { name: '댓글 등록' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('댓글 등록에 실패했습니다.');
    expect(input).toHaveValue('보존할 댓글');
  });
});
