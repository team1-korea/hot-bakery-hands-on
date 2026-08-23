import type { EntryStatus } from '@/lib/api/types';

export type EntryZone = 'workbench' | 'oven' | 'shelf';

/**
 * 카드는 "누가 손대야 하는가"로 구역을 나눈다.
 * 작업대는 사진을 안 낸 참가자와 실패한 카드, 오븐은 기계가 처리 중인 카드다.
 */
const ZONE_BY_STATUS: Record<EntryStatus, EntryZone> = {
  JOINED: 'workbench',
  SUBMITTED: 'oven',
  PINNED: 'oven',
  MINTING: 'oven',
  MINTED: 'shelf',
  FAILED: 'workbench',
};

export function entryZone(status: EntryStatus) {
  return ZONE_BY_STATUS[status];
}
