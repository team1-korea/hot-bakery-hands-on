import { describe, expect, test } from 'vitest';

import { entryZone, type EntryZone } from '@/components/display/entryZone';
import type { EntryStatus } from '@/lib/api/types';

const ZONES: Array<[EntryStatus, EntryZone]> = [
  ['JOINED', 'workbench'],
  ['FAILED', 'workbench'],
  ['SUBMITTED', 'oven'],
  ['PINNED', 'oven'],
  ['MINTING', 'oven'],
  ['MINTED', 'shelf'],
];

describe('TV 카드 구역', () => {
  test.each(ZONES)('%s 상태를 %s에 배치한다', (status, expected) => {
    expect(entryZone(status)).toBe(expected);
  });
});
