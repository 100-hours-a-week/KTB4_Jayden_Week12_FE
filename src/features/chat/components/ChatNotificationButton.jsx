import { Link, useLocation } from 'react-router-dom';
import { useChatUnread } from '../ChatUnreadContext.jsx';

export function ChatNotificationButton() {
  const { totalUnreadCount } = useChatUnread();
  const location = useLocation();
  const isActive = /^\/chats(?:\/|$)/.test(location.pathname);
  const label = totalUnreadCount > 0
    ? `읽지 않은 메시지 ${totalUnreadCount}개, 메시지 목록 열기`
    : '메시지 목록 열기';
  const from = `${location.pathname}${location.search}${location.hash}`;

  return (
    <Link
      className={`chat-notification${isActive ? ' is-active' : ''}`}
      to="/chats"
      state={{ from }}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.75 5.75h14.5v10.5H9l-4.25 3v-13.5Z" />
        <path d="M8 10h8M8 13h5" />
      </svg>
      {totalUnreadCount > 0 && <span className="chat-notification__dot" aria-hidden="true" />}
    </Link>
  );
}
