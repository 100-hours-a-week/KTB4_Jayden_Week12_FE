import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_STATUS } from '../auth/authConstants.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { getTotalUnreadCount } from './chatService.js';

const UNREAD_POLL_INTERVAL = 30000;

export function useUnreadMessages() {
  const { status, user } = useAuth();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const countRef = useRef(0);
  const requestRef = useRef(null);
  const controllerRef = useRef(null);

  const refreshUnread = useCallback(() => {
    if (status !== AUTH_STATUS.AUTHENTICATED) return Promise.resolve(0);
    if (requestRef.current) return requestRef.current;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const request = getTotalUnreadCount({ signal: controller.signal })
      .then((count) => {
        countRef.current = count;
        setTotalUnreadCount(count);
        return count;
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return countRef.current;
        return countRef.current;
      })
      .finally(() => {
        if (requestRef.current === request) requestRef.current = null;
      });
    requestRef.current = request;
    return request;
  }, [status]);

  useEffect(() => {
    if (status !== AUTH_STATUS.AUTHENTICATED) return undefined;
    const initialTimer = window.setTimeout(() => void refreshUnread(), 0);
    const interval = window.setInterval(() => void refreshUnread(), UNREAD_POLL_INTERVAL);
    const handleFocus = () => void refreshUnread();
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      controllerRef.current?.abort();
      controllerRef.current = null;
      requestRef.current = null;
    };
  }, [refreshUnread, status, user?.userId]);

  useEffect(() => {
    if (status === AUTH_STATUS.ANONYMOUS) {
      const timer = window.setTimeout(() => {
        countRef.current = 0;
        setTotalUnreadCount(0);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [status]);

  return { totalUnreadCount, refreshUnread };
}
