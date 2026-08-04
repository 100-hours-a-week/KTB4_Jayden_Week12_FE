import { useEffect, useId, useRef } from 'react';
import { ChatHeader } from './ChatHeader.jsx';
import { MessageComposer } from './MessageComposer.jsx';
import { MessageList } from './MessageList.jsx';

const FOCUSABLE_SELECTOR = 'button:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';

export function ChatModal({ chat }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const { closeChat, isOpen, status } = chat;

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    const focusTarget = dialog?.querySelector('#chat-message-input:not(:disabled)') || dialog?.querySelector(FOCUSABLE_SELECTOR);
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
      dialogRef.current?.querySelector('#chat-message-input')?.focus();
    }
  }, [status]);

  if (!isOpen) return null;
  const disabled = status !== 'connected';

  return (
    <div className="chat-overlay" onClick={(event) => event.stopPropagation()}>
      <section
        ref={dialogRef}
        className="chat-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <ChatHeader target={chat.target} titleId={titleId} onClose={chat.closeChat} />
        <MessageList
          messages={chat.messages}
          currentUserId={chat.currentUser?.userId}
          target={chat.target}
          status={chat.status}
        />
        {chat.error && <p className="chat-error" role="alert">{chat.error}</p>}
        <MessageComposer disabled={disabled} targetName={chat.target?.nickname} onSend={chat.sendMessage} />
      </section>
    </div>
  );
}
