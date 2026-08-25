import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import { loadEnvConfig } from '@next/env';

import { GET as getPublicState } from '@/app/api/state/route';
import { MAX_ENTRIES, type Entry, type StateResponse } from '@/lib/api/types';

import { closeDatabase, query } from './db';
import {
  attachPhoto,
  getAdminState,
  getState,
  register,
  resetStore,
  retryEntry,
  setHidden,
  sweep,
  updateNickname,
  updateShow,
  type Photo,
} from './store';
import {
  getPipelineEntry,
  pinMetadata,
  saveCertificateCid,
  saveMetadataCid,
  withMintLock,
  withSweepLock,
} from './store.pg';

/**
 * **실제 Supabase에 붙어서 도는 검사다.** `DATABASE_URL`이 없으면 통째로 건너뛴다 —
 * 프론트 담당자와 CI는 DB 없이 `npm test`를 돌린다.
 *
 * 환경변수는 Next가 쓰는 로더로 읽는다. `node --env-file`은 dotenv 확장을 하지 않아
 * 비밀번호의 `\$`가 그대로 남고, 증상이 "비밀번호 인증 실패"라 원인을 찾기 어렵다
 * (`db/README.md`의 경고). 여기서 그 함정에 한 번 빠졌다.
 *
 * `node --test`는 파일마다 프로세스를 따로 띄우므로, 여기서 켠 `DATABASE_URL`이
 * `store.test.ts`(메모리 검사)로 새지 않는다.
 */
loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });

/** 실제 테이블을 비우는 검사다. 실수로 행사 중에 도는 일이 없게 명시적으로 켠다. */
process.env.ALLOW_DB_RESET = '1';

const LIVE = Boolean(process.env.DATABASE_URL);

const PHOTO: Photo = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), contentType: 'image/jpeg' };
const RETAKE: Photo = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x01]), contentType: 'image/jpeg' };

function participant(n: number) {
  return {
    privyDid: `did:privy:pgtest-${n}`,
    walletAddress: `0xPGTEST${String(n).padStart(34, '0')}`,
    nickname: `참가자${n}`,
  };
}

/** 이 파일이 사진을 붙여 본 카드. 끝날 때 그 폴더를 지운다 — 버킷에 쓰레기를 남기지 않는다. */
const touched = new Set<string>();

async function submit(entryId: string, photo: Photo = PHOTO, options: { operator?: boolean } = {}) {
  touched.add(entryId);
  return attachPhoto(entryId, photo, options);
}

/** 스위퍼는 "얼마나 오래 이 상태였나"를 본다. 10분을 실제로 기다릴 수 없으니 행을 늙힌다. */
async function age(entryId: string, seconds: number) {
  await query(
    'update entries set status_changed_at = now() - make_interval(secs => $2::int) where id = $1',
    [entryId, seconds],
  );
}

async function joined(n: number): Promise<Entry> {
  return (await register(participant(n))).entry;
}

/**
 * 배경이 되는 행을 **한 문장으로** 넣는다.
 *
 * 한 줄씩 `register()`로 넣으면 도쿄까지 왕복이 행마다 한 번씩이라, 30명을 채우는 데만
 * 20초가 넘는다. 검사하려는 것은 배경이 아니라 경계이므로 배경은 SQL로 만든다.
 *
 * `did:privy:seed-*`라 실제 검사가 쓰는 `pgtest-*`와 섞이지 않고, `certificate_path`는
 * 진짜 이미지를 가리키지 않는다 — 아무도 그 URL을 열지 않는다.
 */
async function seedSubmitted(count: number): Promise<void> {
  await query(
    `with p as (
       insert into participants (privy_did, wallet_address)
       select 'did:privy:seed-' || i, '0xseed' || lpad(i::text, 34, '0')
         from generate_series(0, $1 - 1) i
       returning id, (regexp_replace(privy_did, '\\D', '', 'g'))::int as i
     )
     insert into entries (participant_id, nickname, status, shelf_index, certificate_path)
     select p.id, 'seed' || p.i, 'SUBMITTED', p.i, 'entries/seed/' || p.i || '.jpg' from p`,
    [count],
  );
}

