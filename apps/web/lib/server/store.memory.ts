import { randomUUID } from 'node:crypto';

import type { AdminEntry, AdminStateResponse } from '@/lib/api/adminTypes';
import { MAX_ENTRIES, type Entry, type EntryStatus, type ShowState, type StateResponse } from '@/lib/api/types';

import {
  clearPhotos,
  clearStoredPhotos,
  deleteStoredPhotos,
  getPhoto as readPhoto,
  photoUrl,
  putPhoto,
  type Photo,
} from './storage';
import {
  ABANDONED_JOIN_MS,
  STUCK_MS,
  SWEPT_REASON,
  type AttachResult,
  type NicknameUpdateResult,
  type RehearsalCleanupResult,
  type ResetResult,
} from './store.shared';

/**
 * `DATABASE_URL`이 없을 때 쓰는 인메모리 저장소. 고르는 곳은 `store.ts`다.
 *
 * 프로세스가 재시작되면 사라진다. 화면이 의존하는 것은 이 파일이 아니라
 * `lib/api/types.ts`의 계약이다.
 *
 * **모든 export가 Promise를 돌려준다.** 여기서는 기다릴 것이 없지만 `store.pg.ts`가
 * 같은 시그니처를 만족해야 라우트가 한 줄도 안 바뀐다. `db/schema.sql`이 이 파일이
 * 흉내내는 대상이다.
 */

/**
 * 카드 한 장. `entry`가 그대로 API로 나가는 부분이고 나머지는 절대 나가면 안 되는 부분이다.
 *
 * `db/schema.sql`이 participants와 entries를 나눈 것과 같은 이유로 여기서도 나눠 둔다 —
 * 실수로 행을 통째로 직렬화해도 DID와 지갑 주소가 딸려 나갈 수 없다.
 */
type Row = {
  entry: Entry;
  privyDid: string;
  walletAddress: string;
  /** 스위퍼가 "얼마나 오래 이 상태였나"를 보는 값. 상태를 바꿀 때마다 같이 갱신한다. */
  statusChangedAt: number;
  /** 자동 내림 시각 또는 운영자가 표시를 고정한 시각. null인 숨김은 운영자 판단이다. */
  autoHiddenAt: number | null;
  /** 목에서도 닉네임 수정 가능 여부를 실제 DB와 같은 기준으로 판단한다. */
  metadataCid: string | null;
};

type Store = {
  rows: Row[];
  show: ShowState;
};

const globalKey = Symbol.for('hot-bakery.mock-store');
const globalScope = globalThis as unknown as Record<symbol, Store | undefined>;

/** 개발 중 모듈이 다시 평가돼도 제출 내역이 사라지지 않게 전역에 고정한다. */
const store: Store = globalScope[globalKey] ?? (globalScope[globalKey] = {
  rows: [],
  show: { layout: 'LIVE', qrVisible: true, shelfPage: 0 },
});

/** 목 파이프라인의 단계별 소요 시간. 실제 백엔드에서는 각 단계의 완료가 이 자리를 대신한다. */
const PIPELINE: { status: EntryStatus; afterMs: number }[] = [
  { status: 'PINNED', afterMs: 3_200 },
  { status: 'MINTING', afterMs: 4_400 },
  { status: 'MINTED', afterMs: 7_600 },
];

const OVEN_STATUSES: EntryStatus[] = ['SUBMITTED', 'PINNED', 'MINTING'];

// ---------------------------------------------------------------------------
// 등록과 제출
// ---------------------------------------------------------------------------

/**
 * 로그인·닉네임 직후의 등록. 카드가 여기서 생기고 TV 작업대에 떨어진다.
 *
 * **`shelfIndex`를 여기서 배정하지 않는다.** 로그인만 하고 사라진 사람이 진열장 칸을
 * 영구히 점유해 격자에 구멍이 남는다. 배정은 사진 제출 때 한다.
 *
 * 같은 DID로 두 번 불러도 카드는 한 장이다(`created: false`). 참가자가 새로고침하거나
 * 다시 로그인해도 카드가 두 장 생기면 안 된다.
 */
export async function register(input: {
  privyDid: string;
  walletAddress: string;
  nickname: string;
}): Promise<{ entry: Entry; created: boolean }> {
  const existing = rowByDid(input.privyDid);
  if (existing) return { entry: existing.entry, created: false };

  const now = Date.now();
  const row: Row = {
    entry: {
      id: randomUUID(),
      nickname: input.nickname,
      status: 'JOINED',
      photoUrl: null,
      tokenId: null,
      txHash: null,
      shelfIndex: null,
      hidden: false,
      failureReason: null,
      submittedAt: new Date(now).toISOString(),
    },
    privyDid: input.privyDid,
    walletAddress: input.walletAddress.toLowerCase(),
    statusChangedAt: now,
    autoHiddenAt: null,
    metadataCid: null,
  };

  store.rows.push(row);
  return { entry: row.entry, created: true };
}

