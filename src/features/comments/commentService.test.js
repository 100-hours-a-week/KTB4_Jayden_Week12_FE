import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('../../shared/api/httpClient.js', () => ({ request: requestMock }));

import {
  createComment,
  deleteComment,
  getComments,
  mapComment,
  orderComments,
  updateComment,
} from './commentService.js';

beforeEach(() => requestMock.mockReset());

describe('commentService', () => {
  it('확정된 댓글 필드를 화면 모델로 변환한다', () => {
    expect(mapComment({
      commentId: 2,
      userId: 7,
      parentCommentId: 1,
      commentText: '좋은 글이에요.',
      nickname: '하비',
      profileImageUrl: '/profile.jpg',
      createdAt: '2026-07-19T12:34:56',
      deletedAt: null,
    })).toEqual({
      commentId: 2,
      userId: 7,
      parentCommentId: 1,
      commentText: '좋은 글이에요.',
      nickname: '하비',
      profileImageUrl: '/profile.jpg',
      createdAt: '2026-07-19T12:34:56',
      isDeleted: false,
    });
  });

  it('대댓글을 부모 댓글 바로 아래에 정렬하고 삭제된 부모를 유지한다', () => {
    const comments = [
      mapComment({ commentId: 2, parentCommentId: 1, commentText: '답글' }),
      mapComment({ commentId: 1, parentCommentId: null, commentText: '부모' }),
      mapComment({ commentId: 4, parentCommentId: 3, commentText: '삭제 부모의 답글' }),
      mapComment({ commentId: 3, parentCommentId: null, deletedAt: '2026-07-19' }),
    ];

    expect(orderComments(comments).map((comment) => comment.commentId)).toEqual([1, 2, 3, 4]);
  });

  it('첫 조회와 parent cursor가 있는 추가 조회 URL을 구성한다', async () => {
    requestMock.mockResolvedValue({ data: [] });

    await getComments(12, { pageSize: 10 });
    await getComments(12, { pageSize: 10, lastCommentId: 20, lastParentCommentId: 1 });

    expect(requestMock.mock.calls[0][0]).toBe('/articles/12/comments?pageSize=10');
    expect(requestMock.mock.calls[1][0]).toBe('/articles/12/comments?pageSize=10&lastCommentId=20&lastParentCommentId=1');
  });

  it('parent cursor가 null이면 미확정 null 값을 query에 보내지 않는다', async () => {
    requestMock.mockResolvedValue({ data: [] });
    await getComments(12, { pageSize: 10, lastCommentId: 20, lastParentCommentId: null });
    expect(requestMock.mock.calls[0][0]).toBe('/articles/12/comments?pageSize=10&lastCommentId=20');
  });

  it('댓글과 답글을 같은 endpoint와 parentCommentId 계약으로 생성한다', async () => {
    requestMock
      .mockResolvedValueOnce({ data: {
        commentId: 1,
        userId: 7,
        parentCommentId: null,
        commentText: '댓글',
        nickname: '작성자',
        createdAt: '2026-07-19T12:34:56',
      } })
      .mockResolvedValueOnce({ data: {
        commentId: 2,
        userId: 7,
        parentCommentId: 1,
        commentText: '답글',
        nickname: '작성자',
        createdAt: '2026-07-19T12:35:56',
      } });

    await createComment(12, { commentText: '댓글' });
    await createComment(12, { commentText: '답글', parentCommentId: 1 });

    expect(requestMock.mock.calls[0]).toEqual(['/articles/12/comments', {
      method: 'POST', body: { commentText: '댓글', parentCommentId: null },
    }]);
    expect(requestMock.mock.calls[1][1].body).toEqual({ commentText: '답글', parentCommentId: 1 });
  });

  it('댓글 생성 응답에 필수 필드가 없으면 계약 오류를 발생시킨다', async () => {
    requestMock.mockResolvedValue({ data: {
      commentId: 1,
      parentCommentId: null,
      commentText: '댓글',
      nickname: '작성자',
      createdAt: '2026-07-19T12:34:56',
    } });

    await expect(createComment(12, { commentText: '댓글' })).rejects.toMatchObject({
      name: 'ApiContractError',
      message: '댓글 생성 응답에 userId가 없습니다.',
    });
  });

  it('댓글 수정과 삭제 endpoint를 호출한다', async () => {
    requestMock.mockResolvedValue({ data: null });

    await updateComment(12, 3, '수정 댓글');
    await deleteComment(12, 3);

    expect(requestMock.mock.calls[0]).toEqual(['/articles/12/comments/3', {
      method: 'PUT', body: { commentText: '수정 댓글' },
    }]);
    expect(requestMock.mock.calls[1]).toEqual(['/articles/12/comments/3', { method: 'DELETE' }]);
  });
});
