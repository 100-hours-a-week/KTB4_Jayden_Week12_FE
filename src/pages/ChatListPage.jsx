import { useEffect, useState } from 'react';
import { ChatListContent } from '../features/chat/components/ChatListContent.jsx';
import { useChatUnread } from '../features/chat/ChatUnreadContext.jsx';
import { useChatList } from '../features/chat/useChatList.js';

export function ChatListPage() {
  const { refreshUnread } = useChatUnread();
  const [now, setNow] = useState(() => new Date());
  const {
    items,
    status,
    error,
    hasNext,
    isLoadingMore,
    isRefreshing,
    loadMoreError,
    refreshError,
    retry,
    loadMore,
    retryLoadMore,
    retryRefresh,
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
        <ChatListContent
          error={error}
          hasNext={hasNext}
          isLoadingMore={isLoadingMore}
          isRefreshing={isRefreshing}
          loadMoreError={loadMoreError}
          now={now}
          onLoadMore={loadMore}
          onRetry={retry}
          onRetryLoadMore={retryLoadMore}
          onRetryRefresh={retryRefresh}
          refreshError={refreshError}
          rooms={items}
          status={status}
        />
      </div>
    </main>
  );
}
