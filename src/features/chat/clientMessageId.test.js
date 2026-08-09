import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClientMessageId } from './clientMessageId.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createClientMessageId', () => {
  it('randomUUID를 지원하면 브라우저 기본 구현을 사용한다', () => {
    const randomUUID = vi.fn(() => 'native-uuid');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createClientMessageId()).toBe('native-uuid');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('randomUUID가 없어도 getRandomValues로 UUID v4를 생성한다', () => {
    const getRandomValues = vi.fn((bytes) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });

    expect(createClientMessageId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });
});
