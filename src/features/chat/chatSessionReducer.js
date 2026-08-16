import { markMessageFailed, mergeChatMessages } from './chatMessageModel.js';

export const CHAT_SESSION_STATUS = Object.freeze({
  CLOSED: 'closed',
  RESOLVING_ROOM: 'resolving-room',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  REAUTHENTICATING: 'reauthenticating',
  CONNECTION_ERROR: 'connection-error',
});

export const INITIAL_CHAT_SESSION_STATE = Object.freeze({
  isOpen: false,
  status: CHAT_SESSION_STATUS.CLOSED,
  target: null,
  room: null,
  messages: [],
  error: '',
  readReceipt: null,
  opponentLastReadMessageId: 0,
  readError: null,
});

export const CHAT_SESSION_ACTION = Object.freeze({
  OPEN_REQUESTED: 'OPEN_REQUESTED',
  ROOM_RESOLVED: 'ROOM_RESOLVED',
  SOCKET_CONNECTED: 'SOCKET_CONNECTED',
  HISTORY_RECEIVED: 'HISTORY_RECEIVED',
  LIVE_MESSAGE_RECEIVED: 'LIVE_MESSAGE_RECEIVED',
  READ_RECEIVED: 'READ_RECEIVED',
  READ_FAILED: 'READ_FAILED',
  MESSAGE_SEND_STARTED: 'MESSAGE_SEND_STARTED',
  MESSAGE_SEND_FAILED: 'MESSAGE_SEND_FAILED',
  ERROR_REPORTED: 'ERROR_REPORTED',
  REAUTH_STARTED: 'REAUTH_STARTED',
  REAUTH_SUCCEEDED: 'REAUTH_SUCCEEDED',
  SESSION_DISCONNECTED: 'SESSION_DISCONNECTED',
  CLOSED: 'CLOSED',
});

export function chatSessionReducer(state, action) {
  switch (action.type) {
    case CHAT_SESSION_ACTION.OPEN_REQUESTED:
      return {
        ...INITIAL_CHAT_SESSION_STATE,
        isOpen: true,
        status: CHAT_SESSION_STATUS.RESOLVING_ROOM,
        target: action.target,
      };
    case CHAT_SESSION_ACTION.ROOM_RESOLVED:
      return {
        ...state,
        room: action.room,
        target: action.room,
        status: CHAT_SESSION_STATUS.CONNECTING,
      };
    case CHAT_SESSION_ACTION.SOCKET_CONNECTED:
    case CHAT_SESSION_ACTION.REAUTH_SUCCEEDED:
      return state.isOpen
        ? { ...state, status: CHAT_SESSION_STATUS.CONNECTED, error: '' }
        : state;
    case CHAT_SESSION_ACTION.HISTORY_RECEIVED:
      return {
        ...state,
        messages: mergeChatMessages(state.messages, action.messages, { prepend: true }),
      };
    case CHAT_SESSION_ACTION.LIVE_MESSAGE_RECEIVED:
      return {
        ...state,
        messages: mergeChatMessages(state.messages, [action.message]),
      };
    case CHAT_SESSION_ACTION.READ_RECEIVED:
      return {
        ...state,
        readReceipt: action.receipt,
        opponentLastReadMessageId: action.isOpponent
          ? Math.max(state.opponentLastReadMessageId, action.receipt.lastReadMessageId)
          : state.opponentLastReadMessageId,
        readError: null,
      };
    case CHAT_SESSION_ACTION.READ_FAILED:
      return { ...state, readError: action.error };
    case CHAT_SESSION_ACTION.MESSAGE_SEND_STARTED:
      return {
        ...state,
        error: '',
        messages: mergeChatMessages(state.messages, [action.message]),
      };
    case CHAT_SESSION_ACTION.MESSAGE_SEND_FAILED:
      return {
        ...state,
        error: action.error ?? state.error,
        messages: markMessageFailed(state.messages, action.clientMessageId),
      };
    case CHAT_SESSION_ACTION.ERROR_REPORTED:
      return state.isOpen ? { ...state, error: action.error } : state;
    case CHAT_SESSION_ACTION.REAUTH_STARTED:
      return state.isOpen
        ? { ...state, status: CHAT_SESSION_STATUS.REAUTHENTICATING }
        : state;
    case CHAT_SESSION_ACTION.SESSION_DISCONNECTED:
      return state.isOpen
        ? { ...state, status: CHAT_SESSION_STATUS.CONNECTION_ERROR, error: action.error }
        : state;
    case CHAT_SESSION_ACTION.CLOSED:
      return INITIAL_CHAT_SESSION_STATE;
    default:
      return state;
  }
}