/**
 * 합성 증서를 붙여 JOINED 행을 SUBMITTED로 올린다. 카드가 오븐으로 들어간다.
 *
 * `operator`는 운영자 대리 업로드다. 참가자는 아직 사진이 없을 때만 낼 수 있지만,
 * 운영자는 **FAILED 행에도** 새 사진을 올릴 수 있다 — 사진 자체가 문제였던 실패는
 * 재시도로 풀리지 않고 새 사진을 받아야 한다.
 */
export async function attachPhoto(
  entryId: string,
  photo: Photo,
  options: { operator?: boolean } = {},
): Promise<AttachResult> {
  const row = store.rows.find((candidate) => candidate.entry.id === entryId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };

  const retakeable = options.operator && row.entry.status === 'FAILED';
  if (row.entry.photoUrl !== null && !retakeable) {
    return { ok: false, code: 'ALREADY_SUBMITTED' };
  }

  // 재촬영은 이미 잡아 둔 칸을 그대로 쓴다. 정원을 새로 갉아먹지 않는다.
  if (row.entry.shelfIndex === null) {
    if (await isFull()) return { ok: false, code: 'SHOWCASE_FULL' };
    row.entry.shelfIndex = nextShelfIndex();
  }

  row.entry.photoUrl = photoUrl(await putPhoto(row.entry.id, photo));
  // 스위퍼가 이탈자로 판단해 내린 카드만 되살린다. 운영자가 직접 숨긴 카드는 유지한다.
  if (row.entry.status === 'JOINED' && row.entry.hidden && row.autoHiddenAt !== null) {
    row.entry.hidden = false;
  }
  // 이전 사진의 CID로 민팅되지 않게, 재촬영이면 진행 흔적을 지우고 처음부터 다시 굽는다.
  row.entry.failureReason = null;
  row.entry.tokenId = null;
  row.entry.txHash = null;
  row.metadataCid = null;
  moveTo(row, 'SUBMITTED');

  schedulePipeline(row.entry.id);
  return { ok: true, entry: row.entry };
}

/**
 * 다음 진열장 칸. `db/schema.sql`의 `next_shelf_index()`처럼 `max + 1`을 센다.
 *
 * 시퀀스를 쓰지 않는 이유와 같다 — 제출이 튕겨도 번호가 소모되지 않아야 칸이 촘촘하다.
 */
function nextShelfIndex(): number {
  const used = store.rows
    .map((row) => row.entry.shelfIndex)
    .filter((index): index is number => index !== null);
  return used.length === 0 ? 0 : Math.max(...used) + 1;
}

/**
 * 정원은 **칸을 잡은 카드**로만 센다. 로그인만 하고 사라진 사람이 정원을 갉아먹으면
 * 실제로 사진을 낸 사람이 진열장에 못 들어간다.
 */
export async function isFull(): Promise<boolean> {
  return submittedCount() >= MAX_ENTRIES;
}

function submittedCount(): number {
  return store.rows.filter((row) => row.entry.shelfIndex !== null).length;
}

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

export async function findEntryByDid(privyDid: string): Promise<Entry | null> {
  return rowByDid(privyDid)?.entry ?? null;
}

export async function findEntryById(entryId: string): Promise<Entry | null> {
  return store.rows.find((row) => row.entry.id === entryId)?.entry ?? null;
}

export async function getPhoto(entryId: string): Promise<Photo | null> {
  return readPhoto(entryId);
}

function rowByDid(privyDid: string): Row | undefined {
  return store.rows.find((row) => row.privyDid === privyDid);
}

/**
 * 공개 `GET /api/state`가 쓰는 응답. **인증 없이 TV에서 열린다.**
 *
 * 필드를 하나씩 적어서 만든다. `...entry`로 펼치면 나중에 `Entry`에 필드가 하나 늘 때
 * 아무도 모르게 같이 새어 나간다. `failureReason`은 운영자 전용이라 여기서는 늘 null이다.
 */
export async function getState(): Promise<StateResponse> {
  const rows = [...store.rows].sort(byShelfThenJoin);
  return {
    entries: rows.map((row) => ({
      id: row.entry.id,
      nickname: row.entry.nickname,
      status: row.entry.status,
      photoUrl: row.entry.photoUrl,
      tokenId: row.entry.tokenId,
      txHash: row.entry.txHash,
      shelfIndex: row.entry.shelfIndex,
      hidden: row.entry.hidden,
      failureReason: null,
      submittedAt: row.entry.submittedAt,
    })),
    show: store.show,
    counts: counts(),
  };
}

/**
 * 운영자 명단. **인증된 운영자만 본다.**
 *
 * `hidden`인 카드도 그대로 내려보낸다. TV에서만 감춘 것이고, 나중에 그 참가자가 사진을
 * 가져오면 다시 올려야 한다.
 */
