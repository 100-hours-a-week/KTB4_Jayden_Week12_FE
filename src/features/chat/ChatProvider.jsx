import { ChatSessionProvider } from './ChatSessionContext.jsx';
import { ChatUnreadProvider } from './ChatUnreadContext.jsx';

export function ChatProvider({ children }) {
  return (
    <ChatUnreadProvider>
      <ChatSessionProvider>{children}</ChatSessionProvider>
    </ChatUnreadProvider>
  );
}
