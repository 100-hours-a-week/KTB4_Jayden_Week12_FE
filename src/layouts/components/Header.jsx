import { Link, useLocation } from 'react-router-dom';
import { AccountMenu } from '../../features/auth/components/AccountMenu.jsx';
import { ChatNotificationButton } from '../../features/chat/components/ChatNotificationButton.jsx';

function getSafeChatBackTarget(location) {
  if (/^\/chats\/[^/]+\/?$/.test(location.pathname)) return '/chats';
  if (location.pathname === '/chats') {
    const from = location.state?.from;
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !/^\/(?:login|signup|chats)(?:\/|$)/.test(from)) return from;
  }
  return '/posts';
}

export function Header() {
  const location = useLocation();
  const showBackLink = location.pathname !== '/posts';
  const editMatch = location.pathname.match(/^\/posts\/(\d+)\/edit\/?$/);
  const isChatRoute = /^\/chats(?:\/|$)/.test(location.pathname);
  const backTo = editMatch ? `/posts/${editMatch[1]}` : isChatRoute ? getSafeChatBackTarget(location) : '/posts';

  return (
    <header className="site-header">
      <nav className="site-header__inner" aria-label="주요 메뉴">
        {showBackLink && <Link className="detail-back" to={backTo} aria-label={isChatRoute ? '이전 화면으로 돌아가기' : editMatch ? '게시글 상세로 돌아가기' : '게시글 목록으로 돌아가기'}><span aria-hidden="true">‹</span></Link>}
        <Link className="site-logo" to="/posts" aria-label="하비루프 홈">하비루프</Link>
        <div className="site-header__actions">
          <ChatNotificationButton />
          <AccountMenu />
        </div>
      </nav>
    </header>
  );
}