export async function getAdminState(): Promise<Omit<AdminStateResponse, 'minter' | 'chain'>> {
  const rows = [...store.rows].sort((a, b) => a.entry.submittedAt.localeCompare(b.entry.submittedAt));
  return {
    entries: rows.map(
      (row): AdminEntry => ({
        ...row.entry,
        walletAddress: row.walletAddress,
        autoHidden: row.entry.hidden && row.autoHiddenAt !== null,
        nicknameEditable: row.metadataCid === null,
        statusChangedAt: new Date(row.statusChangedAt).toISOString(),
      }),
    ),
    show: store.show,
    counts: counts(),
    capabilities: {
      resetDatabase: process.env.ALLOW_DB_RESET === '1',
      mockServer: true,
    },
  };
}

function counts() {
  return {
    submitted: submittedCount(),
    minted: store.rows.filter((row) => row.entry.status === 'MINTED').length,
  };
}

/** 칸을 잡은 카드가 먼저, 아직 사진이 없는 카드는 뒤로. 같은 조건이면 등록 순서다. */
function byShelfThenJoin(a: Row, b: Row): number {
  const left = a.entry.shelfIndex;
  const right = b.entry.shelfIndex;
  if (left !== null && right !== null) return left - right;
  if (left !== null) return -1;
  if (right !== null) return 1;
  return a.entry.submittedAt.localeCompare(b.entry.submittedAt);
}

// ---------------------------------------------------------------------------
// 운영자 조작
// ---------------------------------------------------------------------------

export async function updateShow(patch: Partial<ShowState>): Promise<ShowState> {
  store.show = { ...store.show, ...patch };
  return store.show;
}

/**
 * 운영자가 카드를 내리거나 다시 올린다.
 *
 * 운영자가 내리면 현재 숨김 원인을 운영자로 바꾸고, 올리면 자동 내림 대상에서
 * 제외한다. 그래야 늦게 온 참가자에 대한 운영자 판단을 스위퍼가 뒤집지 않는다.
 */
export async function setHidden(entryId: string, hidden: boolean): Promise<Entry | null> {
  const row = store.rows.find((candidate) => candidate.entry.id === entryId);
  if (!row) return null;
  row.entry.hidden = hidden;
  row.autoHiddenAt = hidden ? null : (row.autoHiddenAt ?? Date.now());
  return row.entry;
}

export async function updateNickname(
  entryId: string,
  nickname: string,
): Promise<NicknameUpdateResult> {
  const row = store.rows.find((candidate) => candidate.entry.id === entryId);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (row.metadataCid !== null) return { ok: false, code: 'ALREADY_SUBMITTED' };
  row.entry.nickname = nickname;
  return { ok: true, entry: row.entry };
}

export async function retryEntry(entryId: string): Promise<Entry | null> {
  const row = store.rows.find((candidate) => candidate.entry.id === entryId);
  if (!row || row.entry.status !== 'FAILED') return null;
  row.entry.failureReason = null;
  moveTo(row, 'SUBMITTED');
  schedulePipeline(entryId);
  return row.entry;
}

// ---------------------------------------------------------------------------
// 스위퍼
// ---------------------------------------------------------------------------

/**
 * 방치된 행을 훑는다. `db/README.md`의 스위퍼 쿼리 두 개를 그대로 옮긴 것이다.
 *
 * **타이머가 아니라 그냥 함수다.** 서버리스에서는 프로세스가 살아 있지 않아 타이머가
 * 돌지 않는다. 실제 배포에서는 Supabase Cron이 1분마다 이걸 부르는 라우트를 두드린다.
 * 함수로 두면 테스트에서 그냥 부를 수 있다.
 *
 * `now`를 받는 것은 시간을 흉내내기 위해서다 — 테스트가 10분을 실제로 기다릴 수 없다.
 */
