import { describe, expect, test } from 'vitest';

import { firstOpenOvenSlot, slotsFor } from '@/components/display/ovenSlots';
import type { Entry, EntryStatus } from '@/lib/api/types';

function entry(id: string, status: EntryStatus, hidden = false): Entry {
  return {
    id,
    nickname: id,
    status,
    photoUrl: status === 'JOINED' ? null : `/api/photos/${id}`,
    tokenId: null,
    txHash: null,
    shelfIndex: status === 'JOINED' ? null : 0,
    hidden,
    failureReason: null,
    submittedAt: '2026-08-23T00:00:00.000Z',
  };
}

describe('오븐 슬롯', () => {
  test('비어 있는 가장 앞 슬롯을 고른다', () => {
    const slots = new Map([
      ['entry-a', 0],
      ['entry-c', 2],
    ]);

    expect(firstOpenOvenSlot(slots)).toBe(1);
  });

  test('네 슬롯이 모두 차면 배정하지 않는다', () => {
    const slots = new Map([
      ['entry-a', 0],
      ['entry-b', 1],
      ['entry-c', 2],
      ['entry-d', 3],
    ]);

    expect(firstOpenOvenSlot(slots)).toBeUndefined();
  });

  test('첫 응답에서는 제출부터 민팅까지 진행 중인 공개 카드에 슬롯을 준다', () => {
    const slots = slotsFor([
      entry('joined', 'JOINED'),
      entry('submitted', 'SUBMITTED'),
      entry('pinned', 'PINNED'),
      entry('minting', 'MINTING'),
      entry('hidden', 'MINTING', true),
      entry('minted', 'MINTED'),
    ]);

    expect([...slots.keys()]).toEqual(['submitted', 'pinned', 'minting']);
  });
});
