import type { DatabaseError } from 'pg';
import type { Address, Hex } from 'viem';

import type { AdminEntry, AdminStateResponse } from '@/lib/api/adminTypes';
import { MAX_ENTRIES, type Entry, type EntryStatus, type ShowState, type StateResponse } from '@/lib/api/types';

import { query, transaction } from './db';
import { clearPhotos, clearStoredPhotos, getPhoto as readPhoto, photoUrl, putPhoto, type Photo } from './storage';
import {
  ABANDONED_JOIN_MS,
  STUCK_MS,
  SWEPT_REASON,
  type AttachResult,
  type MintLockActions,
  type NicknameUpdateResult,
  type PipelineEntry,
  type ResetResult,
} from './store.shared';

/**
 * `DATABASE_URL`이 있을 때 쓰는 Postgres 저장소. 고르는 곳은 `store.ts`이고,
 * 시그니처의 정본은 `store.memory.ts`다.
 *
 * 쿼리는 `db/README.md`「자주 쓸 쿼리」를 그대로 옮긴 것이다. 스키마는 `db/schema.sql`이고
 * 여기서 만들지 않는다 — 마이그레이션 도구를 쓰지 않기로 했다.
 */

/**
 * 카드 한 장으로 나가는 컬럼. **`participants`를 조인하지 않는다.**
 *
 * 공개 `GET /api/state`가 이 목록만 보게 해서, 지갑 주소와 DID는 쿼리에 아예 없도록
 * 만든다(`db/schema.sql`「왜 테이블을 나눴나」).
 */
const ENTRY_COLUMNS = `
  id, nickname, status, shelf_index, certificate_path,
  token_id, tx_hash, hidden, failure_reason, created_at
`;

type EntryRow = {
  id: string;
  nickname: string;
  status: EntryStatus;
  shelf_index: number | null;
  certificate_path: string | null;
  token_id: string | null;
  tx_hash: string | null;
  hidden: boolean;
  failure_reason: string | null;
  created_at: Date;
};

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    nickname: row.nickname,
    status: row.status,
    photoUrl: photoUrl(row.certificate_path),
    tokenId: row.token_id,
    txHash: row.tx_hash,
    shelfIndex: row.shelf_index,
    hidden: row.hidden,
    failureReason: row.failure_reason,
    submittedAt: row.created_at.toISOString(),
  };
}

/**
 * 라우트는 URL에서 받은 문자열을 그대로 넘긴다. uuid가 아니면 Postgres가 `22P02`로
 * 던져서 404가 될 자리가 500이 된다. 여기서 먼저 걸러 NOT_FOUND로 보낸다.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// 등록과 제출
// ---------------------------------------------------------------------------

/**
 * `participants`와 `entries`를 한 트랜잭션에서 만든다. 같은 DID로 두 번 불러도 카드는
 * 한 장이다 — 두 unique 제약(`privy_did`, `participant_id`)이 `do nothing`으로 흡수한다.
 */
export async function register(input: {
  privyDid: string;
  walletAddress: string;
  nickname: string;
}): Promise<{ entry: Entry; created: boolean }> {
  return transaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `insert into participants (privy_did, wallet_address)
       values ($1, lower($2))
       on conflict (privy_did) do nothing
       returning id`,
      [input.privyDid, input.walletAddress],
    );
    const participantId =
      inserted.rows[0]?.id ??
      (
        await client.query<{ id: string }>(
          'select id from participants where privy_did = $1',
          [input.privyDid],
        )
      ).rows[0].id;

    const entry = await client.query<EntryRow>(
      `insert into entries (participant_id, nickname)
       values ($1, $2)
       on conflict (participant_id) do nothing
       returning ${ENTRY_COLUMNS}`,
      [participantId, input.nickname],
    );
    if (entry.rows[0]) return { entry: toEntry(entry.rows[0]), created: true };

    // 이미 카드가 있다. **닉네임을 덮어쓰지 않는다** — TV에 떠 있는 이름이 바뀐다.
    const existing = await client.query<EntryRow>(
      `select ${ENTRY_COLUMNS} from entries where participant_id = $1`,
      [participantId],
    );
    return { entry: toEntry(existing.rows[0]), created: false };
  });
}

