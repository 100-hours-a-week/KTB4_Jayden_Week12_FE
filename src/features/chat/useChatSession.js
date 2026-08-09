import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AUTH_STATUS } from '../auth/authConstants.js';
import { refreshAccessToken } from '../auth/authService.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { getAccessToken, subscribeAccessToken } from '../../shared/session/tokenStore.js';
import {
  isReadEvent,
  validateAuthEvent,
  validateChatError,
  validateLiveMessage,
  validateReadEvent,
} from './chatContracts.js';
import { getChatHistory, getChatRoomInfo, resolveDirectRoom } from './chatService.js';
import { createChatSocket } from './chatSocket.js';
import { createClientMessageId } from './clientMessageId.js';
import {
  createOptimisticTextMessage,
  normalizeHistoryMessage,
  normalizeLiveMessage,
} from './chatMessageModel.js';
import {
  CHAT_SESSION_ACTION,
  INITIAL_CHAT_SESSION_STATE,
  chatSessionReducer,
} from './chatSessionReducer.js';
import {
  CHAT_ERROR_KIND,
  classifyChatError,
  getConversationOpenError,
} from './chatErrorPolicy.js';

const MESSAGE_ACK_TIMEOUT_MS = 15000;
const REAUTH_TIMEOUT_MS = 10000;

