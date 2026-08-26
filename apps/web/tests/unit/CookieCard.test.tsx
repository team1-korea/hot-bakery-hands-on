import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { CookieCard } from '@/components/display/CookieCard';
import type { Entry } from '@/lib/api/types';

const OVEN_ENTRY: Entry = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  nickname: '오븐사진검증',
  status: 'SUBMITTED',
  photoUrl: '/cookie.png',
  tokenId: null,
  txHash: null,
  shelfIndex: 0,
  hidden: false,
  failureReason: null,
  submittedAt: '2026-08-26T00:00:00.000Z',
};

afterEach(() => {
  vi.useRealTimers();
});

describe('오븐 카드 증서 이미지', () => {
  test('이미지 요청을 두 번만 다시 시도한 뒤 플레이스홀더를 유지한다', () => {
    vi.useFakeTimers();
    const { container } = render(<CookieCard entry={OVEN_ENTRY} />);

    const firstRequest = screen.getByRole('img', { name: '오븐사진검증의 참가증서' });
    expect(firstRequest.getAttribute('src')).toMatch(/\/cookie\.png$/);

    fireEvent.error(firstRequest);
    expect(screen.queryByRole('img', { name: '오븐사진검증의 참가증서' })).not.toBeInTheDocument();
    expect(container.querySelector('.cookie-placeholder')).toBeVisible();

    act(() => vi.advanceTimersByTime(600));

    expect(screen.getByRole('img', { name: '오븐사진검증의 참가증서' }).getAttribute('src'))
      .toMatch(/\/cookie\.png\?bakery_retry=1$/);

    fireEvent.error(screen.getByRole('img', { name: '오븐사진검증의 참가증서' }));
    act(() => vi.advanceTimersByTime(1_200));

    expect(screen.getByRole('img', { name: '오븐사진검증의 참가증서' }).getAttribute('src'))
      .toMatch(/\/cookie\.png\?bakery_retry=2$/);

    fireEvent.error(screen.getByRole('img', { name: '오븐사진검증의 참가증서' }));
    expect(screen.queryByRole('img', { name: '오븐사진검증의 참가증서' })).not.toBeInTheDocument();
    expect(container.querySelector('.cookie-placeholder')).toBeVisible();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('재시도를 기다리는 중 카드가 사라지면 예약한 타이머를 정리한다', () => {
    vi.useFakeTimers();
    const { unmount } = render(<CookieCard entry={OVEN_ENTRY} />);

    fireEvent.error(screen.getByRole('img', { name: '오븐사진검증의 참가증서' }));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
