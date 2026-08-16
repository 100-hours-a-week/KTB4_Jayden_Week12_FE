import { useEffect, useId, useRef } from 'react';
import { useChatUnread } from "../ChatUnreadContext.jsx";
import { useChatReadReceipt } from "../useChatReadReceipt.js";
import { ChatConversation } from './ChatConversation.jsx';
import { ChatModalHeader } from './ChatModalHeader.jsx';

const FOCUSABLE_SELECTOR = 'button:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

export function ChatModal({ chat }) {
  const dialogRef = useRef(null);
  const composerRef = useRef(null);
  const titleId = useId();
  const { refreshUnread } = useChatUnread();
  const { closeChat, isOpen, status } = chat;

  useChatReadReceipt({
    currentUserId: chat.currentUser?.userId,
    messages: chat.messages,
    readError: chat.readError,
    readReceipt: chat.readReceipt,
    refreshUnread,
    requestRead: chat.requestRead,
    roomId: chat.room?.chatRoomId ?? null,
    status: chat.status,
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    const focusTarget = !composerRef.current?.disabled
      ? composerRef.current
      : dialog?.querySelector(FOCUSABLE_SELECTOR);
    focusTarget?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeChat();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeChat, isOpen]);

  useEffect(() => {
    if (status === 'connected') {
      composerRef.current?.focus();
    }
  }, [status]);

  if (!isOpen) return null;
  return (
    <div className="chat-overlay" onClick={(event) => event.stopPropagation()}>
      <section
        ref={dialogRef}
        className="chat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <ChatModalHeader participant={chat.target} titleId={titleId} onClose={chat.closeChat} />
        <ChatConversation
          composerRef={composerRef}
          error={chat.error}
          messages={chat.messages}
          currentUserId={chat.currentUser?.userId}
          participant={chat.target}
          status={chat.status}
          onSend={chat.sendMessage}
          opponentLastReadMessageId={chat.opponentLastReadMessageId}
        />
      </section>
    </div>
  );
}