export async function sweep(now: number = Date.now()): Promise<{ failed: number; hidden: number }> {
  let failed = 0;
  let hidden = 0;

  for (const row of store.rows) {
    // ① 오븐에서 멈춘 행 → FAILED. after()는 재시도를 해주지 않아서, 인보케이션이 죽으면
    //    행이 중간 상태로 남고 그대로 두면 영원히 오븐에 있는 카드가 생긴다.
    //
    //    TODO(체인): MINTING을 내리기 전에 CertificateIssued를 먼저 조회해야 한다.
    //    트랜잭션은 성공했는데 DB 갱신 전에 죽은 건을 FAILED로 내리면 이미 발행된 증서를
    //    잃어버린다. 목에는 체인이 없어 여기서는 그냥 내린다. (PIPELINE.md 「이미 발행된 건의 복구」)
    if (OVEN_STATUSES.includes(row.entry.status) && now - row.statusChangedAt >= STUCK_MS) {
      row.entry.failureReason = SWEPT_REASON;
      moveTo(row, 'FAILED', now);
      failed += 1;
      continue;
    }

    // ② 방치된 JOINED → hidden. 로그인만 하고 사라진 사람의 카드가 행사 내내 작업대에 남는다.
    //    `autoHiddenAt`이 null인 행만 건드린다 — 한 번 내린 카드를 운영자가 다시 올렸으면
    //    그건 운영자의 판단이고, 스위퍼가 10분 뒤에 뒤집으면 안 된다.
    if (
      row.entry.status === 'JOINED' &&
      !row.entry.hidden &&
      row.autoHiddenAt === null &&
      now - row.statusChangedAt >= ABANDONED_JOIN_MS
    ) {
      row.entry.hidden = true;
      row.autoHiddenAt = now;
      hidden += 1;
    }
  }

  return { failed, hidden };
}

// ---------------------------------------------------------------------------
// 목 파이프라인
// ---------------------------------------------------------------------------

function moveTo(row: Row, status: EntryStatus, now: number = Date.now()) {
  row.entry.status = status;
  row.statusChangedAt = now;
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
      const row = store.rows.find((candidate) => candidate.entry.id === entryId);
      if (!row || row.entry.status === 'FAILED') return;

      if (rate > 0 && Math.random() < rate) {
        row.entry.failureReason = `${step.status} 단계에서 실패 (목 서버 주입)`;
        moveTo(row, 'FAILED');
        return;
      }

      moveTo(row, step.status);
      if (step.status === 'PINNED') row.metadataCid = `bafy-mock-metadata-${entryId}`;
      if (step.status === 'MINTED') {
        row.entry.tokenId = String(1000 + (row.entry.shelfIndex ?? 0) + 1);
        row.entry.txHash = `0x${entryId.replace(/-/g, '').padEnd(64, '0').slice(0, 64)}`;
      }
    }, step.afterMs).unref?.();
  }
}

/** 테스트 전용. 저장소를 비운다. 전역에 붙어 있어 테스트끼리 상태가 새기 때문이다. */
export async function resetStore(): Promise<void> {
  store.rows.length = 0;
  clearPhotos();
  store.show = { layout: 'LIVE', qrVisible: true, shelfPage: 0 };
}

/** 운영자 화면의 개발용 초기화. DB 행뿐 아니라 저장된 증서 이미지도 함께 지운다. */
export async function resetAdminData(): Promise<ResetResult> {
  if (process.env.ALLOW_DB_RESET !== '1') {
    throw new Error('resetAdminData()는 ALLOW_DB_RESET=1일 때만 부를 수 있다.');
  }
  const entries = store.rows.length;
  const participants = new Set(store.rows.map((row) => row.privyDid)).size;
  // 원격 Storage를 명시해 둔 개발 환경에서는 삭제 실패 시 명단을 보존한다.
  await clearStoredPhotos();
  store.rows.length = 0;
  store.show = { layout: 'LIVE', qrVisible: true, shelfPage: 0 };
  return { deleted: { participants, entries } };
}

/** 현재 리허설 실행이 만든 행만 지운다. 일반 참가자 DID는 호출자가 ID를 알아도 대상이 아니다. */
export async function deleteRehearsalRun(runId: string): Promise<RehearsalCleanupResult> {
  const prefix = `did:privy:rehearsal-${runId}-`;
  const targets = store.rows.filter((row) => row.privyDid.startsWith(prefix));
  if (targets.length === 0) return { ok: false, code: 'NOT_FOUND' };
  if (targets.some((row) => ['SUBMITTED', 'PINNED', 'MINTING'].includes(row.entry.status))) {
    return { ok: false, code: 'NOT_READY' };
  }

  const targetIds = new Set(targets.map((row) => row.entry.id));
  const occupiedIndexes = targets
    .map((row) => row.entry.shelfIndex)
    .filter((index): index is number => index !== null);
  const firstTargetIndex = occupiedIndexes.length > 0 ? Math.min(...occupiedIndexes) : null;
  if (
    firstTargetIndex !== null
    && store.rows.some((row) => (
      !targetIds.has(row.entry.id)
      && row.entry.shelfIndex !== null
      && row.entry.shelfIndex >= firstTargetIndex
    ))
  ) {
    return { ok: false, code: 'NOT_READY' };
  }

  const photoPaths = targets
    .filter((row) => row.entry.photoUrl !== null)
    .map((row) => row.entry.id);
  const photos = await deleteStoredPhotos(photoPaths);
  store.rows = store.rows.filter((row) => !targetIds.has(row.entry.id));
  return {
    ok: true,
    deleted: {
      participants: new Set(targets.map((row) => row.privyDid)).size,
      entries: targets.length,
      photos,
    },
  };
}
