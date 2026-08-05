import { InfiniteScrollTrigger } from '../../../shared/components/InfiniteScrollTrigger.jsx';
import { ChatRoomCard } from './ChatRoomCard.jsx';

function ChatListSkeleton() {
  return (
    <div className="chat-list-skeleton" aria-label="메시지 목록을 불러오는 중">
      {[0, 1, 2, 3].map((item) => <div key={item}><span /><span /><span /></div>)}
    </div>
  );
}

function ChatListEmpty() {
  return (
    <div className="chat-list-empty">
      <p>아직 시작된 대화가 없어요.</p>
      <span>게시글 작성자에게 먼저 메시지를 보내보세요.</span>
    </div>
  );
}

function ChatListError({ error, onRetry }) {
  return (
    <div className="chat-list-error" role="alert">
      <p>메시지 목록을 불러오지 못했어요.</p>
      <span>{error?.message}</span>
      <button className="button button--secondary" type="button" onClick={onRetry}>다시 시도</button>
    </div>
  );
}

export function ChatListContent({
  error,
  hasNext,
  isLoadingMore,
  isRefreshing,
  loadMoreError,
  now,
  onLoadMore,
  onRetry,
  onRetryLoadMore,
  onRetryRefresh,
  refreshError,
  rooms,
  status,
}) {
  return (
    <section
      className="chat-list-section"
      aria-labelledby="all-chats-title"
      aria-live="polite"
      aria-busy={status === 'loading' || isLoadingMore || isRefreshing}
    >
      <h2 id="all-chats-title">모든 대화</h2>
      {status === 'loading' && <ChatListSkeleton />}
      {status === 'empty' && <ChatListEmpty />}
      {status === 'error' && <ChatListError error={error} onRetry={onRetry} />}
      {status === 'success' && (
        <>
          <ul className="chat-room-list">
            {rooms.map((room) => <ChatRoomCard room={room} now={now} key={room.chatRoomId} />)}
          </ul>
          {refreshError && (
            <div className="chat-list-load-error" role="alert">
              <span>최신 대화를 불러오지 못했어요.</span>
              <button className="button button--secondary" type="button" onClick={onRetryRefresh}>다시 시도</button>
            </div>
          )}
          {loadMoreError && (
            <div className="chat-list-load-error" role="alert">
              <span>대화를 더 불러오지 못했어요.</span>
              <button className="button button--secondary" type="button" onClick={onRetryLoadMore}>다시 시도</button>
            </div>
          )}
          {isLoadingMore && <p className="chat-list-loading-more" role="status">대화를 더 불러오는 중…</p>}
          <InfiniteScrollTrigger
            enabled={hasNext && !isLoadingMore && !loadMoreError && !isRefreshing}
            onIntersect={onLoadMore}
          />
        </>
      )}
    </section>
  );
}
