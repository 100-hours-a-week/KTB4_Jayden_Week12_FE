import { Avatar } from '../../../shared/components/Avatar.jsx';

export function ChatModalHeader({ participant, titleId, onClose }) {
  return (
    <header className="chat-header">
      <Avatar
        className="chat-avatar chat-avatar--header"
        src={participant?.profileImageUrl}
        name={participant?.nickname}
      />
      <h2 id={titleId}>{participant?.nickname}</h2>
      <button className="chat-close" type="button" onClick={onClose} aria-label="채팅 닫기">×</button>
    </header>
  );
}
