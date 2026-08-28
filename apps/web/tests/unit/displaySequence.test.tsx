import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useDisplaySequence } from '@/components/display/displaySequence';
import type { Entry, EntryStatus } from '@/lib/api/types';

function entry(id: string, status: EntryStatus, shelfIndex: number | null = null): Entry {
  return {
    id,
    nickname: id,
    status,
    photoUrl: status === 'JOINED' ? null : `/api/photos/${id}`,
    tokenId: status === 'MINTED' ? id : null,
    txHash: status === 'MINTED' ? `0x${id}` : null,
    shelfIndex,
    hidden: false,
    failureReason: null,
    submittedAt: '2026-08-23T00:00:00.000Z',
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('TV 첫 상태 동기화', () => {
  test('빈 로딩 상태 뒤 첫 응답의 진행 중 카드를 오븐에 바로 배치한다', () => {
    vi.useFakeTimers();
    const source = [
      entry('submitted', 'SUBMITTED', 0),
      entry('pinned', 'PINNED', 1),
      entry('minting', 'MINTING', 2),
      entry('minted', 'MINTED', 3),
    ];
    const { result, rerender } = renderHook(
      ({ entries, ready }) => useDisplaySequence(entries, false, ready),
      { initialProps: { entries: [] as Entry[], ready: false } },
    );

    rerender({ entries: source, ready: true });
    act(() => vi.advanceTimersByTime(0));

    expect([...result.current.ovenSlots.keys()]).toEqual(['submitted', 'pinned', 'minting']);
    expect(result.current.entries).toEqual(source);
    expect(result.current.counts.minted).toBe(1);
  });

  test('오븐 카드가 실패해 작업대로 돌아오면 슬롯을 비운다', () => {
    vi.useFakeTimers();
    const submitted = entry('cookie', 'SUBMITTED', 0);
    const { result, rerender } = renderHook(
      ({ entries }) => useDisplaySequence(entries, false, true),
      { initialProps: { entries: [submitted] } },
    );
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.ovenSlots.has('cookie')).toBe(true);

    rerender({ entries: [{ ...submitted, status: 'FAILED' }] });
    act(() => vi.advanceTimersByTime(0));

    expect(result.current.ovenSlots.has('cookie')).toBe(false);
    expect(result.current.entries[0].status).toBe('FAILED');
  });

  test('오븐으로 이동하던 카드가 실패하면 이동을 취소하고 작업대 상태를 반영한다', () => {
    vi.useFakeTimers();
    const joined = entry('moving-cookie', 'JOINED');
    const { result, rerender } = renderHook(
      ({ entries }) => useDisplaySequence(entries, false, true),
      { initialProps: { entries: [joined] } },
    );
    act(() => vi.advanceTimersByTime(0));

    rerender({ entries: [{ ...joined, status: 'SUBMITTED', shelfIndex: 0 }] });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.phases.get(joined.id)).toBe('to-oven');

    rerender({ entries: [{ ...joined, status: 'FAILED', shelfIndex: 0 }] });
    act(() => vi.advanceTimersByTime(1_000));

    expect(result.current.phases.has(joined.id)).toBe(false);
    expect(result.current.ovenSlots.has(joined.id)).toBe(false);
    expect(result.current.entries[0].status).toBe('FAILED');
  });

  test('오븐 밖에서 기다리던 카드가 실패하면 나중에 빈 슬롯으로 들어가지 않는다', () => {
    vi.useFakeTimers();
    const submitted = Array.from({ length: 5 }, (_, index) => (
      entry(`cookie-${index + 1}`, 'SUBMITTED', index)
    ));
    const { result, rerender } = renderHook(
      ({ entries }) => useDisplaySequence(entries, false, true),
      { initialProps: { entries: submitted } },
    );
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.ovenSlots.has('cookie-5')).toBe(false);

    rerender({
      entries: submitted.map((item) => item.id === 'cookie-1'
        ? { ...item, status: 'MINTED' as const }
        : item.id === 'cookie-5'
          ? { ...item, status: 'FAILED' as const }
          : item),
    });
    act(() => vi.advanceTimersByTime(4_000));

    expect(result.current.ovenSlots.has('cookie-5')).toBe(false);
    expect(result.current.entries.find((item) => item.id === 'cookie-5')?.status).toBe('FAILED');
  });

  test('오븐 밖 대기 카드가 먼저 민팅돼도 빈 슬롯을 거쳐 진열장으로 간다', () => {
    vi.useFakeTimers();
    const submitted = Array.from({ length: 5 }, (_, index) => (
      entry(`cookie-${index + 1}`, 'SUBMITTED', index)
    ));
    const { result, rerender } = renderHook(
      ({ entries }) => useDisplaySequence(entries, false, true),
      { initialProps: { entries: submitted } },
    );
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.ovenSlots.has('cookie-5')).toBe(false);

    rerender({
      entries: submitted.map((item) => (
        item.id === 'cookie-1' || item.id === 'cookie-5'
          ? entry(item.id, 'MINTED', item.shelfIndex)
          : item
      )),
    });
    act(() => vi.advanceTimersByTime(0));

    expect(result.current.phases.get('cookie-5')).not.toBe('to-shelf');
    expect(result.current.ovenSlots.has('cookie-5')).toBe(false);

    // 먼저 오븐에 있던 카드가 진열장으로 이동한 뒤 대기 카드가 빈 슬롯으로 들어간다.
    act(() => vi.advanceTimersByTime(2_840));
    expect(result.current.phases.get('cookie-5')).toBe('to-oven');
    expect(result.current.ovenSlots.has('cookie-5')).toBe(true);

    // 오븐에서 최소 2초를 보낸 다음에만 진열장 이동을 시작한다.
    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.phases.get('cookie-5')).toBe('to-shelf');

    act(() => vi.advanceTimersByTime(720));
    expect(result.current.entries.find((item) => item.id === 'cookie-5')?.status).toBe('MINTED');
    expect(result.current.ovenSlots.has('cookie-5')).toBe(false);
  });

  test('새 카드를 처음부터 발행 완료 상태로 받아도 진열장 도착으로 집계한다', () => {
    vi.useFakeTimers();
    const minted = entry('minted-late', 'MINTED', 0);
    const { result, rerender } = renderHook(
      ({ entries }) => useDisplaySequence(entries, false, true),
      { initialProps: { entries: [] as Entry[] } },
    );
    act(() => vi.advanceTimersByTime(0));

    rerender({ entries: [minted] });
    act(() => vi.advanceTimersByTime(480));

    expect(result.current.counts).toEqual({ submitted: 1, minted: 1 });
    expect(result.current.arrivalIds.has(minted.id)).toBe(true);
  });
});
