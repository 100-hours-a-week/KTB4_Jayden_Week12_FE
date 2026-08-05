import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ChatModalHost } from './components/ChatModalHost.jsx';
import { useChatSession } from './useChatSession.js';

const ChatSessionContext = createContext(null);

export function ChatSessionProvider({ children }) {
  const rawSession = useChatSession();
  const [isModalPresented, setIsModalPresented] = useState(false);
  const modalPresentedRef = useRef(false);
  const triggerRef = useRef(null);
  const {
    closeChat: closeSession,
    currentUser,
    openChat: openSessionChat,
    openRoom: openSessionRoom,
  } = rawSession;

  const openChat = useCallback((target) => {
    if (!target || String(target.userId) === String(currentUser?.userId)) {
      return openSessionChat(target);
    }
    if (!modalPresentedRef.current) triggerRef.current = document.activeElement;
    modalPresentedRef.current = true;
    setIsModalPresented(true);
    return openSessionChat(target);
  }, [currentUser?.userId, openSessionChat]);

  const openRoom = useCallback((roomId) => {
    modalPresentedRef.current = false;
    setIsModalPresented(false);
    return openSessionRoom(roomId);
  }, [openSessionRoom]);

  const closeChat = useCallback(() => {
    modalPresentedRef.current = false;
    setIsModalPresented(false);
    closeSession();
  }, [closeSession]);

  const session = useMemo(() => ({
    ...rawSession,
    openChat,
    openRoom,
    closeChat,
  }), [closeChat, openChat, openRoom, rawSession]);

  return (
    <ChatSessionContext.Provider value={session}>
      {children}
      <ChatModalHost
        isPresented={isModalPresented}
        session={session}
        triggerRef={triggerRef}
      />
    </ChatSessionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useChatSessionContext() {
  const context = useContext(ChatSessionContext);
  if (!context) {
    throw new Error('useChatSessionContext는 ChatSessionProvider 안에서 사용해야 합니다.');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalChatSession() {
  return useContext(ChatSessionContext);
}
