import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatListContent } from './ChatListContent.jsx';

function renderContent(overrides = {}) {
  const props = {
    error: null,
    hasNext: false,
    isLoadingMore: false,
    isRefreshing: false,
    loadMoreError: null,
    now: new Date('2026-08-05T10:00:00Z'),
    onLoadMore: vi.fn(),
    onRetry: vi.fn(),
    onRetryLoadMore: vi.fn(),
    onRetryRefresh: vi.fn(),
    refreshError: null,
    rooms: [],
    status: 'loading',
    ...overrides,
  };
  render(<MemoryRouter><ChatListContent {...props} /></MemoryRouter>);
  return props;
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class IntersectionObserverMock {
    observe() {}
    disconnect() {}
  });
});

describe('ChatListContent', () => {
  it('초기 loading 상태를 표시한다', () => {
    renderContent();
    expect(screen.getByLabelText('메시지 목록을 불러오는 중')).toBeInTheDocument();
  });

  it('empty 상태를 표시한다', () => {
    renderContent({ status: 'empty' });
    expect(screen.getByText('아직 시작된 대화가 없어요.')).toBeInTheDocument();
  });

  it('초기 오류에서 명시적인 retry callback을 호출한다', async () => {
    const user = userEvent.setup();
    const props = renderContent({ status: 'error', error: new Error('API 오류') });

    expect(screen.getByText('API 오류')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('background refresh 오류와 기존 room을 함께 유지한다', async () => {
    const user = userEvent.setup();
    const props = renderContent({
      status: 'success',
      refreshError: new Error('동기화 실패'),
      rooms: [{
        chatRoomId: 20,
        nickname: '하비',
        profileImageUrl: null,
        unreadCount: 0,
        content: '기존 메시지',
        createdAt: '2026-08-05T09:59:00Z',
      }],
    });

    expect(screen.getByText('기존 메시지')).toBeInTheDocument();
    expect(screen.getByText('최신 대화를 불러오지 못했어요.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(props.onRetryRefresh).toHaveBeenCalledTimes(1);
  });
});
