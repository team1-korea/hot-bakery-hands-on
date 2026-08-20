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
  updateShow,
  type Photo,
} from './store';

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
async function age(entryId: string, minutes: number) {
  await query(
    'update entries set status_changed_at = now() - make_interval(mins => $2::int) where id = $1',
    [entryId, minutes],
  );
}

async function joined(n: number): Promise<Entry> {
  return (await register(participant(n))).entry;
}

describe('Postgres 저장소 (실제 Supabase)', { skip: LIVE ? false : 'DATABASE_URL이 없다' }, () => {
  /**
   * **이 검사는 테이블을 비운다.** 행사 중에 누가 `npm test`를 돌리면 그 자리에서
   * 참가자 기록이 사라진다. 비어 있지 않은 DB는 아예 건드리지 않고 크게 실패한다 —
   * 조용히 건너뛰면 다음 사람이 같은 실수를 반복한다.
   */
  before(async () => {
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

  after(async () => {
    await removeTestObjects();
    await resetStore();
    await closeDatabase();
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
    const ids: string[] = [];
    for (let n = 0; n < 8; n += 1) ids.push((await joined(n)).id);

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
    const ids: string[] = [];
    for (let n = 0; n < 10; n += 1) ids.push((await joined(n)).id);

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
    const ids: string[] = [];
    for (let n = 0; n < MAX_ENTRIES + 1; n += 1) ids.push((await joined(n)).id);

    for (let n = 0; n < MAX_ENTRIES; n += 1) {
      assert.ok((await submit(ids[n])).ok, `${n}번째 제출이 막혔다`);
    }

    // shelf_index < 30 체크 제약이 정원 제한을 겸한다. 세고 나서 넣지 않는다.
    assert.deepEqual(await submit(ids[MAX_ENTRIES]), { ok: false, code: 'SHOWCASE_FULL' });

    // 튕긴 행은 트랜잭션째 되돌아간다 — 사진도 칸도 없는 JOINED 그대로다.
    const overflowed = (await getAdminState()).entries.find((entry) => entry.id === ids[MAX_ENTRIES]);
    assert.equal(overflowed?.status, 'JOINED');
    assert.equal(overflowed?.shelfIndex, null);
    assert.equal((await getState()).counts.submitted, MAX_ENTRIES);
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

    await age(entry.id, 6);
    assert.equal((await sweep()).failed, 1);

    // 참가자 경로는 여전히 막힌다 — 사진이 이미 있다.
    assert.deepEqual(await submit(entry.id), { ok: false, code: 'ALREADY_SUBMITTED' });

    const retake = await submit(entry.id, RETAKE, { operator: true });
    assert.ok(retake.ok);
    assert.equal(retake.entry.status, 'SUBMITTED');
    assert.equal(retake.entry.failureReason, null);
    // 재촬영이 새 칸을 잡으면 진열장에 구멍이 남는다.
    assert.equal(retake.entry.shelfIndex, slot);

    // 새 사진은 새 URL이어야 한다. 같은 URL이면 TV와 CDN이 옛 이미지를 계속 보여준다.
    assert.notEqual(retake.entry.photoUrl, first.entry.photoUrl);
    const fetched = await fetch(retake.entry.photoUrl ?? '');
    assert.deepEqual(new Uint8Array(await fetched.arrayBuffer()), RETAKE.bytes);
  });

  test('운영자가 재시도하면 FAILED가 다시 오븐으로 들어간다', async () => {
    const entry = await joined(1);
    assert.ok((await submit(entry.id)).ok);
    await age(entry.id, 6);
    await sweep();

    const retried = await retryEntry(entry.id);
    assert.equal(retried?.status, 'SUBMITTED');
    assert.equal(retried?.failureReason, null);
    // FAILED가 아닌 행은 재시도 대상이 아니다.
    assert.equal(await retryEntry(entry.id), null);
  });

  test('스위퍼가 오븐에서 멈춘 행을 FAILED로 내린다', async () => {
    const entry = await joined(1);
    assert.ok((await submit(entry.id)).ok);

    await age(entry.id, 4);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 0 });

    await age(entry.id, 6);
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

    await age(entry.id, 9);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 0 });

    await age(entry.id, 11);
    assert.deepEqual(await sweep(), { failed: 0, hidden: 1 });
    assert.equal((await getAdminState()).entries[0].autoHidden, true);

    // 늦게 온 참가자가 나타나서 운영자가 카드를 되살렸다.
    assert.equal((await setHidden(entry.id, false))?.hidden, false);

    // 한참 뒤에 스위퍼가 또 돌아도 운영자의 판단을 뒤집으면 안 된다.
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

    await age(first.id, 6);
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
