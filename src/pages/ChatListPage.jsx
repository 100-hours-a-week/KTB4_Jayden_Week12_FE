import { useEffect, useState } from 'react';
import { ChatRoomList } from '../features/chat/components/ChatRoomList.jsx';
import { useChat } from '../features/chat/ChatContext.jsx';
import { useChatList } from '../features/chat/useChatList.js';
import { InfiniteScrollTrigger } from '../shared/components/InfiniteScrollTrigger.jsx';

function ChatListSkeleton() {
  return (
    <div className="chat-list-skeleton" aria-label="메시지 목록을 불러오는 중">
      {[0, 1, 2, 3].map((item) => <div key={item}><span /><span /><span /></div>)}
    </div>
  );
}

export function ChatListPage() {
  const { refreshUnread } = useChat();
  const [now, setNow] = useState(() => new Date());
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
  } = useChatList();

  useEffect(() => {
    void refreshUnread();
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(interval);
  }, [refreshUnread]);

  return (
    <main id="main-content" className="chat-list-page">
      <div className="chat-list-shell">
        <header className="chat-list-heading">
          <h1>메시지</h1>
        </header>
        <section
          className="chat-list-section"
          aria-labelledby="all-chats-title"
          aria-live="polite"
          aria-busy={status === 'loading' || isLoadingMore}
        >
          <h2 id="all-chats-title">모든 대화</h2>
          {status === 'loading' && <ChatListSkeleton />}
          {status === 'empty' && <div className="chat-list-empty"><p>아직 시작된 대화가 없어요.</p><span>게시글 작성자에게 먼저 메시지를 보내보세요.</span></div>}
          {status === 'error' && (
            <div className="chat-list-error" role="alert">
              <p>메시지 목록을 불러오지 못했어요.</p>
              <span>{error?.message}</span>
              <button className="button button--secondary" type="button" onClick={retry}>다시 시도</button>
            </div>
          )}
          {status === 'success' && (
            <>
              <ChatRoomList rooms={items} now={now} />
              {loadMoreError && (
                <div className="chat-list-load-error" role="alert">
                  <span>대화를 더 불러오지 못했어요.</span>
                  <button className="button button--secondary" type="button" onClick={retryLoadMore}>다시 시도</button>
                </div>
              )}
              {isLoadingMore && <p className="chat-list-loading-more" role="status">대화를 더 불러오는 중…</p>}
              <InfiniteScrollTrigger enabled={hasNext && !isLoadingMore && !loadMoreError} onIntersect={loadMore} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
