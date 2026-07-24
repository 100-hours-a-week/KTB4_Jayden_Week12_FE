import { useCallback, useMemo } from 'react';
import { useCursorPagination } from '../../shared/hooks/useCursorPagination.js';
import {
  COMMENT_PAGE_SIZE,
  createComment,
  deleteComment,
  getComments,
  orderComments,
  updateComment,
} from './commentService.js';

const getCommentId = (comment) => comment.commentId;
const getCommentCursor = (comment) => ({
  lastCommentId: comment.commentId,
  lastParentCommentId: comment.parentCommentId,
});

export function useComments(articleId) {
  const fetchPage = useCallback(({ cursor, signal }) => getComments(articleId, {
    pageSize: COMMENT_PAGE_SIZE,
    lastCommentId: cursor?.lastCommentId ?? null,
    lastParentCommentId: cursor?.lastParentCommentId ?? null,
    signal,
  }), [articleId]);
  const pagination = useCursorPagination({
    fetchPage,
    getCursor: getCommentCursor,
    getItemId: getCommentId,
    pageSize: COMMENT_PAGE_SIZE,
  });
  const { appendItem, reset, setItems } = pagination;

  const addComment = useCallback(async (commentText, parentCommentId = null) => {
    const createdComment = await createComment(articleId, { commentText, parentCommentId });
    appendItem(createdComment);
    return createdComment;
  }, [appendItem, articleId]);
  const editComment = useCallback(async (commentId, commentText) => {
    await updateComment(articleId, commentId, commentText);
    setItems((currentItems) => currentItems.map((comment) => (
      String(comment.commentId) === String(commentId) ? { ...comment, commentText } : comment
    )));
  }, [articleId, setItems]);
  const removeComment = useCallback(async (commentId) => {
    await deleteComment(articleId, commentId);
    setItems((currentItems) => currentItems.map((comment) => (
      String(comment.commentId) === String(commentId) ? { ...comment, isDeleted: true } : comment
    )));
  }, [articleId, setItems]);
  const orderedItems = useMemo(() => orderComments(pagination.items), [pagination.items]);

  return {
    ...pagination,
    items: orderedItems,
    retry: reset,
    addComment,
    editComment,
    removeComment,
  };
}
