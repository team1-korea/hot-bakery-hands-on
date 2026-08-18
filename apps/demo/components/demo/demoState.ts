import { DEFAULT_SHOW, makeEntry } from '@/lib/mockData';
import {
  lastMintedAt,
  participantTiming,
  statusAt,
  type SubmissionPattern,
} from '@/lib/mockScenario';
import type { StateResponse } from '@/lib/types';

export type DemoVariant = 'a' | 'b';
export type DemoView = 'phone' | 'tv';
export type { SubmissionPattern };

export const DEFAULT_PARTICIPANTS = 10;
export const SESSION_END_HOLD_MS = 4_000;
export const BURST_LANDING_BUFFER_MS = 1_200;

export function completionBuffer(pattern: SubmissionPattern) {
  return pattern === 'BURST' ? BURST_LANDING_BUFFER_MS : 0;
}

export function sessionDuration(participantCount: number, pattern: SubmissionPattern) {
  return lastMintedAt(participantCount, pattern)
    + completionBuffer(pattern)
    + 600
    + SESSION_END_HOLD_MS;
}

export function makeSubmission(index: number) {
  const entry = makeEntry(index, 'MINTED');
  return {
    nickname: entry.nickname,
    photoPreview: entry.photoUrl,
    shelfNumber: index + 1,
    tokenId: entry.tokenId ?? 1042 + index,
  };
}

export function makeSimulationState(
  participantCount: number,
  elapsedMs: number,
  pattern: SubmissionPattern,
): StateResponse {
  const entries = Array.from({ length: participantCount }, (_, index) => {
    const status = statusAt(index, elapsedMs, pattern);
    return status ? makeEntry(index, status) : null;
  }).filter((entry) => entry !== null);

  return {
    entries,
    show: { ...DEFAULT_SHOW, qrVisible: false },
    counts: {
      submitted: entries.length,
      minted: entries.filter((entry) => entry.status === 'MINTED').length,
    },
  };
}

export function participantLocalTime(index: number, elapsedMs: number, pattern: SubmissionPattern) {
  return Math.max(0, elapsedMs - participantTiming(index, pattern).startAt);
}
