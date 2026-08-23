import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { getState } from '@/lib/api/client';
import type { StateResponse } from '@/lib/api/types';
import { useEventState } from '@/lib/useEventState';

vi.mock('@/lib/api/client', () => ({ getState: vi.fn() }));

const STATE: StateResponse = {
  entries: [],
  show: { layout: 'LIVE', qrVisible: true, shelfPage: 0 },
  counts: { submitted: 0, minted: 0 },
};

afterEach(() => {
  vi.useRealTimers();
});

describe('TV 상태 폴링', () => {
  test('앞 요청이 끝난 뒤에만 다음 요청을 보내고 첫 성공을 ready로 알린다', async () => {
    vi.useFakeTimers();
    let resolveFirst!: (state: StateResponse) => void;
    const first = new Promise<StateResponse>((resolve) => { resolveFirst = resolve; });
    const never = new Promise<StateResponse>(() => {});
    vi.mocked(getState).mockReturnValueOnce(first).mockReturnValueOnce(never);

    const { result } = renderHook(() => useEventState());
    expect(getState).toHaveBeenCalledOnce();
    expect(result.current.ready).toBe(false);

    act(() => vi.advanceTimersByTime(10_000));
    expect(getState).toHaveBeenCalledOnce();

    await act(async () => {
      resolveFirst(STATE);
      await first;
    });
    expect(result.current.ready).toBe(true);

    act(() => vi.advanceTimersByTime(999));
    expect(getState).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(1));
    expect(getState).toHaveBeenCalledTimes(2);
  });
});