/**
 * 합성 증서를 붙여 JOINED 행을 SUBMITTED로 올린다.
 *
 * **정원을 미리 세지 않는다.** 세고 나서 넣으면 그 사이에 다른 제출이 끼어들어 31번째가
 * 통과한다. `shelf_index < 30` 체크 제약이 튕기는 것을 SHOWCASE_FULL로 바꾼다.
 *
 * 업로드를 트랜잭션 안에서 한다. 밖에서 하면 ALREADY_SUBMITTED로 거절될 요청이 이미
 * 올라가 있는 증서를 덮어써서, DB가 가리키는 이미지가 참가자가 확인한 것과 달라진다.
 */
export async function attachPhoto(
  entryId: string,
  photo: Photo,
  options: { operator?: boolean } = {},
): Promise<AttachResult> {
  if (!UUID.test(entryId)) return { ok: false, code: 'NOT_FOUND' };

  try {
    return await transaction(async (client): Promise<AttachResult> => {
      const found = await client.query<{
        status: EntryStatus;
        certificate_path: string | null;
        hidden: boolean;
        auto_hidden_at: Date | null;
      }>(
        'select status, certificate_path, hidden, auto_hidden_at from entries where id = $1 for update',
        [entryId],
      );
      const row = found.rows[0];
      if (!row) return { ok: false, code: 'NOT_FOUND' };

      // 운영자는 FAILED 행에도 새 사진을 올릴 수 있다 — 사진 자체가 문제였던 실패는
      // 재시도로 풀리지 않는다.
      const retakeable = Boolean(options.operator) && row.status === 'FAILED';
      if (row.certificate_path !== null && !retakeable) {
        return { ok: false, code: 'ALREADY_SUBMITTED' };
      }

      const path = await putPhoto(entryId, photo);
      const restoreVisibility = row.status === 'JOINED' && row.hidden && row.auto_hidden_at !== null;

      // 재촬영은 이미 잡아 둔 칸을 그대로 쓴다(coalesce). 새 칸을 잡으면 진열장에 구멍이 남는다.
      // 이전 사진의 CID로 민팅되지 않게 진행 흔적은 지우고 처음부터 다시 굽는다.
      const updated = await client.query<EntryRow>(
        `update entries
            set status = 'SUBMITTED',
                certificate_path = $2,
                shelf_index = coalesce(shelf_index, next_shelf_index()),
                certificate_cid = null,
                metadata_cid = null,
                failure_reason = null,
                token_id = null,
                tx_hash = null,
                hidden = case when $3 then false else hidden end,
                status_changed_at = now()
          where id = $1
        returning ${ENTRY_COLUMNS}`,
        [entryId, path, restoreVisibility],
      );
      return { ok: true, entry: toEntry(updated.rows[0]) };
    });
  } catch (error) {
    if (isShowcaseFull(error)) return { ok: false, code: 'SHOWCASE_FULL' };
    throw error;
  }
}

/** `shelf_index >= 0 and < 30` 위반. 31번째 제출이 여기로 온다. */
function isShowcaseFull(error: unknown): boolean {
  const failure = error as DatabaseError;
  return failure?.code === '23514' && failure?.constraint === 'entries_shelf_index_check';
}

/**
 * 정원은 **칸을 잡은 카드**로만 센다. 로그인만 하고 사라진 사람이 정원을 갉아먹으면
 * 실제로 사진을 낸 사람이 진열장에 못 들어간다.
 */
export async function isFull(): Promise<boolean> {
  const result = await query<{ taken: string }>(
    'select count(*) as taken from entries where shelf_index is not null',
  );
  return Number(result.rows[0].taken) >= MAX_ENTRIES;
}

// ---------------------------------------------------------------------------
// 조회
// ---------------------------------------------------------------------------

export async function findEntryByDid(privyDid: string): Promise<Entry | null> {
  const result = await query<EntryRow>(
    `select ${ENTRY_COLUMNS}
       from entries
      where participant_id = (select id from participants where privy_did = $1)`,
    [privyDid],
  );
  return result.rows[0] ? toEntry(result.rows[0]) : null;
}

export async function findEntryById(entryId: string): Promise<Entry | null> {
  if (!UUID.test(entryId)) return null;
  const result = await query<EntryRow>(
    `select ${ENTRY_COLUMNS} from entries where id = $1`,
    [entryId],
  );
  return result.rows[0] ? toEntry(result.rows[0]) : null;
}

/**
 * Supabase Storage를 쓰는 배포에서는 항상 null이다. 그때 `photoUrl`은 공개 URL이라
 * `GET /api/photos/{id}`가 경로에 없다.
 */
