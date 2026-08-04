import { createContext, useContext } from 'react';
import { ChatModal } from './components/ChatModal.jsx';
import { useChatSession } from './useChatSession.js';
import { useUnreadMessages } from './useUnreadMessages.js';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const chat = useChatSession();
  const unread = useUnreadMessages();
  const value = { ...chat, ...unread };
  return (
    <ChatContext.Provider value={value}>
      {children}
      {chat.presentation === 'modal' && <ChatModal chat={chat} />}
    </ChatContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat은 ChatProvider 안에서 사용해야 합니다.');
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalChat() {
  return useContext(ChatContext);
}
