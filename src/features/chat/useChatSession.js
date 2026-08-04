import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_STATUS } from '../auth/authConstants.js';
import { refreshAccessToken } from '../auth/authService.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { getAccessToken, subscribeAccessToken } from '../../shared/session/tokenStore.js';
import {
  isReadEvent,
  validateAuthEvent,
  validateChatError,
  validateLiveMessage,
} from './chatContracts.js';
import { getChatHistory, getChatRoomInfo, resolveDirectRoom } from './chatService.js';
import { createChatSocket } from './chatSocket.js';

const INITIAL_STATE = {
  isOpen: false,
  status: 'closed',
  target: null,
  room: null,
  messages: [],
  error: '',
  presentation: 'modal',
};

const MESSAGE_ERROR_CODES = new Set([
  'INVALID_PAYLOAD',
  'MESSAGE_CONTENT_REQUIRED',
  'MESSAGE_CONTENT_TOO_LONG',
  'INVALID_CLIENT_MESSAGE_ID',
  'INTERNAL_SERVER_ERROR',
]);
const ROOM_ERROR_CODES = new Set(['CHAT_ROOM_ACCESS_DENIED', 'ROOM_NOT_FOUND']);
const AUTH_ERROR_CODES = new Set(['WEBSOCKET_AUTH_REQUIRED', 'INVALID_ACCESS_TOKEN', 'ACCESS_TOKEN_EXPIRED']);

function normalizeHistoryMessage(message) {
  return {
    messageId: message.messageId,
    clientMessageId: message.clientMessageId,
    senderId: message.senderId,
    content: message.deletedAt ? null : message.content,
    chatType: message.chatType,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt,
    status: 'sent',
  };
}

function normalizeLiveMessage(message) {
  return {
    messageId: message.chatMessageId,
    clientMessageId: message.clientMessageId,
    senderId: message.userId,
    content: message.deletedAt ? null : message.content,
    chatType: message.chatType,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt,
    status: 'sent',
  };
}

function mergeUniqueMessages(current, incoming, { prepend = false } = {}) {
  const result = [...current];
  const newMessages = [];
  incoming.forEach((message) => {
    const index = result.findIndex((item) => (
      item.clientMessageId === message.clientMessageId ||
      (item.messageId && message.messageId && item.messageId === message.messageId)
    ));
    if (index >= 0) result[index] = { ...result[index], ...message };
    else if (prepend) newMessages.push(message);
    else result.push(message);
  });
  return prepend ? [...newMessages, ...result] : result;
}

