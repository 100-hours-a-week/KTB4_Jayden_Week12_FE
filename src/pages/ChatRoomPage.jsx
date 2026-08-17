import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChatConversation } from '../features/chat/components/ChatConversation.jsx';
import { useChatSessionContext } from '../features/chat/ChatSessionContext.jsx';
import { useChatUnread } from '../features/chat/ChatUnreadContext.jsx';
import { useChatReadReceipt } from '../features/chat/useChatReadReceipt.js';
import { Avatar } from '../shared/components/Avatar.jsx';

function parseRoomId(value) {
  if (!/^\d+$/.test(value || '')) return null;
  const roomId = Number(value);
  return Number.isSafeInteger(roomId) && roomId > 0 ? roomId : null;
}

export function ChatRoomPage() {
  const params = useParams();
  const roomId = parseRoomId(params.roomId);
  const chat = useChatSessionContext();
  const { refreshUnread } = useChatUnread();
  const {
    closeChat,
    currentUser,
    messages,
    openRoom,
    readError,
    readReceipt,
    requestRead,
    status,
  } = chat;

  useChatReadReceipt({
    currentUserId: currentUser?.userId,
    messages,
    readError,
    readReceipt,
    refreshUnread,
    requestRead,
    roomId: roomId ? chat.room?.chatRoomId ?? roomId : null,
    status,
  });

  useEffect(() => {
    if (!roomId) return undefined;
    const timer = window.setTimeout(() => void openRoom(roomId), 0);
    return () => {
      window.clearTimeout(timer);
      closeChat();
    };
  }, [closeChat, openRoom, roomId]);

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
        <ChatConversation
          error={chat.error}
          errorAction={chat.status === 'connection-error'
            ? <Link to="/chats">메시지 목록으로 돌아가기</Link>
            : null}
          feedbackVariant="room"
          messages={chat.messages}
          currentUserId={chat.currentUser?.userId}
          participant={chat.target}
          status={chat.status}
          onSend={chat.sendMessage}
          opponentLastReadMessageId={chat.opponentLastReadMessageId}
        />
      </section>
    </main>
  );
}
