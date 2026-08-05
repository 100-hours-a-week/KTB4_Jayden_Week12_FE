import { beforeEach, describe, expect, it, vi } from 'vitest';

const stomp = vi.hoisted(() => ({ Client: vi.fn() }));
vi.mock('@stomp/stompjs', () => ({ Client: stomp.Client }));

import { createChatSocket } from './chatSocket.js';

let client;
let clientOptions;

beforeEach(() => {
  vi.clearAllMocks();
  client = {
    connected: true,
    activate: vi.fn(),
    deactivate: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn(),
    publish: vi.fn(),
  };
  stomp.Client.mockImplementation(function ClientMock(options) {
    clientOptions = options;
    return client;
  });
});

describe('chatSocket', () => {
  it('access token으로 연결하고 성공 frame을 JSON으로 변환한다', async () => {
    const socket = createChatSocket({ accessToken: 'token-1' });
    const connecting = socket.connect();
    expect(clientOptions.connectHeaders).toEqual({ Authorization: 'Bearer token-1' });
    expect(clientOptions.brokerURL).toMatch(/\/ws-chat$/);
    expect(client.activate).toHaveBeenCalledTimes(1);

    client.onConnect();
    await expect(connecting).resolves.toBeUndefined();

    const onMessage = vi.fn();
    client.subscribe.mockImplementation((destination, callback) => ({ destination, callback }));
    const subscription = socket.subscribe('/sub/chatrooms/20', onMessage);
    subscription.callback({ body: '{"message":"MESSAGE_READ"}' });
    expect(onMessage).toHaveBeenCalledWith({ message: 'MESSAGE_READ' });
  });

  it('message, read, reauth destination을 adapter 내부에 캡슐화한다', () => {
    const socket = createChatSocket({ accessToken: 'token-1' });
    socket.publishMessage(20, { clientMessageId: 'one', content: '안녕' });
    socket.publishRead(20, 30);
    socket.reauthenticate('token-2');

    expect(client.publish).toHaveBeenNthCalledWith(1, {
      destination: '/pub/chatrooms/20/messages',
      body: JSON.stringify({ clientMessageId: 'one', content: '안녕' }),
    });
    expect(client.publish).toHaveBeenNthCalledWith(2, {
      destination: '/pub/chatrooms/20/read',
      body: JSON.stringify({ lastReadMessageId: 30 }),
    });
    expect(client.publish).toHaveBeenNthCalledWith(3, {
      destination: '/pub/auth/reauth',
      body: '',
      headers: { Authorization: 'Bearer token-2' },
    });
  });

  it('의도하지 않은 연결 종료만 disconnect callback으로 전달한다', async () => {
    const onDisconnect = vi.fn();
    const socket = createChatSocket({ accessToken: 'token-1', onDisconnect });
    const connecting = socket.connect();
    client.onConnect();
    await connecting;

    client.onWebSocketClose();
    expect(onDisconnect).toHaveBeenCalledTimes(1);

    await socket.deactivate();
    client.onWebSocketClose();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('올바르지 않은 JSON frame은 protocol error callback으로 격리한다', () => {
    const onProtocolError = vi.fn();
    const socket = createChatSocket({ accessToken: 'token-1', onProtocolError });
    client.subscribe.mockImplementation((destination, callback) => ({ destination, callback }));
    const subscription = socket.subscribe('/sub/chatrooms/20', vi.fn());
    expect(() => subscription.callback({ body: 'not-json' })).not.toThrow();
    expect(onProtocolError).toHaveBeenCalledWith(expect.objectContaining({
      message: '채팅 서버가 올바르지 않은 JSON을 보냈습니다.',
    }));
  });
});
