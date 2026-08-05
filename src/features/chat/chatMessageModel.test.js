import { describe, expect, it } from 'vitest';
import {
  createOptimisticTextMessage,
  markMessageFailed,
  mergeChatMessages,
  normalizeHistoryMessage,
  normalizeLiveMessage,
} from './chatMessageModel.js';

describe('chatMessageModel', () => {
  it('history와 live wire message를 동일한 화면 model로 변환한다', () => {
    expect(normalizeHistoryMessage({
      messageId: 10,
      clientMessageId: 'history-10',
      senderId: 2,
      content: '기존 메시지',
      chatType: 'TEXT',
      createdAt: '2026-08-05T10:00:00Z',
      deletedAt: null,
    })).toMatchObject({ messageId: 10, senderId: 2, status: 'sent' });

    expect(normalizeLiveMessage({
      chatMessageId: 11,
      clientMessageId: 'live-11',
      userId: 3,
      content: '새 메시지',
      chatType: 'TEXT',
      createdAt: '2026-08-05T10:01:00Z',
      deletedAt: null,
    })).toMatchObject({ messageId: 11, senderId: 3, status: 'sent' });
  });

  it('삭제된 message의 content를 tombstone용 null로 정규화한다', () => {
    expect(normalizeHistoryMessage({
      messageId: 10,
      clientMessageId: 'deleted-10',
      senderId: 2,
      content: '서버가 잘못 포함한 본문',
      chatType: 'TEXT',
      createdAt: '2026-08-05T10:00:00Z',
      deletedAt: '2026-08-05T10:02:00Z',
    }).content).toBeNull();
  });

  it('optimistic message를 echo로 확정하고 중복을 남기지 않는다', () => {
    const optimistic = createOptimisticTextMessage({
      clientMessageId: 'client-1',
      senderId: 1,
      content: '안녕하세요',
      createdAt: '2026-08-05T10:00:00Z',
    });
    const confirmed = { ...optimistic, messageId: 20, status: 'sent' };

    expect(mergeChatMessages([optimistic], [confirmed])).toEqual([confirmed]);
  });

  it('history prepend 순서를 유지하고 같은 batch 중복도 제거한다', () => {
    const current = [{ messageId: 3, clientMessageId: 'three', status: 'sent' }];
    const one = { messageId: 1, clientMessageId: 'one', status: 'sent' };
    const two = { messageId: 2, clientMessageId: 'two', status: 'sent' };
    const updatedTwo = { ...two, content: '최종 본문' };

    expect(mergeChatMessages(current, [one, two, updatedTwo], { prepend: true })).toEqual([
      one,
      updatedTwo,
      current[0],
    ]);
  });

  it('sending message만 failed로 변경한다', () => {
    const messages = [
      { clientMessageId: 'one', status: 'sending' },
      { clientMessageId: 'two', status: 'sent' },
    ];
    expect(markMessageFailed(messages, 'one')).toEqual([
      { clientMessageId: 'one', status: 'failed' },
      messages[1],
    ]);
  });
});
