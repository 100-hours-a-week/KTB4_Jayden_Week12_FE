import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/components/Avatar.jsx';
import { formatArticleDate, formatCount } from '../../../shared/lib/formatArticle.js';
import { useOptionalAuth } from '../../auth/AuthContext.jsx';
import { useOptionalChatSession } from '../../chat/ChatSessionContext.jsx';

export function PostCard({ article }) {
  const [showImage, setShowImage] = useState(Boolean(article.thumbnailUrl));
  const auth = useOptionalAuth();
  const chat = useOptionalChatSession();
  const isOwnArticle = auth?.user?.userId !== undefined && String(auth.user.userId) === String(article.userId);
  const canMessage = Boolean(chat && auth?.user && !isOwnArticle);
  const author = {
    userId: article.userId,
    nickname: article.nickname,
    profileImageUrl: article.profileImageUrl,
  };

  return (
    <article className={`article-card ${showImage ? 'has-image' : 'has-no-image'}`}>
      <Link
        className="article-card__link"
        to={`/posts/${encodeURIComponent(article.articleId)}`}
        aria-label={`${article.title} 게시글 상세 보기`}
      >
        {showImage && (
          <figure className="article-card__media">
            <img
              className="article-card__image"
              src={article.thumbnailUrl}
              alt={`${article.title} 이미지`}
              onError={() => setShowImage(false)}
            />
          </figure>
        )}
        <div className="article-card__body">
          <h3 className="article-card__title" title={article.title}>{article.title}</h3>
          <div className="article-card__meta">
            <span>
              좋아요 {formatCount(article.likeCount)} | 댓글 {formatCount(article.commentCount)} | 조회수 {formatCount(article.viewCount)}
            </span>
            <time dateTime={article.createdAt}>
              {formatArticleDate(article.createdAt)}{article.isUpdated ? ' · 수정됨' : ''}
            </time>
          </div>
        </div>
      </Link>
      {canMessage ? (
        <button
          className="article-card__author article-card__author--button"
          type="button"
          aria-label={`${article.nickname}님에게 메시지 보내기`}
          onClick={() => chat.openChat(author)}
        >
          <Avatar src={article.profileImageUrl} name={article.nickname} />
          <strong>{article.nickname}</strong>
        </button>
      ) : (
        <footer className="article-card__author">
          <Avatar src={article.profileImageUrl} name={article.nickname} />
          <strong>{article.nickname}</strong>
        </footer>
      )}
    </article>
  );
}
