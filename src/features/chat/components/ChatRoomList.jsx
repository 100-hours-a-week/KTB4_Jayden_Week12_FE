import { ChatRoomCard } from './ChatRoomCard.jsx';

export function ChatRoomList({ rooms, now }) {
  return (
    <ul className="chat-room-list">
      {rooms.map((room) => <ChatRoomCard room={room} now={now} key={room.chatRoomId} />)}
    </ul>
  );
}
