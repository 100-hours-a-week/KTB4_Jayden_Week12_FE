import { useEffect, useMemo, useRef, useState } from 'react';

const READ_DEBOUNCE_MS = 300;
const READ_CONFIRMATION_TIMEOUT_MS = 1000;

function getLatestOpponentMessageId(messages, currentUserId) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.messageId && String(message.senderId) !== String(currentUserId)) {
      return message.messageId;
    }
  }
  return 0;
}

export function useChatReadReceipt({
  currentUserId,
  messages,
  readError,
  readReceipt,
  refreshUnread,
  requestRead,
  roomId,
  status,
}) {
  const [activityVersion, setActivityVersion] = useState(0);
  const confirmedReadRef = useRef(0);
  const requestedReadRef = useRef(0);
  const failedReadRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const confirmationTimerRef = useRef(null);

  const latestOpponentMessageId = useMemo(
    () => getLatestOpponentMessageId(messages, currentUserId),
    [currentUserId, messages],
  );

  useEffect(() => {
    const handleActivity = () => {
      if (document.visibilityState === 'visible') {
        setActivityVersion((version) => version + 1);
      }
    };
    document.addEventListener('visibilitychange', handleActivity);
    window.addEventListener('focus', handleActivity);
    return () => {
      document.removeEventListener('visibilitychange', handleActivity);
      window.removeEventListener('focus', handleActivity);
    };
  }, []);

  useEffect(() => {
    confirmedReadRef.current = 0;
    requestedReadRef.current = 0;
    failedReadRef.current = 0;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    if (confirmationTimerRef.current) window.clearTimeout(confirmationTimerRef.current);
    debounceTimerRef.current = null;
    confirmationTimerRef.current = null;
  }, [roomId]);

  useEffect(() => {
    if (!failedReadRef.current) return;
    requestedReadRef.current = confirmedReadRef.current;
    failedReadRef.current = 0;
  }, [activityVersion]);

  useEffect(() => {
    if (!readReceipt) return;
    if (readReceipt.roomId !== roomId || String(readReceipt.readerId) !== String(currentUserId)) return;

    confirmedReadRef.current = Math.max(
      confirmedReadRef.current,
      readReceipt.lastReadMessageId,
    );
    if (readReceipt.lastReadMessageId < requestedReadRef.current) return;

    if (confirmationTimerRef.current) window.clearTimeout(confirmationTimerRef.current);
    confirmationTimerRef.current = null;
    failedReadRef.current = 0;
    void refreshUnread();
  }, [currentUserId, readReceipt, refreshUnread, roomId]);

  useEffect(() => {
    if (!readError || (readError.roomId && readError.roomId !== roomId)) return;
    if (confirmationTimerRef.current) window.clearTimeout(confirmationTimerRef.current);
    confirmationTimerRef.current = null;
    failedReadRef.current = requestedReadRef.current;
  }, [readError, roomId]);

  useEffect(() => {
    if (
      status !== 'connected' ||
      document.visibilityState !== 'visible' ||
      !latestOpponentMessageId ||
      latestOpponentMessageId <= requestedReadRef.current
    ) return undefined;

    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    const targetMessageId = latestOpponentMessageId;
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      if (!requestRead(targetMessageId)) return;

      requestedReadRef.current = targetMessageId;
      if (confirmationTimerRef.current) window.clearTimeout(confirmationTimerRef.current);
      confirmationTimerRef.current = window.setTimeout(() => {
        confirmationTimerRef.current = null;
        confirmedReadRef.current = Math.max(
          confirmedReadRef.current,
          requestedReadRef.current,
        );
        failedReadRef.current = 0;
        void refreshUnread();
      }, READ_CONFIRMATION_TIMEOUT_MS);
    }, READ_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    };
  }, [activityVersion, latestOpponentMessageId, refreshUnread, requestRead, status]);

  useEffect(() => () => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    if (confirmationTimerRef.current) window.clearTimeout(confirmationTimerRef.current);
  }, []);
}