function getLoginUrl() {
  const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function useChatSession() {
  const { user, status: authStatus, markAnonymous } = useAuth();
  const [state, dispatch] = useReducer(chatSessionReducer, INITIAL_CHAT_SESSION_STATE);
  const socketRef = useRef(null);
  const subscriptionsRef = useRef([]);
  const abortRef = useRef(null);
  const sessionIdRef = useRef(0);
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

  const cleanupResources = useCallback(async () => {
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
    const socket = socketRef.current;
    socketRef.current = null;
    roomRef.current = null;
    currentTokenRef.current = null;
    if (socket) await socket.deactivate().catch(() => {});
  }, [clearPendingTimers]);

  const closeChat = useCallback(() => {
    dispatch({ type: CHAT_SESSION_ACTION.CLOSED });
    void cleanupResources();
  }, [cleanupResources]);

  const handleConnectionLost = useCallback(() => {
    dispatch({
      type: CHAT_SESSION_ACTION.SESSION_DISCONNECTED,
      error: '채팅 연결이 끊겼습니다.',
    });
  }, []);

  const handleProtocolError = useCallback(() => {
    dispatch({
      type: CHAT_SESSION_ACTION.ERROR_REPORTED,
      error: '채팅 데이터를 처리하지 못했습니다.',
    });
  }, []);

  const handleLiveMessage = useCallback((payload) => {
    if (isReadEvent(payload)) {
      dispatch({
        type: CHAT_SESSION_ACTION.READ_RECEIVED,
        receipt: validateReadEvent(payload),
      });
      return;
    }
    const message = normalizeLiveMessage(validateLiveMessage(payload));
    const timer = pendingTimersRef.current.get(message.clientMessageId);
    if (timer) window.clearTimeout(timer);
    pendingTimersRef.current.delete(message.clientMessageId);
    dispatch({ type: CHAT_SESSION_ACTION.LIVE_MESSAGE_RECEIVED, message });
  }, []);

  const handleAuthEvent = useCallback((payload) => {
    validateAuthEvent(payload);
    if (reauthTimeoutRef.current) window.clearTimeout(reauthTimeoutRef.current);
    reauthTimeoutRef.current = null;
    dispatch({ type: CHAT_SESSION_ACTION.REAUTH_SUCCEEDED });
  }, []);

  const handleChatError = useCallback(async (payload) => {
    const chatError = validateChatError(payload);
    if (chatError.roomId && chatError.roomId !== roomRef.current?.chatRoomId) return;
    const kind = classifyChatError(chatError.code);

    if (kind === CHAT_ERROR_KIND.MESSAGE) {
      dispatch({ type: CHAT_SESSION_ACTION.ERROR_REPORTED, error: chatError.message });
      return;
    }
    if (kind === CHAT_ERROR_KIND.ROOM) {
      dispatch({ type: CHAT_SESSION_ACTION.SESSION_DISCONNECTED, error: chatError.message });
      return;
    }
    if (kind === CHAT_ERROR_KIND.CONNECTION) {
      handleConnectionLost();
      return;
    }
    if (kind === CHAT_ERROR_KIND.READ) {
      dispatch({ type: CHAT_SESSION_ACTION.READ_FAILED, error: chatError });
      return;
    }
    if (kind === CHAT_ERROR_KIND.AUTH) {
      try {
        await refreshAccessToken();
      } catch {
        markAnonymous();
      }
    }
  }, [handleConnectionLost, markAnonymous]);

  const openConversation = useCallback(async ({ target, resolveRoom }) => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      window.location.assign(getLoginUrl());
      return;
    }

    await cleanupResources();
    const sessionId = sessionIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: CHAT_SESSION_ACTION.OPEN_REQUESTED, target });

    try {
      const room = await resolveRoom(controller.signal);
      if (sessionId !== sessionIdRef.current) return;
      roomRef.current = room;
      dispatch({ type: CHAT_SESSION_ACTION.ROOM_RESOLVED, room });

      const latestToken = getAccessToken();
      if (!latestToken) throw new Error('access token이 없습니다.');
      currentTokenRef.current = latestToken;
      const socket = createChatSocket({
        accessToken: latestToken,
        onDisconnect: handleConnectionLost,
        onProtocolError: handleProtocolError,
      });
      socketRef.current = socket;
      await socket.connect();
      if (sessionId !== sessionIdRef.current) return;

      subscriptionsRef.current = [
        socket.subscribe('/user/queue/auth', handleAuthEvent),
        socket.subscribe('/user/queue/chat-errors', handleChatError),
        socket.subscribe(`/sub/chatrooms/${room.chatRoomId}`, handleLiveMessage),
      ];
      dispatch({ type: CHAT_SESSION_ACTION.SOCKET_CONNECTED });

      const history = await getChatHistory(room.chatRoomId, { signal: controller.signal });
      if (sessionId !== sessionIdRef.current) return;
      dispatch({
        type: CHAT_SESSION_ACTION.HISTORY_RECEIVED,
        messages: history.map(normalizeHistoryMessage),
      });
    } catch (error) {
      if (error.name === 'AbortError' || sessionId !== sessionIdRef.current) return;
      dispatch({
        type: CHAT_SESSION_ACTION.SESSION_DISCONNECTED,
        error: getConversationOpenError(error, { roomResolved: Boolean(roomRef.current) }),
      });
    }
  }, [
    cleanupResources,
    handleAuthEvent,
    handleChatError,
    handleConnectionLost,
    handleLiveMessage,
    handleProtocolError,
  ]);

  const openChat = useCallback((target) => {
    if (!target || String(target.userId) === String(user?.userId)) return Promise.resolve();
    return openConversation({
      target,
      resolveRoom: (signal) => resolveDirectRoom(target.userId, { signal }),
    });
  }, [openConversation, user?.userId]);

  const openRoom = useCallback((roomId) => openConversation({
    target: null,
    resolveRoom: (signal) => getChatRoomInfo(roomId, { signal }),
  }), [openConversation]);

  const sendMessage = useCallback((rawContent) => {
    const content = rawContent.trim();
    if (!content) return false;
    if (content.length > 1000) {
      dispatch({
        type: CHAT_SESSION_ACTION.ERROR_REPORTED,
        error: '메시지는 1,000자 이하로 입력해 주세요.',
      });
      return false;
    }
    const socket = socketRef.current;
    const room = roomRef.current;
    if (!socket?.isConnected() || !room) {
      handleConnectionLost();
      return false;
    }

    const clientMessageId = createClientMessageId();
    const optimisticMessage = createOptimisticTextMessage({
      clientMessageId,
      senderId: user.userId,
      content,
      createdAt: new Date().toISOString(),
    });
    dispatch({ type: CHAT_SESSION_ACTION.MESSAGE_SEND_STARTED, message: optimisticMessage });
    try {
      socket.publishMessage(room.chatRoomId, { clientMessageId, content });
      const timer = window.setTimeout(() => {
        pendingTimersRef.current.delete(clientMessageId);
        dispatch({ type: CHAT_SESSION_ACTION.MESSAGE_SEND_FAILED, clientMessageId });
      }, MESSAGE_ACK_TIMEOUT_MS);
      pendingTimersRef.current.set(clientMessageId, timer);
      return true;
    } catch {
      dispatch({
        type: CHAT_SESSION_ACTION.MESSAGE_SEND_FAILED,
        clientMessageId,
        error: '메시지를 보내지 못했습니다.',
      });
      return false;
    }
  }, [handleConnectionLost, user]);

  const requestRead = useCallback((lastReadMessageId) => {
    const socket = socketRef.current;
    const room = roomRef.current;
    if (!Number.isSafeInteger(lastReadMessageId) || lastReadMessageId < 1 || !socket?.isConnected() || !room) return false;
    try {
      socket.publishRead(room.chatRoomId, lastReadMessageId);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => subscribeAccessToken((token) => {
    const socket = socketRef.current;
    if (!token || !socket?.isConnected() || token === currentTokenRef.current) return;
    currentTokenRef.current = token;
    dispatch({ type: CHAT_SESSION_ACTION.REAUTH_STARTED });
    socket.reauthenticate(token);
    if (reauthTimeoutRef.current) window.clearTimeout(reauthTimeoutRef.current);
    reauthTimeoutRef.current = window.setTimeout(handleConnectionLost, REAUTH_TIMEOUT_MS);
  }), [handleConnectionLost]);

  useEffect(() => {
    if (authStatus !== AUTH_STATUS.ANONYMOUS || !state.isOpen) return undefined;
    const timer = window.setTimeout(closeChat, 0);
    return () => window.clearTimeout(timer);
  }, [authStatus, closeChat, state.isOpen]);

  useEffect(() => () => { void cleanupResources(); }, [cleanupResources]);

  return { ...state, currentUser: user, openChat, openRoom, closeChat, sendMessage, requestRead };
}
