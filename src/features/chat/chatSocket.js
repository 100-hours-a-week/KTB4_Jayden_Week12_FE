import { Client } from '@stomp/stompjs';

function getWebSocketUrl() {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (/^https?:\/\//i.test(apiBaseUrl)) {
    const url = new URL(apiBaseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws-chat';
    url.search = '';
    url.hash = '';
    return url.toString();
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws-chat`;
}

function parseFrame(frame) {
  try {
    return JSON.parse(frame.body);
  } catch {
    throw new Error('채팅 서버가 올바르지 않은 JSON을 보냈습니다.');
  }
}

export function createChatSocket({ accessToken, onDisconnect, onProtocolError }) {
  let intentionallyClosing = false;
  let settled = false;
  let rejectConnection;

  const client = new Client({
    brokerURL: getWebSocketUrl(),
    connectHeaders: { Authorization: `Bearer ${accessToken}` },
    reconnectDelay: 0,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {},
  });

  const connect = () => new Promise((resolve, reject) => {
    rejectConnection = reject;
    client.onConnect = () => {
      settled = true;
      resolve();
    };

    client.onStompError = (frame) => {
      const error = new Error(frame.headers.message || 'STOMP 연결에 실패했습니다.');

      if (!settled) {
        reject(error);
        return;
      }
      onDisconnect?.(error);
    };

    client.onWebSocketError = () => {
      if (!settled) reject(new Error('WebSocket 연결에 실패했습니다.'));
    };
    client.onWebSocketClose = () => {
      if (!intentionallyClosing) {
        const error = new Error('채팅 연결이 끊겼습니다.');
        if (!settled) rejectConnection?.(error);
        else onDisconnect?.(error);
      }
    };
    client.activate();
  });

  return {
    connect,
    subscribe(destination, onMessage) {
      return client.subscribe(destination, (frame) => {
        try {
          Promise.resolve(onMessage(parseFrame(frame))).catch((error) => onProtocolError?.(error));
        } catch (error) {
          onProtocolError?.(error);
        }
      });
    },
    publishMessage(roomId, payload) {
      client.publish({
        destination: `/pub/chatrooms/${roomId}/messages`,
        body: JSON.stringify(payload),
      });
    },
    publishRead(roomId, lastReadMessageId) {
      client.publish({
        destination: `/pub/chatrooms/${roomId}/read`,
        body: JSON.stringify({ lastReadMessageId }),
      });
    },
    reauthenticate(token) {
      client.publish({
        destination: '/pub/auth/reauth',
        body: '',
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    isConnected() {
      return client.connected;
    },
    async deactivate() {
      intentionallyClosing = true;
      await client.deactivate();
    },
  };
}
