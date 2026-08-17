import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('../../shared/api/httpClient.js', () => ({ request: requestMock }));

import { getChatHistory, getChatRoomInfo, getChatRooms, getTotalUnreadCount, resolveDirectRoom } from './chatService.js';

beforeEach(() => requestMock.mockReset());

describe('chatService', () => {
  it('상대 사용자 ID로 기존 direct room을 조회한다', async () => {
    const room = {
      chatRoomId: 20,
      opponentUserId: 31,
      nickname: 'coffee_moon',
      profileImageUrl: null,
      created: false,
    };
    requestMock.mockResolvedValue({
      status: 200,
      payload: { message: 'chat_room_read_success', data: room },
    });

    await expect(resolveDirectRoom(31)).resolves.toEqual(room);
    expect(requestMock).toHaveBeenCalledWith('/chatrooms/direct', {
      method: 'POST',
      body: { opponentId: 31 },
      signal: undefined,
      includeResponseMeta: true,
    });
  });

  it('메시지 history를 30개씩 조회하고 확정 필드를 검증한다', async () => {
    const message = {
      messageId: 501,
      clientMessageId: '52b72a7d-7997-4e11-97b3-87af8057014c',
      senderId: 31,
      content: '안녕하세요',
      chatType: 'TEXT',
      createdAt: '2026-08-04T14:30:00.123456',
      updatedAt: null,
      deletedAt: null,
    };
    requestMock.mockResolvedValue({ message: 'messages_read_success', data: [message] });

    await expect(getChatHistory(20)).resolves.toEqual([message]);
    expect(requestMock).toHaveBeenCalledWith('/chatrooms/20/messages?pageSize=30', { signal: undefined });
  });

  it('필수 메시지 필드가 빠진 응답을 거부한다', async () => {
    requestMock.mockResolvedValue({
      message: 'messages_read_success',
      data: [{ messageId: 1 }],
    });

    await expect(getChatHistory(20)).rejects.toThrow('senderId');
  });

  it('채팅방 목록의 복합 cursor를 항상 한 쌍으로 전송한다', async () => {
    requestMock.mockResolvedValue({ message: 'chat_room_list_read_success', data: [] });

    await getChatRooms({
      createdAtCursor: '2026-08-04T14:30:00',
      lastMessageIdCursor: 501,
      pageSize: 20,
    });

    expect(requestMock).toHaveBeenCalledWith(
      '/chatrooms?pageSize=20&createdAtCursor=2026-08-04T14%3A30%3A00&lastMessageIdCursor=501',
      { signal: undefined },
    );
    await expect(getChatRooms({ createdAtCursor: '2026-08-04T14:30:00' }))
        .rejects.toThrow('함께 전달');

    await expect(
        getChatRooms({ createdAtCursor: '2026-08-04T14:30:00', }), )
        .rejects.toThrow('함께 전달')

    await expect(getChatRooms({lastMessageIdCursor: 501,}),)
        .rejects.toThrow('함께 전달');

    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it('전체 unread count를 배열 합계가 아닌 전용 endpoint에서 읽는다', async () => {
    requestMock.mockResolvedValue({ message: 'unread_count_load_success', data: 6 });
    await expect(getTotalUnreadCount()).resolves.toBe(6);
    expect(requestMock).toHaveBeenCalledWith('/chatrooms/unread-count', { signal: undefined });
  });

  it('URL 직접 진입을 위해 채팅방 정보를 ID로 조회한다', async () => {
    const room = {
      chatRoomId: 20,
      opponentUserId: 31,
      nickname: 'coffee_moon',
      profileImageUrl: null,
      lastMessageId: null,
      createdAt: null,
    };
    requestMock.mockResolvedValue({ message: 'chat_room_info_read_success', data: room });
    await expect(getChatRoomInfo(20)).resolves.toEqual(room);
    expect(requestMock).toHaveBeenCalledWith('/chatrooms/20', { signal: undefined });
  });
});
