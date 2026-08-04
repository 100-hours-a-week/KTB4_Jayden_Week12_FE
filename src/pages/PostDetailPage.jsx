import { Link, useParams } from 'react-router-dom';
import { ImageGallery } from '../features/articles/components/ImageGallery.jsx';
import { PostStats } from '../features/articles/components/PostStats.jsx';
import { PostActions } from '../features/articles/components/PostActions.jsx';
import { useArticleDetail } from '../features/articles/useArticleDetail.js';
import { parseArticleId } from '../features/articles/articleValidation.js';
import { CommentSection } from '../features/comments/components/CommentSection.jsx';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { Avatar } from '../shared/components/Avatar.jsx';
import { formatArticleDate } from '../shared/lib/formatArticle.js';
import { useOptionalChat } from '../features/chat/ChatContext.jsx';

function ArticleSkeleton() {
  return <div className="article-skeleton" aria-label="게시글을 불러오는 중"><span /><span /><span /></div>;
}

export function PostDetailPage() {
  const { user } = useAuth();
  const chat = useOptionalChat();
  const params = useParams();
  const articleId = parseArticleId(params.articleId);
  const {
    article,
    status,
    error,
    retry,
    adjustCommentCount,
    toggleLike,
    isLikePending,
    likeError,
  } = useArticleDetail(articleId);
  const isOwnArticle = user?.userId !== undefined && user?.userId !== null && article && String(user.userId) === String(article.userId);

  return (
    <main id="main-content" className="article-detail-main">
      <div className={`article-view is-${status}${article?.imageUrls.length ? ' has-image' : ' has-no-image'}`} aria-busy={status === 'loading'}>
        {status === 'loading' && <ArticleSkeleton />}

        {status === 'error' && (
          <section className="article-state-message article-state-message--error" role="alert">
            <h1>게시글을 불러오지 못했어요.</h1>
            <p>{error?.message}</p>
            <button className="button button--secondary" type="button" onClick={retry}>다시 시도</button>
            <Link className="button button--primary" to="/posts">목록으로 돌아가기</Link>
          </section>
        )}

        {status === 'not-found' && (
          <section className="article-state-message article-state-message--not-found">
            <h1>게시글을 찾을 수 없어요.</h1>
            <Link className="button button--primary" to="/posts">목록으로 돌아가기</Link>
          </section>
        )}

        {status === 'success' && article && (
          <>
            <article className="article-detail">
              <header className="article-detail__header">
                <div>
                  <h1>{article.title}</h1>
                  <div className="article-detail__author">
                    {!isOwnArticle && chat ? (
                      <button
                        className="article-detail__author-button"
                        type="button"
                        aria-label={`${article.nickname}님에게 메시지 보내기`}
                        onClick={() => chat.openChat({
                          userId: article.userId,
                          nickname: article.nickname,
                          profileImageUrl: article.profileImageUrl,
                        })}
                      >
                        <Avatar src={article.profileImageUrl} name={article.nickname} />
                        <strong>{article.nickname}</strong>
                      </button>
                    ) : (
                      <span className="article-detail__author-identity">
                        <Avatar src={article.profileImageUrl} name={article.nickname} />
                        <strong>{article.nickname}</strong>
                      </span>
                    )}
                    <time dateTime={article.createdAt}>{formatArticleDate(article.createdAt)}</time>
                    {article.isUpdated && <span className="article-detail__edited">(수정됨)</span>}
                  </div>
                </div>
                {isOwnArticle && <PostActions articleId={articleId} />}
              </header>

              <ImageGallery images={article.imageUrls} />
              <div className="article-detail__body"><p>{article.content}</p></div>
              <PostStats article={article} onToggleLike={toggleLike} isLikePending={isLikePending} likeError={likeError} />
            </article>
            <CommentSection articleId={articleId} onCommentCountChange={adjustCommentCount} />
          </>
        )}
      </div>
    </main>
  );
}
