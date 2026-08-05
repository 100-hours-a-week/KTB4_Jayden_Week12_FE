import { createContext, useContext } from 'react';
import { useUnreadMessages } from './useUnreadMessages.js';

const ChatUnreadContext = createContext(null);

export function ChatUnreadProvider({ children }) {
  const unread = useUnreadMessages();
  return <ChatUnreadContext.Provider value={unread}>{children}</ChatUnreadContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChatUnread() {
  const context = useContext(ChatUnreadContext);
  if (!context) throw new Error('useChatUnread는 ChatUnreadProvider 안에서 사용해야 합니다.');
  return context;
}
