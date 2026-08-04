import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageComposer } from '../features/chat/components/MessageComposer.jsx';
import { MessageList } from '../features/chat/components/MessageList.jsx';
import { useChat } from '../features/chat/ChatContext.jsx';
import { Avatar } from '../shared/components/Avatar.jsx';

function parseRoomId(value) {
  if (!/^\d+$/.test(value || '')) return null;
  const roomId = Number(value);
  return Number.isSafeInteger(roomId) && roomId > 0 ? roomId : null;
}

export function ChatRoomPage() {
  const params = useParams();
  const roomId = parseRoomId(params.roomId);
  const chat = useChat();
  const lastReadRef = useRef(0);
  const {
    closeChat,
    currentUser,
    markAsRead,
    messages,
    openRoom,
    refreshUnread,
    status,
  } = chat;

  useEffect(() => {
    if (!roomId) return undefined;
    const timer = window.setTimeout(() => void openRoom(roomId), 0);
    return () => {
      window.clearTimeout(timer);
      closeChat();
    };
  }, [closeChat, openRoom, roomId]);

  useEffect(() => {
    if (status !== 'connected' || document.visibilityState !== 'visible') return undefined;
    const latestOpponentMessage = [...messages].reverse().find((message) => (
      message.messageId && String(message.senderId) !== String(currentUser?.userId)
    ));
    if (!latestOpponentMessage || latestOpponentMessage.messageId <= lastReadRef.current) return undefined;

    const timer = window.setTimeout(() => {
      if (markAsRead(latestOpponentMessage.messageId)) {
        lastReadRef.current = latestOpponentMessage.messageId;
        window.setTimeout(() => void refreshUnread(), 600);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [currentUser?.userId, markAsRead, messages, refreshUnread, status]);

  if (!roomId) {
    return (
      <main id="main-content" className="chat-room-page">
        <div className="chat-room-state"><h1>채팅방을 찾을 수 없습니다.</h1><Link className="button button--primary" to="/chats">메시지 목록으로</Link></div>
      </main>
    );
  }

  return (
    <main id="main-content" className="chat-room-page">
      <section className="chat-room-shell" aria-labelledby="chat-room-title">
        <header className="chat-room-header">
          <Avatar className="chat-avatar chat-avatar--header" src={chat.target?.profileImageUrl} name={chat.target?.nickname} />
          <div>
            <span>대화 상대</span>
            <h1 id="chat-room-title">{chat.target?.nickname || '메시지'}</h1>
          </div>
        </header>
        <MessageList
          messages={chat.messages}
          currentUserId={chat.currentUser?.userId}
          target={chat.target}
          status={chat.status}
        />
        {chat.error && (
          <div className="chat-room-error" role="alert">
            <p>{chat.error}</p>
            {chat.status === 'connection-error' && <Link to="/chats">메시지 목록으로 돌아가기</Link>}
          </div>
        )}
        <MessageComposer disabled={chat.status !== 'connected'} targetName={chat.target?.nickname} onSend={chat.sendMessage} />
      </section>
    </main>
  );
}
