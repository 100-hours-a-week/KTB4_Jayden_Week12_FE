import { describe, expect, it } from 'vitest';
import { formatChatRelativeTime } from './formatChatTime.js';

const now = new Date('2026-08-04T15:00:00');

describe('formatChatRelativeTime', () => {
  it.each([
    ['2026-08-04T14:59:30', '방금'],
    ['2026-08-04T14:59:00', '1분 전'],
    ['2026-08-04T14:00:00', '1시간 전'],
    ['2026-08-03T14:00:01', '어제'],
    ['2026-08-02T15:00:00', '2일 전'],
  ])('%s를 %s으로 표시한다', (createdAt, expected) => {
    expect(formatChatRelativeTime(createdAt, now)).toBe(expected);
  });

  it('잘못됐거나 미래인 시각은 빈 문자열을 반환한다', () => {
    expect(formatChatRelativeTime('invalid', now)).toBe('');
    expect(formatChatRelativeTime('2026-08-04T16:00:00', now)).toBe('');
  });
});