function getLoginUrl() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function useChatSession() {
  const { user, status: authStatus, markAnonymous } = useAuth();
  const [state, setState] = useState(INITIAL_STATE);
  const socketRef = useRef(null);
  const subscriptionsRef = useRef([]);
  const abortRef = useRef(null);
  const sessionIdRef = useRef(0);
  const triggerRef = useRef(null);
  const pendingTimersRef = useRef(new Map());
  const roomRef = useRef(null);
  const currentTokenRef = useRef(null);
  const reauthTimeoutRef = useRef(null);

  const clearPendingTimers = useCallback(() => {
    pendingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    pendingTimersRef.current.clear();
    if (reauthTimeoutRef.current) window.clearTimeout(reauthTimeoutRef.current);
    reauthTimeoutRef.current = null;
  }, []);

  const cleanupResources = useCallback(async ({ restoreFocus = false } = {}) => {
    sessionIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    subscriptionsRef.current.forEach((subscription) => {
      try {
        subscription.unsubscribe();
      } catch {
        // 이미 종료된 STOMP subscription cleanup은 멱등하게 취급한다.
      }
    });
    subscriptionsRef.current = [];
    clearPendingTimers();
    const trigger = triggerRef.current;
    triggerRef.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    roomRef.current = null;
    currentTokenRef.current = null;
    if (socket) await socket.deactivate().catch(() => {});
    if (restoreFocus) trigger?.focus?.();
  }, [clearPendingTimers]);

  const closeChat = useCallback(() => {
    setState(INITIAL_STATE);
    void cleanupResources({ restoreFocus: true });
  }, [cleanupResources]);

  const handleConnectionLost = useCallback(() => {
    setState((current) => current.isOpen ? {
      ...current,
      status: 'connection-error',
      error: '채팅 연결이 끊겼습니다.',
    } : current);
  }, []);

  const handleLiveMessage = useCallback((payload) => {
    if (isReadEvent(payload)) return;
    const message = normalizeLiveMessage(validateLiveMessage(payload));
    const timer = pendingTimersRef.current.get(message.clientMessageId);
    if (timer) window.clearTimeout(timer);
    pendingTimersRef.current.delete(message.clientMessageId);
    setState((current) => ({
      ...current,
      messages: mergeUniqueMessages(current.messages, [message]),
    }));
  }, []);

  const handleAuthEvent = useCallback((payload) => {
    validateAuthEvent(payload);
    if (reauthTimeoutRef.current) window.clearTimeout(reauthTimeoutRef.current);
    reauthTimeoutRef.current = null;
    setState((current) => current.isOpen ? { ...current, status: 'connected', error: '' } : current);
  }, []);

  const handleChatError = useCallback(async (payload) => {
    const chatError = validateChatError(payload);
    if (chatError.roomId && chatError.roomId !== roomRef.current?.chatRoomId) return;

    if (MESSAGE_ERROR_CODES.has(chatError.code)) {
      setState((current) => ({ ...current, error: chatError.message }));
      return;
    }
    if (ROOM_ERROR_CODES.has(chatError.code)) {
      setState((current) => ({ ...current, status: 'connection-error', error: chatError.message }));
      return;
    }
    if (chatError.code === 'REAUTH_USER_MISMATCH') {
      handleConnectionLost();
      return;
    }
    if (AUTH_ERROR_CODES.has(chatError.code)) {
      try {
        await refreshAccessToken();
      } catch {
        markAnonymous();
      }
    }
  }, [handleConnectionLost, markAnonymous]);

  const openConversation = useCallback(async ({ target, presentation, resolveRoom }) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      window.location.assign(getLoginUrl());
      return;
    }

    const openingTrigger = presentation === 'modal' ? document.activeElement : null;
    await cleanupResources();
    triggerRef.current = openingTrigger;
    const sessionId = sessionIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ ...INITIAL_STATE, isOpen: true, status: 'resolving-room', target, presentation });

    try {
      const room = await resolveRoom(controller.signal);
      if (sessionId !== sessionIdRef.current) return;
      roomRef.current = room;
      setState((current) => ({ ...current, room, target: room, status: 'connecting' }));

      const latestToken = getAccessToken();
      if (!latestToken) throw new Error('access token이 없습니다.');
      currentTokenRef.current = latestToken;
      const socket = createChatSocket({ accessToken: latestToken, onDisconnect: handleConnectionLost });
      socketRef.current = socket;
      await socket.connect();
      if (sessionId !== sessionIdRef.current) return;

      subscriptionsRef.current = [
        socket.subscribe('/user/queue/auth', handleAuthEvent),
        socket.subscribe('/user/queue/chat-errors', (payload) => void handleChatError(payload)),
        socket.subscribe(`/sub/chatrooms/${room.chatRoomId}`, handleLiveMessage),
      ];
      setState((current) => ({ ...current, status: 'connected', error: '' }));

      const history = await getChatHistory(room.chatRoomId, { signal: controller.signal });
      if (sessionId !== sessionIdRef.current) return;
      setState((current) => ({
        ...current,
        messages: mergeUniqueMessages(
          current.messages,
          history.map(normalizeHistoryMessage),
          { prepend: true },
        ),
      }));
    } catch (error) {
      if (error.name === 'AbortError' || sessionId !== sessionIdRef.current) return;
      const wasResolvingRoom = !roomRef.current;
      setState((current) => ({
        ...current,
        status: 'connection-error',
        error: wasResolvingRoom
          ? error?.status === 403
            ? '접근할 수 없는 채팅방입니다.'
            : error?.status === 404
              ? '채팅방을 찾을 수 없습니다.'
              : '채팅방을 열지 못했습니다.'
          : '채팅 연결이 끊겼습니다.',
      }));
    }
  }, [cleanupResources, handleAuthEvent, handleChatError, handleConnectionLost, handleLiveMessage]);

  const openChat = useCallback((target) => {
    if (!target || String(target.userId) === String(user?.userId)) return Promise.resolve();
    return openConversation({
      target,
      presentation: 'modal',
      resolveRoom: (signal) => resolveDirectRoom(target.userId, { signal }),
    });
  }, [openConversation, user?.userId]);

  const openRoom = useCallback((roomId) => openConversation({
    target: null,
    presentation: 'page',
    resolveRoom: (signal) => getChatRoomInfo(roomId, { signal }),
  }), [openConversation]);

  const sendMessage = useCallback((rawContent) => {
    const content = rawContent.trim();
    if (!content) return false;
    if (content.length > 1000) {
      setState((current) => ({ ...current, error: '메시지는 1,000자 이하로 입력해 주세요.' }));
      return false;
    }
    const socket = socketRef.current;
    const room = roomRef.current;
    if (!socket?.isConnected() || !room) {
      handleConnectionLost();
      return false;
    }

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage = {
      messageId: null,
      clientMessageId,
      senderId: user.userId,
      content,
      chatType: 'TEXT',
      createdAt: new Date().toISOString(),
      deletedAt: null,
      status: 'sending',
    };
    setState((current) => ({
      ...current,
      error: '',
      messages: mergeUniqueMessages(current.messages, [optimisticMessage]),
    }));
    try {
      socket.publishMessage(room.chatRoomId, { clientMessageId, content });
      const timer = window.setTimeout(() => {
        pendingTimersRef.current.delete(clientMessageId);
        setState((current) => ({
          ...current,
          messages: current.messages.map((message) => (
            message.clientMessageId === clientMessageId && message.status === 'sending'
              ? { ...message, status: 'failed' }
              : message
          )),
        }));
      }, 15000);
      pendingTimersRef.current.set(clientMessageId, timer);
      return true;
    } catch {
      setState((current) => ({
        ...current,
        error: '메시지를 보내지 못했습니다.',
        messages: current.messages.map((message) => (
          message.clientMessageId === clientMessageId ? { ...message, status: 'failed' } : message
        )),
      }));
      return false;
    }
  }, [handleConnectionLost, user]);

  const markAsRead = useCallback((lastReadMessageId) => {
    const socket = socketRef.current;
    const room = roomRef.current;
    if (!Number.isSafeInteger(lastReadMessageId) || lastReadMessageId < 1 || !socket?.isConnected() || !room) return false;
    socket.publishRead(room.chatRoomId, lastReadMessageId);
    return true;
  }, []);

  useEffect(() => subscribeAccessToken((token) => {
    const socket = socketRef.current;
    if (!token || !socket?.isConnected() || token === currentTokenRef.current) return;
    currentTokenRef.current = token;
    setState((current) => current.isOpen ? { ...current, status: 'reauthenticating' } : current);
    socket.reauthenticate(token);
    if (reauthTimeoutRef.current) window.clearTimeout(reauthTimeoutRef.current);
    reauthTimeoutRef.current = window.setTimeout(handleConnectionLost, 10000);
  }), [handleConnectionLost]);

  useEffect(() => {
    if (authStatus !== AUTH_STATUS.ANONYMOUS || !state.isOpen) return undefined;
    const timer = window.setTimeout(closeChat, 0);
    return () => window.clearTimeout(timer);
  }, [authStatus, closeChat, state.isOpen]);

  useEffect(() => () => { void cleanupResources(); }, [cleanupResources]);

  return { ...state, currentUser: user, openChat, openRoom, closeChat, sendMessage, markAsRead };
}
