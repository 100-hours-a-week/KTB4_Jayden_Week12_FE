import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble.jsx';

export function MessageList({ messages, currentUserId, opponentLastReadMessageId, target, status }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, opponentLastReadMessageId]);

  return (
    <div className="chat-messages" aria-live="polite">
      {status === 'resolving-room' && <p className="chat-empty">채팅방을 여는 중…</p>}
      {status === 'connecting' && <p className="chat-empty">채팅에 연결하는 중…</p>}
      {status !== 'resolving-room' && status !== 'connecting' && messages.length === 0 && (
        <p className="chat-empty">{target?.nickname}님과의 대화를 시작해 보세요.</p>
      )}
      <ol className="chat-message-list">
        {messages.map((message) => {
          const isMine = String(message.senderId) === String(currentUserId);
          return (
            <MessageBubble
              key={message.clientMessageId || message.messageId}
              message={message}
              isMine={isMine}
              isRead={isMine && message.messageId <= opponentLastReadMessageId}
              target={target}
            />
          );
        })}
      </ol>
      <div ref={endRef} />
    </div>
  );
}
