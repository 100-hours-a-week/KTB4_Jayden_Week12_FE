import { Avatar } from '../../../shared/components/Avatar.jsx';

export function MessageBubble({ message, isMine, isRead, target }) {
  const unsupported = message.chatType !== 'TEXT';
  const text = message.deletedAt
    ? '삭제된 메시지입니다.'
    : unsupported
      ? '지원하지 않는 형식의 메시지입니다.'
      : message.content;

  return (
    <li className={`chat-message ${isMine ? 'chat-message--mine' : 'chat-message--theirs'}`}>
      {!isMine && <Avatar className="chat-avatar chat-avatar--message" src={target?.profileImageUrl} name={target?.nickname} />}
      <div className="chat-message__content">
        <p className={message.deletedAt || unsupported ? 'chat-message__bubble is-muted' : 'chat-message__bubble'}>{text}</p>
        {message.status === 'sending' && <span className="chat-message__status">전송 중…</span>}
        {message.status === 'failed' && <span className="chat-message__status chat-message__status--error">전송 실패</span>}
        {isRead && <span className="chat-message__status">읽음</span>}
      </div>
    </li>
  );
}
