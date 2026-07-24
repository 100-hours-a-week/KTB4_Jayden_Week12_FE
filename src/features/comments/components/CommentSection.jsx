import { InfiniteScrollTrigger } from '../../../shared/components/InfiniteScrollTrigger.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useComments } from '../useComments.js';
import { CommentForm } from './CommentForm.jsx';
import { CommentItem } from './CommentItem.jsx';

export function CommentSection({ articleId, onCommentCountChange = () => {} }) {
  const { user } = useAuth();
  const {
    items,
    status,
    error,
    hasNext,
    isLoadingMore,
    loadMoreError,
    retry,
    loadMore,
    retryLoadMore,
    addComment,
    editComment,
    removeComment,
  } = useComments(articleId);

  async function handleCreate(commentText, parentCommentId = null) {
    await addComment(commentText, parentCommentId);
    onCommentCountChange(1);
  }

  async function handleDelete(commentId) {
    await removeComment(commentId);
    onCommentCountChange(-1);
  }

  return (
    <section className="comments-section" aria-labelledby="comments-title" aria-busy={status === 'loading' || isLoadingMore}>
      <h2 id="comments-title" className="comments-section__title">댓글</h2>
      <CommentForm onSubmit={handleCreate} disabled={status !== 'success' && status !== 'empty'} />

      {status === 'loading' && <p className="comments-state-message" role="status">댓글을 불러오는 중…</p>}
      {status === 'empty' && <p className="comments-state-message comments-state-message--empty">첫 댓글을 남겨주세요.</p>}
      {status === 'error' && (
        <div className="comments-state-message comments-state-message--error" role="alert">
          <span>댓글을 불러오지 못했습니다. {error?.message}</span>
          <button className="button button--secondary" type="button" onClick={retry}>다시 시도</button>
        </div>
      )}

      {status === 'success' && (
        <>
          <ol className="comment-list">
            {items.map((comment) => (
              <CommentItem
                comment={comment}
                canManage={user?.userId !== undefined && user?.userId !== null && String(user.userId) === String(comment.userId)}
                onCreateReply={handleCreate}
                onEdit={editComment}
                onDelete={handleDelete}
                key={comment.commentId}
              />
            ))}
          </ol>
          {loadMoreError && (
            <div className="comments-state-message comments-state-message--error" role="alert">
              <span>댓글을 더 불러오지 못했습니다.</span>
              <button className="button button--secondary" type="button" onClick={retryLoadMore}>다시 시도</button>
            </div>
          )}
          {isLoadingMore && <div className="comments-loading-more" role="status">댓글을 더 불러오는 중…</div>}
          <InfiniteScrollTrigger enabled={hasNext && !isLoadingMore && !loadMoreError} onIntersect={loadMore} />
        </>
      )}
    </section>
  );
}