export async function getPhoto(entryId: string): Promise<Photo | null> {
  return readPhoto(entryId);
}

/**
 * 공개 `GET /api/state`가 쓰는 응답. **인증 없이 TV에서 열린다.**
 *
 * 쿼리가 `entries`만 본다. 지갑 주소와 DID는 다른 테이블에 있어서 셀 수가 없고,
 * `failureReason`은 운영자 전용이라 여기서 늘 null이다.
 */
export async function getState(): Promise<StateResponse> {
  const [entries, show] = await Promise.all([
    query<EntryRow>(
      `select ${ENTRY_COLUMNS} from entries order by shelf_index nulls last, created_at`,
    ),
    getShow(),
  ]);

  return {
    entries: entries.rows.map((row) => ({
      id: row.id,
      nickname: row.nickname,
      status: row.status,
      photoUrl: photoUrl(row.certificate_path),
      tokenId: row.token_id,
      txHash: row.tx_hash,
      shelfIndex: row.shelf_index,
      hidden: row.hidden,
      failureReason: null,
      submittedAt: row.created_at.toISOString(),
    })),
    show,
    counts: counts(entries.rows),
  };
}

/**
 * 운영자 명단. **인증된 운영자만 본다.**
 *
 * `hidden`인 카드도 그대로 내려보낸다. TV에서만 감춘 것이고, 나중에 그 참가자가 사진을
 * 가져오면 다시 올려야 한다.
 */
/** 민터 잔액은 체인 조회라 라우트에서 얹는다. 저장소는 DB만 본다. */
export async function getAdminState(): Promise<Omit<AdminStateResponse, 'minter' | 'chain'>> {
  const [rows, show] = await Promise.all([
    query<EntryRow & {
      auto_hidden_at: Date | null;
      wallet_address: string;
      metadata_cid: string | null;
      status_changed_at: Date;
    }>(
      `select e.id, e.nickname, e.status, e.shelf_index, e.certificate_path,
              e.token_id, e.tx_hash, e.hidden, e.failure_reason, e.created_at,
              e.auto_hidden_at, e.metadata_cid, e.status_changed_at, p.wallet_address
         from entries e
         join participants p on p.id = e.participant_id
        order by e.created_at`,
    ),
    getShow(),
  ]);

  return {
    entries: rows.rows.map(
      (row): AdminEntry => ({
        ...toEntry(row),
        walletAddress: row.wallet_address,
        autoHidden: row.hidden && row.auto_hidden_at !== null,
        nicknameEditable: row.metadata_cid === null,
        statusChangedAt: row.status_changed_at.toISOString(),
      }),
    ),
    show,
    counts: counts(rows.rows),
    capabilities: {
      resetDatabase: process.env.ALLOW_DB_RESET === '1',
      mockServer: false,
    },
  };
}

function counts(rows: EntryRow[]) {
  return {
    submitted: rows.filter((row) => row.shelf_index !== null).length,
    minted: rows.filter((row) => row.status === 'MINTED').length,
  };
}

// ---------------------------------------------------------------------------
// 화면 상태와 운영자 조작
// ---------------------------------------------------------------------------

/**
 * 화면 상태는 행 하나다(`show_state.id` bool PK). 스키마가 그 행을 미리 넣어 두지만,
 * 없더라도 화면이 죽지 않게 기본값으로 돌려준다.
 */
async function getShow(): Promise<ShowState> {
  const result = await query<{ layout: ShowState['layout']; qr_visible: boolean; shelf_page: number }>(
    'select layout, qr_visible, shelf_page from show_state where id = true',
  );
  const row = result.rows[0];
  if (!row) return { layout: 'LIVE', qrVisible: true, shelfPage: 0 };
  return { layout: row.layout, qrVisible: row.qr_visible, shelfPage: row.shelf_page };
}

export async function updateShow(patch: Partial<ShowState>): Promise<ShowState> {
  const result = await query<{ layout: ShowState['layout']; qr_visible: boolean; shelf_page: number }>(
    `insert into show_state (id, layout, qr_visible, shelf_page, updated_at)
     values (true, coalesce($1, 'LIVE'), coalesce($2, true), coalesce($3, 0), now())
     on conflict (id) do update
        set layout = coalesce($1, show_state.layout),
            qr_visible = coalesce($2, show_state.qr_visible),
            shelf_page = coalesce($3, show_state.shelf_page),
            updated_at = now()
     returning layout, qr_visible, shelf_page`,
    [patch.layout ?? null, patch.qrVisible ?? null, patch.shelfPage ?? null],
  );
  const row = result.rows[0];
  return { layout: row.layout, qrVisible: row.qr_visible, shelfPage: row.shelf_page };
}