/** 사진을 아직 안 낸 카드를 한 문장으로 넣고 id를 돌려준다. */
async function seedJoined(count: number): Promise<string[]> {
  const result = await query<{ id: string }>(
    `with p as (
       insert into participants (privy_did, wallet_address)
       select 'did:privy:queue-' || i, '0xqueue' || lpad(i::text, 33, '0')
         from generate_series(0, $1 - 1) i
       returning id, (regexp_replace(privy_did, '\\D', '', 'g'))::int as i
     )
     insert into entries (participant_id, nickname)
     select p.id, 'queue' || p.i from p
     returning id`,
    [count],
  );
  return result.rows.map((row) => row.id);
}

describe('Postgres 저장소 (실제 Supabase)', { skip: LIVE ? false : 'DATABASE_URL이 없다' }, () => {
  /**
   * **이 검사는 테이블을 비운다.** 행사 중에 누가 `npm test`를 돌리면 그 자리에서
   * 참가자 기록이 사라진다. 비어 있지 않은 DB는 아예 건드리지 않고 크게 실패한다 —
   * 조용히 건너뛰면 다음 사람이 같은 실수를 반복한다.
   */
  before(async () => {
    /**
     * DB가 하나뿐이라 이 파일을 두 사람이 동시에 돌리면 서로의 행을 지우고 서로의
     * 진열장 칸을 먹는다. 그러면 아무 문제 없는 코드가 실패한다. 락을 못 잡으면
     * 기다리지 않고 바로 크게 실패한다 — 원인을 모른 채 재현되는 것이 제일 나쁘다.
     * 세션 락이라 `closeDatabase()`로 연결이 닫히면 저절로 풀린다.
     */
    const lock = await query<{ locked: boolean }>('select pg_try_advisory_lock(920829) as locked');
    assert.equal(
      lock.rows[0].locked,
      true,
      '다른 DB 테스트 실행이 이미 돌고 있다. 그 실행이 끝난 뒤에 다시 돌려라.',
    );

    /**
     * **이 검사는 테이블을 비운다.** 행사 중에 누가 `npm test`를 돌리면 그 자리에서
     * 참가자 기록이 사라진다. 비어 있지 않은 DB는 아예 건드리지 않고 크게 실패한다 —
     * 조용히 건너뛰면 다음 사람이 같은 실수를 반복한다.
     */
    const existing = await query<{ rows: string }>(
      'select (select count(*) from entries) + (select count(*) from participants) as rows',
    );
    assert.equal(
      existing.rows[0].rows,
      '0',
      '테이블에 행이 있다. 행사 데이터일 수 있어 비우지 않는다. 비워도 되는 DB인지 확인하고 직접 지운 뒤 다시 돌려라.',
    );
  });

  beforeEach(() => resetStore());

  /**
   * **실패해도 반드시 치운다.** 남은 행 하나가 행사 당일 진열장 칸 하나를 먹는다.
   * 이미지 정리가 터져도 테이블은 비워야 하므로 finally로 감싼다.
   */
  after(async () => {
    try {
      await removeTestObjects();
    } finally {
      try {
        await resetStore();
      } finally {
        await closeDatabase();
      }
    }
  });

  test('같은 DID로 두 번 등록해도 카드는 한 장이다', async () => {
    const first = await register(participant(1));
    const second = await register({ ...participant(1), nickname: '다른닉네임' });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.entry.id, first.entry.id);
    // 이미 TV에 떠 있는 카드의 닉네임을 나중 요청이 덮어쓰지 않는다.
    assert.equal(second.entry.nickname, '참가자1');

    const admin = await getAdminState();
    assert.equal(admin.entries.length, 1);
    // 지갑 주소는 소문자로 정규화돼 들어간다(대소문자만 다른 주소로 증서 두 장 방지).
    assert.equal(admin.entries[0].walletAddress, participant(1).walletAddress.toLowerCase());
    assert.deepEqual(admin.capabilities, { resetDatabase: true, mockServer: false });
  });

  test('닉네임은 metadata_cid가 비어 있을 때만 수정한다', async () => {
    const entry = await joined(1);
    const renamed = await updateNickname(entry.id, '새이름');
    assert.ok(renamed.ok);
    assert.equal(renamed.entry.nickname, '새이름');
    assert.equal((await getAdminState()).entries[0].nicknameEditable, true);

    assert.ok((await submit(entry.id)).ok);
    await saveCertificateCid(entry.id, 'bafy-certificate');
    await saveMetadataCid(entry.id, 'bafy-metadata');

    assert.equal((await getAdminState()).entries[0].nicknameEditable, false);
    assert.deepEqual(await updateNickname(entry.id, '늦은수정'), {
      ok: false,
      code: 'ALREADY_SUBMITTED',
    });
    assert.deepEqual(await updateNickname('not-a-uuid', '없는사람'), {
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  test('메타데이터 핀 중 닉네임 수정은 행 잠금 뒤 409로 끝난다', async () => {
    const entry = await joined(1);
    assert.ok((await submit(entry.id)).ok);
    await saveCertificateCid(entry.id, 'bafy-certificate');
    const internal = await getPipelineEntry(entry.id);
    assert.ok(internal);

    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    let releasePin!: () => void;
    const release = new Promise<void>((resolve) => { releasePin = resolve; });

    const pinning = pinMetadata(entry.id, internal.certificatePath, async (locked) => {
      assert.equal(locked.nickname, '참가자1');
      signalStarted();
      await release;
      return 'bafy-locked-metadata';
    });
    await started;

    const renaming = updateNickname(entry.id, '경쟁수정');
    // UPDATE가 실제로 행 잠금을 기다리는 동안 핀을 완료한다.
    await new Promise((resolve) => setTimeout(resolve, 40));
    releasePin();

    assert.equal((await pinning)?.metadataCid, 'bafy-locked-metadata');
    assert.deepEqual(await renaming, { ok: false, code: 'ALREADY_SUBMITTED' });
    assert.equal((await getAdminState()).entries[0].nickname, '참가자1');
  });

  test('shelfIndex는 등록에서 null이고 사진 제출 때 배정된다', async () => {
    const entry = await joined(1);
    assert.equal(entry.shelfIndex, null);
    assert.equal(entry.status, 'JOINED');
    assert.equal(entry.photoUrl, null);

    const attached = await submit(entry.id);
    assert.ok(attached.ok);
    assert.equal(attached.entry.shelfIndex, 0);
    assert.equal(attached.entry.status, 'SUBMITTED');

    // 이미지는 Supabase Storage의 공개 URL로 나간다. /api/photos는 이 경로에 없다.
    const url = attached.entry.photoUrl ?? '';
    assert.ok(url.startsWith(`${process.env.SUPABASE_URL}/storage/v1/object/public/`), url);
    const fetched = await fetch(url);
    assert.equal(fetched.status, 200);
    assert.deepEqual(new Uint8Array(await fetched.arrayBuffer()), PHOTO.bytes);
  });

  test('shelfIndex는 여러 명이 내도 구멍 없이 촘촘하다', async () => {
    const ids = await seedJoined(8);

    // 등록 순서와 제출 순서가 다르다. 배정 기준은 제출 순서다.
    const assigned: number[] = [];
    for (const index of [5, 0, 7, 3, 1, 6, 2, 4]) {
      const result = await submit(ids[index]);
      assert.ok(result.ok);
      assigned.push(result.entry.shelfIndex as number);
    }

    assert.deepEqual(assigned, [...Array(8).keys()]);
  });

  test('동시에 제출해도 칸이 촘촘하고 중복이 없다', async () => {
    const ids = await seedJoined(10);

    // 서버리스는 인보케이션이 동시에 뜬다. next_shelf_index()의 advisory lock이
    // 여기서 실제로 일하는지 확인한다 — 구멍이나 중복은 진열장 격자에 그대로 보인다.
    const results = await Promise.all(ids.map((id) => submit(id)));
    const indexes = results
      .map((result) => (result.ok ? result.entry.shelfIndex : null))
      .filter((index): index is number => index !== null)
      .sort((a, b) => a - b);

    assert.equal(indexes.length, 10, '제출이 하나라도 튕겼다');
    assert.deepEqual(indexes, [...Array(10).keys()]);
  });

  test(`${MAX_ENTRIES + 1}번째 사진 제출은 SHOWCASE_FULL로 막힌다`, async () => {
    // 29칸은 배경이다. 검사하려는 것은 마지막 칸과 그 다음 한 명이다.
    await seedSubmitted(MAX_ENTRIES - 1);
    const [last, overflow] = await seedJoined(2);

    const lastSlot = await submit(last);
    assert.ok(lastSlot.ok, '마지막 한 칸이 막혔다');
    assert.equal(lastSlot.entry.shelfIndex, MAX_ENTRIES - 1);

    // shelf_index < 30 체크 제약이 정원 제한을 겸한다. 세고 나서 넣지 않는다.
    assert.deepEqual(await submit(overflow), { ok: false, code: 'SHOWCASE_FULL' });

    // 튕긴 행은 트랜잭션째 되돌아간다 — 사진도 칸도 없는 JOINED 그대로다.
    const overflowed = (await getAdminState()).entries.find((entry) => entry.id === overflow);
    assert.equal(overflowed?.status, 'JOINED');
    assert.equal(overflowed?.shelfIndex, null);
    assert.equal((await getState()).counts.submitted, MAX_ENTRIES);
  });

  /**
   * 정원 경계가 경합에서도 버티는지 본다. 여기가 무너지면 행사 당일 둘 중 하나가 된다 —
   * 31번째가 통과해 진열장 격자가 깨지거나, 자리가 있는 참가자가 잘못 튕긴다.
   *
   * 미리 세어 보고 넣는 구현이었다면 여기서 여러 명이 같은 "빈 칸 하나"를 보고 통과한다.
   * 실제로 막는 것은 `shelf_index` unique와 `< 30` 체크 제약이다.
   */
  test('마지막 한 칸을 여럿이 동시에 노려도 한 명만 들어간다', async () => {
    await seedSubmitted(MAX_ENTRIES - 1);
    const contenders = await seedJoined(5);

    const results = await Promise.all(contenders.map((id) => submit(id)));
    const winners = results.filter((result) => result.ok);
    const rejected = results.filter((result) => !result.ok && result.code === 'SHOWCASE_FULL');

    assert.equal(winners.length, 1, `한 명만 들어가야 하는데 ${winners.length}명이 들어갔다`);
    assert.equal(rejected.length, 4, '나머지는 전부 SHOWCASE_FULL이어야 한다');
    assert.equal(winners[0].ok && winners[0].entry.shelfIndex, MAX_ENTRIES - 1);

    // 칸이 31개가 되거나 같은 칸을 둘이 잡는 일이 없어야 한다.
    const slots = await query<{ taken: string; highest: number }>(
      'select count(*) as taken, max(shelf_index) as highest from entries where shelf_index is not null',
    );
    assert.equal(slots.rows[0].taken, String(MAX_ENTRIES));
    assert.equal(slots.rows[0].highest, MAX_ENTRIES - 1);
  });

  test('사진을 두 번 붙이면 ALREADY_SUBMITTED고, 없는 id는 NOT_FOUND다', async () => {
    const entry = await joined(1);
    assert.ok((await submit(entry.id)).ok);

    assert.deepEqual(await submit(entry.id), { ok: false, code: 'ALREADY_SUBMITTED' });
    assert.deepEqual(await submit('11111111-2222-3333-4444-555555555555'), {
      ok: false,
      code: 'NOT_FOUND',
    });
    // uuid가 아닌 값도 404다. 여기서 22P02로 던지면 라우트가 500을 낸다.
    assert.deepEqual(await submit('없는-id'), { ok: false, code: 'NOT_FOUND' });
  });

  test('운영자는 FAILED 건에 새 사진을 올릴 수 있고 칸은 그대로다', async () => {
    const entry = await joined(1);
    const first = await submit(entry.id);
    assert.ok(first.ok);
    const slot = first.entry.shelfIndex;

    // 이전 이미지로 IPFS까지 갔던 실패를 흉내낸다.
    await saveCertificateCid(entry.id, 'bafy-old-certificate');
    await saveMetadataCid(entry.id, 'bafy-old-metadata');

    await age(entry.id, 6 * 60);
    assert.equal((await sweep()).failed, 1);

    // 참가자 경로는 여전히 막힌다 — 사진이 이미 있다.
    assert.deepEqual(await submit(entry.id), { ok: false, code: 'ALREADY_SUBMITTED' });

    const retake = await submit(entry.id, RETAKE, { operator: true });
    assert.ok(retake.ok);
    assert.equal(retake.entry.status, 'SUBMITTED');
    assert.equal(retake.entry.failureReason, null);
    // 재촬영이 새 칸을 잡으면 진열장에 구멍이 남는다.
    assert.equal(retake.entry.shelfIndex, slot);

    const internal = await getPipelineEntry(entry.id);
    assert.equal(internal?.certificateCid, null, '새 사진에 예전 증서 CID를 재사용했다');
    assert.equal(internal?.metadataCid, null, '새 사진에 예전 메타데이터 CID를 재사용했다');

    // 새 사진은 새 URL이어야 한다. 같은 URL이면 TV와 CDN이 옛 이미지를 계속 보여준다.
    assert.notEqual(retake.entry.photoUrl, first.entry.photoUrl);
    const fetched = await fetch(retake.entry.photoUrl ?? '');
    assert.deepEqual(new Uint8Array(await fetched.arrayBuffer()), RETAKE.bytes);
  });

  test('운영자가 재시도하면 FAILED가 다시 오븐으로 들어간다', async () => {
    const entry = await joined(1);
    assert.ok((await submit(entry.id)).ok);
    await age(entry.id, 6 * 60);
    await sweep();

    const retried = await retryEntry(entry.id);
    assert.equal(retried?.status, 'SUBMITTED');
    assert.equal(retried?.failureReason, null);
    // FAILED가 아닌 행은 재시도 대상이 아니다.
    assert.equal(await retryEntry(entry.id), null);
  });

  test('재시도는 남아 있는 CID·txHash 다음 단계로 복귀한다', async () => {
    const pinned = await joined(1);
    assert.ok((await submit(pinned.id)).ok);
    await saveCertificateCid(pinned.id, 'bafy-certificate');
    await saveMetadataCid(pinned.id, 'bafy-metadata');
    await query("update entries set status = 'FAILED', failure_reason = 'test' where id = $1", [pinned.id]);
    assert.equal((await retryEntry(pinned.id))?.status, 'PINNED');

    await query(
      "update entries set status = 'FAILED', tx_hash = $2, failure_reason = 'test' where id = $1",
      [pinned.id, `0x${'1'.repeat(64)}`],
    );
    assert.equal((await retryEntry(pinned.id))?.status, 'MINTING');
  });

  test('민팅 advisory lock은 다른 항목의 콜백도 한 번에 하나만 실행한다', async () => {
    const first = await joined(1);
    const second = await joined(2);
    assert.ok((await submit(first.id)).ok);
    assert.ok((await submit(second.id)).ok);
    await saveCertificateCid(first.id, 'bafy-certificate-1');
    await saveMetadataCid(first.id, 'bafy-metadata-1');
    await saveCertificateCid(second.id, 'bafy-certificate-2');
    await saveMetadataCid(second.id, 'bafy-metadata-2');

    let active = 0;
    let maximum = 0;
    const work = (id: string) => withMintLock(id, async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 40));
      active -= 1;
    });

    await Promise.all([work(first.id), work(second.id)]);
    assert.equal(maximum, 1);
  });

  test('cron과 운영자 수동 스위프가 겹치면 하나만 실행한다', async () => {
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    let releaseFirst!: () => void;
    const release = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const first = withSweepLock(async () => {
      signalStarted();
      await release;
      return 'first';
    });
    await started;
    assert.equal(await withSweepLock(async () => 'second'), null);
    releaseFirst();
    assert.equal(await first, 'first');
  });

  test('스위퍼가 오븐에서 멈춘 행을 FAILED로 내린다', async () => {
    const entry = await joined(1);
    assert.ok((await submit(entry.id)).ok);

    await age(entry.id, 60);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 0 });

    await age(entry.id, 6 * 60);
    assert.deepEqual(await sweep(), { failed: 1, hidden: 0 });

    const [row] = (await getAdminState()).entries;
    assert.equal(row.status, 'FAILED');
    assert.equal(row.failureReason, '처리 중 멈춤 (스위퍼)');
    // 실패해도 칸과 사진은 그대로 둔다. 재시도할 때 되쓴다.
    assert.equal(row.shelfIndex, 0);
    assert.ok(row.photoUrl);
  });

  test('스위퍼가 방치된 JOINED를 내리고, 운영자가 올린 것은 다시 내리지 않는다', async () => {
    const entry = await joined(1);

    await age(entry.id, 9 * 60);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 0 });

    await age(entry.id, 11 * 60);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 1 });
    assert.equal((await getAdminState()).entries[0].autoHidden, true);

    // 늦게 온 참가자가 나타나서 운영자가 카드를 되살렸다.
    assert.equal((await setHidden(entry.id, false))?.hidden, false);

    // 한참 뒤에 스위퍼가 또 돌아도 운영자의 판단을 뒤집으면 안 된다.
    await age(entry.id, 120 * 60);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 0 });
    assert.equal((await getAdminState()).entries[0].hidden, false);
  });

  test('자동으로 내려간 참가자가 사진을 제출하면 TV에 다시 나타난다', async () => {
    const entry = await joined(1);
    await age(entry.id, 11);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 1 });

    const attached = await submit(entry.id);
    assert.ok(attached.ok);
    assert.equal(attached.entry.status, 'SUBMITTED');
    assert.equal(attached.entry.hidden, false);
    assert.equal((await getAdminState()).entries[0].autoHidden, false);
  });

  test('운영자가 직접 내린 참가자는 사진을 제출해도 숨김을 유지한다', async () => {
    const entry = await joined(1);
    await setHidden(entry.id, true);

    const attached = await submit(entry.id);
    assert.ok(attached.ok);
    assert.equal(attached.entry.status, 'SUBMITTED');
    assert.equal(attached.entry.hidden, true);
    assert.equal((await getAdminState()).entries[0].autoHidden, false);
  });

  test('자동 내림 뒤 운영자가 다시 내린 참가자는 사진을 제출해도 숨김을 유지한다', async () => {
    const entry = await joined(1);
    await age(entry.id, 11);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 1 });
    await setHidden(entry.id, false);
    await setHidden(entry.id, true);

    assert.equal((await getAdminState()).entries[0].autoHidden, false);

    const attached = await submit(entry.id);
    assert.ok(attached.ok);
    assert.equal(attached.entry.status, 'SUBMITTED');
    assert.equal(attached.entry.hidden, true);
  });

  test('운영자가 직접 내렸다가 다시 올린 카드도 스위퍼가 또 내리지 않는다', async () => {
    const entry = await joined(1);
    await setHidden(entry.id, true);
    await setHidden(entry.id, false);

    await age(entry.id, 120);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 0 });
    assert.equal((await getAdminState()).entries[0].hidden, false);
  });

  test('화면 상태가 DB에 남는다', async () => {
    // 메모리에 두면 인보케이션마다 달라서 운영자가 GALLERY로 바꿔도 TV는 LIVE를 본다.
    assert.deepEqual(await updateShow({ layout: 'GALLERY', shelfPage: 1 }), {
      layout: 'GALLERY',
      qrVisible: true,
      shelfPage: 1,
    });
    assert.deepEqual((await getState()).show, { layout: 'GALLERY', qrVisible: true, shelfPage: 1 });
  });

  /**
   * 이 검사가 이 파일에서 제일 중요하다. `GET /api/state`는 인증이 없어 TV URL을 아는
   * 사람이면 누구나 본다. 여기로 실패 사유·지갑 주소·DID가 새면 되돌릴 방법이 없다.
   */
  test('GET /api/state — 실패 사유·지갑 주소·DID가 응답 본문에 없다', async () => {
    const first = await joined(1);
    assert.ok((await submit(first.id)).ok);
    // 아직 사진을 안 낸 카드도 공개 응답에 실린다. 새는 면적에 포함시켜 확인한다.
    const second = await joined(2);

    await age(first.id, 6 * 60);
    assert.equal((await sweep()).failed, 1);

    const admin = await getAdminState();
    const failed = admin.entries.find((entry) => entry.status === 'FAILED');
    assert.ok(failed?.failureReason, '실패 사유가 준비되지 않아 검사가 무의미하다');

    const body = await (await getPublicState()).text();

    assert.ok(!body.includes(failed.failureReason), `failureReason이 샜다: ${body}`);
    assert.ok(!body.includes(participant(1).walletAddress.toLowerCase()), `지갑 주소가 샜다: ${body}`);
    assert.ok(!body.includes(participant(1).privyDid), `DID가 샜다: ${body}`);
    assert.ok(!/wallet|privy|did:/i.test(body), `개인정보 필드 이름이 샜다: ${body}`);

    // 카드 자체는 그대로 나가야 한다. 다 지워서 통과한 것이 아님을 확인한다.
    const state = JSON.parse(body) as StateResponse;
    assert.equal(state.entries.length, 2);
    assert.ok(state.entries.some((entry) => entry.status === 'FAILED'));
    assert.ok(state.entries.every((entry) => entry.failureReason === null));
    assert.deepEqual(state.counts, { submitted: 1, minted: 0 });
    // 사진을 안 낸 카드는 뒤로 간다.
    assert.equal(state.entries[1].id, second.id);
  });

  test('테이블을 비우고 끝낸다', async () => {
    // 행사 당일은 빈 테이블에서 시작한다. 남은 행 하나가 진열장 칸 하나를 먹는다.
    await resetStore();
    const counts = await query<{ entries: string; participants: string }>(
      'select (select count(*) from entries) as entries, (select count(*) from participants) as participants',
    );
    assert.deepEqual(counts.rows[0], { entries: '0', participants: '0' });
  });
});

/**
 * 이 파일이 손댄 카드의 폴더만 훑어 지운다. `entries/` 전체를 지우면 실제 증서가 날아간다.
 *
 * 응답이 아니라 폴더를 보는 이유는, 정원 초과로 튕긴 제출도 업로드는 이미 끝난 뒤라
 * DB에는 없고 버킷에만 남은 이미지가 생기기 때문이다.
 */
async function removeTestObjects() {
  const bucket = process.env.SUPABASE_BUCKET;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = process.env.SUPABASE_URL;
  if (!bucket || !key || !base) return;

  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  };

  const paths: string[] = [];
  for (const entryId of touched) {
    const listed = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prefix: `entries/${entryId}`, limit: 100 }),
    });
    const objects = (await listed.json()) as { name: string }[];
    for (const object of objects) paths.push(`entries/${entryId}/${object.name}`);
  }
  if (paths.length === 0) return;

  const removed = await fetch(`${base}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ prefixes: paths }),
  });
  assert.ok(removed.ok, `올린 이미지를 지우지 못했다: ${removed.status}`);
}
