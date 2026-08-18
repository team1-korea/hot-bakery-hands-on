import type { EntryStatus } from './types';

export type SubmissionPattern = 'BURST' | 'SEQUENTIAL';

const SEQUENTIAL_CYCLE_MS = 6_600;
// A deterministic, irregular arrival rhythm that resembles people finishing
// the phone flow independently. Keeping it deterministic makes review runs
// comparable without presenting participants in artificial groups.
const LIVE_START_TIMES_MS = [
  0, 520, 1_380, 2_210, 2_860,
  4_010, 4_680, 5_740, 6_560, 7_950,
  8_480, 9_730, 10_440, 11_920, 12_760,
] as const;
const RENDER_GAPS_MS = [680, 820, 560, 740, 900] as const;
const PIN_GAPS_MS = [720, 560, 840, 640, 760] as const;
const OVEN_GAPS_MS = [640, 920, 700, 860, 580] as const;
const BAKE_TIMES_MS = [2_200, 2_520, 2_340, 2_680, 2_420] as const;

export type ParticipantTiming = {
  startAt: number;
  submittedAt: number;
  renderedAt: number;
  pinnedAt: number;
  mintingAt: number;
  mintedAt: number;
};

export function participantTiming(index: number, pattern: SubmissionPattern): ParticipantTiming {
  const startAt = pattern === 'SEQUENTIAL'
    ? index * SEQUENTIAL_CYCLE_MS
    : LIVE_START_TIMES_MS[index % LIVE_START_TIMES_MS.length]
      + Math.floor(index / LIVE_START_TIMES_MS.length) * 13_600;

  if (pattern === 'SEQUENTIAL') {
    return {
      startAt,
      submittedAt: startAt + 600,
      renderedAt: startAt + 1_400,
      pinnedAt: startAt + 2_200,
      mintingAt: startAt + 3_000,
      mintedAt: startAt + 5_200,
    };
  }

  const submittedAt = startAt + 600;
  const renderedAt = submittedAt + RENDER_GAPS_MS[index % RENDER_GAPS_MS.length];
  const pinnedAt = renderedAt + PIN_GAPS_MS[index % PIN_GAPS_MS.length];
  const mintingAt = pinnedAt + OVEN_GAPS_MS[index % OVEN_GAPS_MS.length];
  return {
    startAt,
    submittedAt,
    renderedAt,
    pinnedAt,
    mintingAt,
    mintedAt: mintingAt + BAKE_TIMES_MS[index % BAKE_TIMES_MS.length],
  };
}

export function statusAt(index: number, elapsedMs: number, pattern: SubmissionPattern): EntryStatus | null {
  const timing = participantTiming(index, pattern);
  if (elapsedMs < timing.submittedAt) return null;
  if (elapsedMs < timing.renderedAt) return 'SUBMITTED';
  if (elapsedMs < timing.pinnedAt) return 'RENDERED';
  if (elapsedMs < timing.mintingAt) return 'PINNED';
  if (elapsedMs < timing.mintedAt) return 'MINTING';
  return 'MINTED';
}

export function lastMintedAt(participantCount: number, pattern: SubmissionPattern) {
  return Math.max(...Array.from(
    { length: participantCount },
    (_, index) => participantTiming(index, pattern).mintedAt,
  ));
}