/**
 * 운영자가 카드를 내리거나 다시 올린다.
 *
 * 운영자가 내리면 현재 숨김 원인을 운영자로 바꾸고, 올리면 자동 내림 대상에서
 * 제외한다. 그래야 늦게 온 참가자에 대한 운영자 판단을 스위퍼가 뒤집지 않는다.
 */
export async function setHidden(entryId: string, hidden: boolean): Promise<Entry | null> {
  if (!UUID.test(entryId)) return null;
  const result = await query<EntryRow>(
    `update entries
        set hidden = $2,
            auto_hidden_at = case
              when $2 then null
              else coalesce(auto_hidden_at, now())
            end
      where id = $1
    returning ${ENTRY_COLUMNS}`,
    [entryId, hidden],
  );
  return result.rows[0] ? toEntry(result.rows[0]) : null;
}

export async function updateNickname(
  entryId: string,
  nickname: string,
): Promise<NicknameUpdateResult> {
  if (!UUID.test(entryId)) return { ok: false, code: 'NOT_FOUND' };

  const updated = await query<EntryRow>(
    `update entries
        set nickname = $2
      where id = $1 and metadata_cid is null
    returning ${ENTRY_COLUMNS}`,
    [entryId, nickname],
  );
  if (updated.rows[0]) return { ok: true, entry: toEntry(updated.rows[0]) };

  const found = await query<{ metadata_cid: string | null }>(
    'select metadata_cid from entries where id = $1',
    [entryId],
  );
  return found.rows[0]
    ? { ok: false, code: 'ALREADY_SUBMITTED' }
    : { ok: false, code: 'NOT_FOUND' };
}

