import { Link } from 'react-router-dom';
import { Avatar } from '../../../shared/components/Avatar.jsx';
import { formatChatDateTitle, formatChatRelativeTime } from '../formatChatTime.js';

export function ChatRoomCard({ room, now }) {
  const hasUnread = room.unreadCount > 0;
  const unreadLabel = hasUnread ? `, 읽지 않은 메시지 ${room.unreadCount}개` : '';
  const preview = room.content ?? '삭제된 메시지입니다.';
  const relativeTime = formatChatRelativeTime(room.createdAt, now);

  return (
    <li className="chat-room-card">
      <Link
        className="chat-room-card__link"
        to={`/chats/${encodeURIComponent(room.chatRoomId)}`}
        aria-label={`${room.nickname}님과의 대화${unreadLabel}`}
      >
        <Avatar className="chat-room-card__avatar" src={room.profileImageUrl} name={room.nickname} />
        <span className="chat-room-card__body">
          <strong className="chat-room-card__nickname" title={room.nickname}>{room.nickname}</strong>
          <span className={`chat-room-card__preview${hasUnread ? ' is-unread' : ''}`} title={preview}>{preview}</span>
        </span>
        <span className="chat-room-card__meta">
          <time dateTime={room.createdAt} title={formatChatDateTitle(room.createdAt)}>{relativeTime}</time>
          {hasUnread && <span className="chat-room-card__badge" aria-hidden="true">{room.unreadCount > 99 ? '99+' : room.unreadCount}</span>}
        </span>
      </Link>
    </li>
  );
}
