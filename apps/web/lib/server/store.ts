import { randomUUID } from 'node:crypto';

import { MAX_ENTRIES, type Entry, type EntryStatus, type ShowState } from '@/lib/api/types';

/**
 * 백엔드가 생기기 전까지 쓰는 인메모리 저장소.
 *
 * 프로세스가 재시작되면 사라진다. 실제 세션 전에 백엔드로 교체한다.
 * 화면이 의존하는 것은 이 파일이 아니라 `lib/api/types.ts`의 계약이다.
 */

type Photo = { bytes: Uint8Array; contentType: string };

type Store = {
  codes: Map<string, string>;
  participants: Map<string, { email: string; entryId: string | null }>;
  entries: Entry[];
  photos: Map<string, Photo>;
  show: ShowState;
};

const globalKey = Symbol.for('hot-bakery.mock-store');
const globalScope = globalThis as unknown as Record<symbol, Store | undefined>;

/** 개발 중 모듈이 다시 평가돼도 제출 내역이 사라지지 않게 전역에 고정한다. */
function createStore(): Store {
  return {
    codes: new Map(),
    participants: new Map(),
    entries: [],
    photos: new Map(),
    show: { layout: 'LIVE', qrVisible: true, shelfPage: 0 },
  };
}

const store = globalScope[globalKey] ?? (globalScope[globalKey] = createStore());

/** 목 파이프라인의 단계별 소요 시간. 실제 백엔드에서는 각 단계의 완료가 이 자리를 대신한다. */
const PIPELINE: { status: EntryStatus; afterMs: number }[] = [
  { status: 'RENDERED', afterMs: 1_600 },
  { status: 'PINNED', afterMs: 3_200 },
  { status: 'MINTING', afterMs: 4_400 },
  { status: 'MINTED', afterMs: 7_600 },
];

export function issueCode(email: string): string {
  const code = String(Math.floor(100_000 + Math.random() * 900_000));
  store.codes.set(email, code);
  return code;
}

export function verifyCode(email: string, code: string): string | null {
  if (store.codes.get(email) !== code) return null;
  store.codes.delete(email);

  const existing = [...store.participants.entries()].find(([, value]) => value.email === email);
  if (existing) return existing[0];

  const participantId = randomUUID();
  store.participants.set(participantId, { email, entryId: null });
  return participantId;
}

export function findParticipant(participantId: string) {
  return store.participants.get(participantId) ?? null;
}

export function findEntryById(entryId: string): Entry | null {
  return store.entries.find((entry) => entry.id === entryId) ?? null;
}

export function createEntry(input: {
  participantId: string;
  nickname: string;
  photo: Photo;
}): Entry {
  const id = randomUUID();
  const entry: Entry = {
    id,
    nickname: input.nickname,
    status: 'SUBMITTED',
    photoUrl: `/api/photos/${id}`,
    certificateUrl: null,
    tokenId: null,
    txHash: null,
    shelfIndex: store.entries.length,
    hidden: false,
    failureReason: null,
    submittedAt: new Date().toISOString(),
  };

  store.entries.push(entry);
  store.photos.set(id, input.photo);
  store.participants.set(input.participantId, {
    email: store.participants.get(input.participantId)?.email ?? '',
    entryId: id,
  });
  schedulePipeline(id);

  return entry;
}

export function isFull(): boolean {
  return store.entries.length >= MAX_ENTRIES;
}

export function getPhoto(entryId: string): Photo | null {
  return store.photos.get(entryId) ?? null;
}

export function getState() {
  return {
    entries: store.entries,
    show: store.show,
    counts: {
      submitted: store.entries.length,
      minted: store.entries.filter((entry) => entry.status === 'MINTED').length,
    },
  };
}

export function updateShow(patch: Partial<ShowState>): ShowState {
  store.show = { ...store.show, ...patch };
  return store.show;
}

export function setHidden(entryId: string, hidden: boolean): Entry | null {
  const entry = findEntryById(entryId);
  if (!entry) return null;
  entry.hidden = hidden;
  return entry;
}

export function retryEntry(entryId: string): Entry | null {
  const entry = findEntryById(entryId);
  if (!entry || entry.status !== 'FAILED') return null;
  entry.status = 'SUBMITTED';
  entry.failureReason = null;
  schedulePipeline(entryId);
  return entry;
}

/**
 * 실패 경로를 실제로 확인하려면 실패가 일어나야 한다. `MOCK_FAILURE_RATE`(0~1)를 주면
 * 각 단계에서 그 확률로 FAILED가 된다. 기본값 0이라 평소에는 늘 성공한다.
 */
function failureRate() {
  const value = Number(process.env.MOCK_FAILURE_RATE ?? 0);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function schedulePipeline(entryId: string) {
  const rate = failureRate();

  for (const step of PIPELINE) {
    setTimeout(() => {
      const entry = findEntryById(entryId);
      if (!entry || entry.status === 'FAILED') return;

      if (rate > 0 && Math.random() < rate) {
        entry.status = 'FAILED';
        entry.failureReason = `${step.status} 단계에서 실패 (목 서버 주입)`;
        return;
      }

      entry.status = step.status;
      if (step.status === 'MINTED') {
        entry.tokenId = String(1000 + (entry.shelfIndex ?? 0) + 1);
        entry.txHash = `0x${entryId.replace(/-/g, '').padEnd(64, '0').slice(0, 64)}`;
      }
    }, step.afterMs).unref?.();
  }
}