export async function retryEntry(entryId: string): Promise<Entry | null> {
  if (!UUID.test(entryId)) return null;
  const result = await query<EntryRow>(
    `update entries
        set status = case
              when tx_hash is not null then 'MINTING'::entry_status
              when metadata_cid is not null then 'PINNED'::entry_status
              else 'SUBMITTED'::entry_status
            end,
            failure_reason = null,
            -- tx_hash가 있으면 새 전송이 아니라 기존 거래 확인 재개다. 최초 전송 시각을 지킨다.
            status_changed_at = case when tx_hash is not null then status_changed_at else now() end
      where id = $1 and status = 'FAILED'
    returning ${ENTRY_COLUMNS}`,
    [entryId],
  );
  return result.rows[0] ? toEntry(result.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// 프로덕션 발행 파이프라인
// ---------------------------------------------------------------------------

type PipelineRow = {
  id: string;
  nickname: string;
  status: EntryStatus;
  wallet_address: string;
  certificate_path: string;
  certificate_cid: string | null;
  metadata_cid: string | null;
  tx_hash: string | null;
  token_id: string | null;
  created_at: Date;
  status_changed_at: Date;
};

const PIPELINE_COLUMNS = `
  e.id, e.nickname, e.status, p.wallet_address, e.certificate_path,
  e.certificate_cid, e.metadata_cid, e.tx_hash, e.token_id,
  e.created_at, e.status_changed_at
`;

function toPipelineEntry(row: PipelineRow): PipelineEntry {
  return {
    id: row.id,
    nickname: row.nickname,
    status: row.status,
    walletAddress: row.wallet_address as Address,
    certificatePath: row.certificate_path,
    certificateCid: row.certificate_cid,
    metadataCid: row.metadata_cid,
    txHash: row.tx_hash as Hex | null,
    tokenId: row.token_id,
    submittedAt: row.created_at,
    statusChangedAt: row.status_changed_at,
  };
}

export async function getPipelineEntry(entryId: string): Promise<PipelineEntry | null> {
  if (!UUID.test(entryId)) return null;
  const result = await query<PipelineRow>(
    `select ${PIPELINE_COLUMNS}
       from entries e
       join participants p on p.id = e.participant_id
      where e.id = $1 and e.certificate_path is not null`,
    [entryId],
  );
  return result.rows[0] ? toPipelineEntry(result.rows[0]) : null;
}

export async function saveCertificateCid(
  entryId: string,
  cid: string,
  expectedPath?: string,
): Promise<boolean> {
  const result = await query(
    `update entries
        set certificate_cid = $2,
            status_changed_at = now()
      where id = $1
        and status <> 'MINTED'
        and certificate_cid is null
        and ($3::text is null or certificate_path = $3)`,
    [entryId, cid, expectedPath ?? null],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function saveMetadataCid(entryId: string, cid: string): Promise<void> {
  await query(
    `update entries
        set metadata_cid = coalesce(metadata_cid, $2),
            status = 'PINNED',
            failure_reason = null,
            status_changed_at = now()
      where id = $1 and status <> 'MINTED'`,
    [entryId, cid],
  );
}

/**
 * 메타데이터에 들어갈 닉네임을 읽는 순간부터 CID를 저장할 때까지 행을 잠근다.
 *
 * 이 잠금이 없으면 Pinata 요청 중 운영자가 닉네임을 바꿀 수 있다. 그러면 DB/TV는
 * 새 닉네임인데 영구 메타데이터와 NFT에는 이전 닉네임이 남는다. 닉네임 수정 쿼리는
 * 같은 행 잠금이 풀린 뒤 `metadata_cid is null`을 다시 평가하므로 409로 끝난다.
 */
export async function pinMetadata(
  entryId: string,
  expectedPath: string,
  pin: (entry: PipelineEntry) => Promise<string>,
): Promise<PipelineEntry | null> {
  if (!UUID.test(entryId)) return null;
  return transaction(async (client) => {
    const found = await client.query<PipelineRow>(
      `select ${PIPELINE_COLUMNS}
         from entries e
         join participants p on p.id = e.participant_id
        where e.id = $1 and e.certificate_path = $2
        for update of e`,
      [entryId, expectedPath],
    );
    const row = found.rows[0];
    if (!row) return null;
    if (row.metadata_cid !== null || row.status === 'MINTED') return toPipelineEntry(row);
    if (!row.certificate_cid) throw new Error('증서 이미지 CID가 없습니다.');

    const cid = await pin(toPipelineEntry(row));
    const updated = await client.query(
      `update entries e
          set metadata_cid = $2,
              status = 'PINNED',
              failure_reason = null,
              status_changed_at = now()
        where e.id = $1 and e.certificate_path = $3 and e.metadata_cid is null
      `,
      [entryId, cid, expectedPath],
    );
    if (updated.rowCount !== 1) return null;
    return toPipelineEntry({
      ...row,
      metadata_cid: cid,
      status: 'PINNED',
      status_changed_at: new Date(),
    });
  });
}

export async function saveMinted(entryId: string, tokenId: string, txHash: Hex): Promise<void> {
  await query(
    `update entries
        set status = 'MINTED', token_id = $2, tx_hash = $3,
            failure_reason = null, status_changed_at = now()
      where id = $1 and status <> 'MINTED'`,
    [entryId, tokenId, txHash],
  );
}

export async function markPipelineFailed(
  entryId: string,
  reason: string,
  options: { discardTxHash?: boolean } = {},
): Promise<void> {
  await query(
    `update entries
        set status = 'FAILED',
            failure_reason = $2,
            tx_hash = case when $3 then null else tx_hash end,
            -- 살아 있을 수 있는 tx_hash를 보존하면 최초 전송 시각도 함께 보존한다.
            status_changed_at = case
              when tx_hash is not null and not $3 then status_changed_at
              else now()
            end
      where id = $1 and status <> 'MINTED' and certificate_path is not null`,
    [entryId, reason.slice(0, 1_000), options.discardTxHash === true],
  );
}

/**
 * 민팅 차례를 기다리는 동안 **커넥션을 쥐고 있지 않는다.**
 *
 * 예전에는 커넥션을 먼저 잡은 뒤 `pg_advisory_xact_lock`으로 블로킹 대기를 했다. 민팅은
 * 어차피 한 번에 하나씩이라, 뒤에 밀린 사람들이 자기 차례를 기다리며 풀(`max: 3`)을 통째로
 * 점거했다. 그러면 민팅과 아무 상관없는 질의 — 사진 CID 저장, 실패 기록, 운영자 화면 조회 —
 * 까지 커넥션을 못 얻어 10초 뒤 `timeout exceeded when trying to connect`으로 죽는다.
 *
 * 20명이 동시에 내면 대기로만 `1.5초 x (0+1+...+19)` = 약 285 커넥션·초를 요구하는데,
 * 커넥션 3개로는 감당이 안 된다. 실측에서 20명 중 5명이 이 이유로 실패했다.
 *
 * 그래서 `try` 잠금으로 바꾼다. 차례가 아니면 트랜잭션을 끝내 커넥션을 돌려주고 잠깐 쉰다.
 * **대기에 쓰는 커넥션이 0이 된다.** 민팅 자체는 여전히 한 번에 하나씩이다.
 */
/** 차례를 못 잡고 이만큼 지나면 포기한다. 라우트가 `maxDuration = 60`이라 그 안에 끝내고
 *  실패를 기록할 여유를 남긴다. 포기한 건은 FAILED가 되어 운영자가 다시 시도로 푼다. */
const MINT_LOCK_WAIT_MS = 20_000;
/** 다시 시도하기 전 쉬는 시간. 여러 명이 같은 순간에 깨어나 풀을 두드리지 않게 흔들어 준다. */
const MINT_LOCK_RETRY_MS = 400;
const MINT_LOCK_JITTER_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withMintLock<T>(
  entryId: string,
  run: (entry: PipelineEntry, actions: MintLockActions) => Promise<T>,
): Promise<T | null> {
  if (!UUID.test(entryId)) return null;

  const deadline = Date.now() + MINT_LOCK_WAIT_MS;
  for (;;) {
    if (Date.now() >= deadline) throw new Error('민팅 차례를 기다리다 시간이 지났습니다.');
    const attempt = await mintLockAttempt(entryId, deadline, run);
    if (attempt.ran) return attempt.value;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('민팅 차례를 기다리다 시간이 지났습니다.');
    await sleep(Math.min(
      MINT_LOCK_RETRY_MS + Math.random() * MINT_LOCK_JITTER_MS,
      remaining,
    ));
  }
}

/** 차례를 잡았으면 `ran: true`. 못 잡았으면 아무것도 하지 않고 커넥션을 돌려준다. */
async function mintLockAttempt<T>(
  entryId: string,
  deadline: number,
  run: (entry: PipelineEntry, actions: MintLockActions) => Promise<T>,
): Promise<{ ran: false } | { ran: true; value: T | null }> {
  return transaction(async (client) => {
    const lock = await client.query<{ acquired: boolean }>(
      `select pg_try_advisory_xact_lock(hashtext('hot-bakery-mint')) as acquired`,
    );
    if (!lock.rows[0]?.acquired) return { ran: false };
    if (Date.now() >= deadline) return { ran: false };

    const found = await client.query<PipelineRow>(
      `select ${PIPELINE_COLUMNS}
         from entries e
         join participants p on p.id = e.participant_id
        where e.id = $1 and e.certificate_path is not null
        for update of e`,
      [entryId],
    );
    const row = found.rows[0];
    if (!row) return { ran: true, value: null };
    if (Date.now() >= deadline) return { ran: false };

    const actions: MintLockActions = {
      async setMinting(txHash) {
        await client.query(
          `update entries
              set status = 'MINTING', tx_hash = $2,
                  failure_reason = null, status_changed_at = now()
            where id = $1`,
          [entryId, txHash],
        );
      },
      async setMinted(tokenId, txHash) {
        await client.query(
          `update entries
              set status = 'MINTED', token_id = $2, tx_hash = $3,
                  failure_reason = null, status_changed_at = now()
            where id = $1`,
          [entryId, tokenId, txHash],
        );
      },
    };
    return { ran: true, value: await run(toPipelineEntry(row), actions) };
  });
}

export async function findStaleMinting(now: number = Date.now()): Promise<PipelineEntry[]> {
  const result = await query<PipelineRow>(
    `select ${PIPELINE_COLUMNS}
       from entries e
       join participants p on p.id = e.participant_id
      where e.status = 'MINTING' and e.status_changed_at < $1
      order by e.status_changed_at`,
    [new Date(now - STUCK_MS)],
  );
  return result.rows.map(toPipelineEntry);
}

/** cron과 운영자 수동 스위프 중 하나만 실행한다. 이미 실행 중이면 null이다. */
export async function withSweepLock<T>(run: () => Promise<T>): Promise<T | null> {
  return transaction(async (client) => {
    const result = await client.query<{ acquired: boolean }>(
      `select pg_try_advisory_xact_lock(hashtext('hot-bakery-sweep')) as acquired`,
    );
    if (!result.rows[0]?.acquired) return null;
    return run();
  });
}

// ---------------------------------------------------------------------------
// 스위퍼
// ---------------------------------------------------------------------------

/**
 * 방치된 행을 훑는다. `db/README.md`의 스위퍼 쿼리 두 개다.
 *
 * **타이머가 아니라 그냥 함수다.** 서버리스에서는 프로세스가 살아 있지 않다. Supabase
 * Cron이 1분마다 이걸 부르는 라우트를 두드린다.
 *
 * `now`는 기한을 계산할 때만 쓰고, 행에 찍는 시각은 DB의 `now()`다. 두 시계가 조금
 * 어긋나도 같은 트랜잭션 안에서 일관되게 하려는 것이다.
 */
export async function sweep(now: number = Date.now()): Promise<{ failed: number; hidden: number }> {
  // ① 오븐에서 멈춘 행 → FAILED. MINTING은 체인 조회가 필요한 탓에 pipeline.sweepPipeline()
  //    이 먼저 복구하거나 실패 처리한다. 여기서 무조건 내리면 이미 발행된 증서를 잃는다.
  //    행이 중간 상태로 남고 그대로 두면 영원히 오븐에 있는 카드가 생긴다.
  //
  const failed = await query(
    `update entries
        set status = 'FAILED',
            failure_reason = $2,
            status_changed_at = now()
      where status in ('SUBMITTED', 'PINNED')
        and status_changed_at < $1`,
    [new Date(now - STUCK_MS), SWEPT_REASON],
  );

  // ② 방치된 JOINED → hidden. `auto_hidden_at`이 null인 행만 건드린다 — 한 번 내린 카드를
  //    운영자가 다시 올렸으면 그건 운영자의 판단이고, 스위퍼가 10분 뒤에 뒤집으면 안 된다.
  const hidden = await query(
    `update entries
        set hidden = true,
            auto_hidden_at = now()
      where status = 'JOINED'
        and hidden = false
        and auto_hidden_at is null
        and status_changed_at < $1`,
    [new Date(now - ABANDONED_JOIN_MS)],
  );

  return { failed: failed.rowCount ?? 0, hidden: hidden.rowCount ?? 0 };
}

/**
 * 테스트 전용. **행사 테이블을 통째로 비운다.**
 *
 * 실수로 한 번 불리면 되돌릴 수 없어서 `ALLOW_DB_RESET=1`을 명시적으로 켠 프로세스에서만
 * 돈다. 행사 당일 실행 환경에는 그 변수가 없다.
 */
export async function resetStore(): Promise<void> {
  if (process.env.ALLOW_DB_RESET !== '1') {
    throw new Error('resetStore()는 실제 DB를 비운다. ALLOW_DB_RESET=1인 테스트에서만 부를 수 있다.');
  }
  // 한 번에 보낸다. 검사마다 부르는 자리라 왕복 한 번이 그대로 시간이 된다.
  await query(
    `truncate entries, participants;
     update show_state
        set layout = 'LIVE', qr_visible = true, shelf_page = 0, updated_at = now()
      where id = true;`,
  );
  clearPhotos();
}

/** 운영자 화면의 개발용 초기화. 저장된 증서 이미지까지 함께 지운다. */
export async function resetAdminData(): Promise<ResetResult> {
  if (process.env.ALLOW_DB_RESET !== '1') {
    throw new Error('resetAdminData()는 실제 DB를 비운다. ALLOW_DB_RESET=1일 때만 부를 수 있다.');
  }

  // Storage 삭제가 실패했는데 DB부터 비우면 어느 행에도 연결되지 않은 객체만 남고
  // 운영자는 무엇이 실패했는지 다시 확인할 수 없다. 외부 저장소를 먼저 지워 실패 시
  // DB를 보존하고, 성공한 뒤 짧은 DB 트랜잭션으로 마무리한다.
  await clearStoredPhotos();

  const deleted = await transaction(async (client) => {
    const counts = await client.query<{ participants: string; entries: string }>(
      `select (select count(*) from participants) as participants,
              (select count(*) from entries) as entries`,
    );
    await client.query(
      `truncate entries, participants;
       update show_state
          set layout = 'LIVE', qr_visible = true, shelf_page = 0, updated_at = now()
        where id = true;`,
    );
    return {
      participants: Number(counts.rows[0].participants),
      entries: Number(counts.rows[0].entries),
    };
  });
  return { deleted };
}
