import { useEffect, useRef } from 'react';
import { ChatModal } from './ChatModal.jsx';

export function ChatModalHost({ isPresented, session, triggerRef }) {
  const wasActiveRef = useRef(false);
  const isActive = isPresented && session.isOpen;

  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      triggerRef.current?.focus?.();
      triggerRef.current = null;
    }
    wasActiveRef.current = isActive;
  }, [isActive, triggerRef]);

  useEffect(() => () => {
    if (wasActiveRef.current) triggerRef.current?.focus?.();
    triggerRef.current = null;
  }, [triggerRef]);

  return isActive ? <ChatModal chat={session} /> : null;
}
