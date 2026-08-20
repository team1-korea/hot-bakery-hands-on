import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { MAX_ENTRIES } from '@/lib/api/types';

import {
  ABANDONED_JOIN_MS,
  STUCK_MS,
  attachPhoto,
  getAdminState,
  register,
  resetStore,
  setHidden,
  sweep,
  type Photo,
} from './store';

/**
 * 목 저장소가 `db/schema.sql`의 제약을 실제로 흉내내는지 확인한다.
 *
 * 여기서 잡으려는 것은 행사 당일 되돌릴 수 없는 것들이다 — 카드가 두 장 생기는 것,
 * 진열장에 구멍이 나는 것, 이탈자가 정원을 갉아먹는 것.
 */

const PHOTO: Photo = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), contentType: 'image/jpeg' };

/** 참가자 한 명. DID와 지갑 주소는 실제로는 Privy가 준다. */
function participant(n: number) {
  return {
    privyDid: `did:privy:test-${n}`,
    walletAddress: `0x${String(n).padStart(40, '0')}`,
    nickname: `참가자${n}`,
  };
}

beforeEach(() => resetStore());

test('같은 DID로 두 번 등록해도 카드는 한 장이다', async () => {
  const first = await register(participant(1));
  const second = await register({ ...participant(1), nickname: '다른닉네임' });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.entry.id, first.entry.id);
  // 이미 TV에 떠 있는 카드의 닉네임을 나중 요청이 덮어쓰지 않는다.
  assert.equal(second.entry.nickname, '참가자1');
  assert.equal((await getAdminState()).entries.length, 1);
});

test('shelfIndex는 등록에서 null이고 사진 제출 때 배정된다', async () => {
  const { entry } = await register(participant(1));
  assert.equal(entry.shelfIndex, null);
  assert.equal(entry.status, 'JOINED');
  assert.equal(entry.photoUrl, null);

  const attached = await attachPhoto(entry.id, PHOTO);
  assert.ok(attached.ok);
  assert.equal(attached.entry.shelfIndex, 0);
  assert.equal(attached.entry.status, 'SUBMITTED');
  assert.equal(attached.entry.photoUrl, `/api/photos/${entry.id}`);
});

test('shelfIndex는 여러 명이 내도 구멍 없이 촘촘하다', async () => {
  const ids: string[] = [];
  for (let n = 0; n < 12; n += 1) {
    const { entry } = await register(participant(n));
    ids.push(entry.id);
  }

  // 등록 순서와 제출 순서가 다르다. 배정 기준은 제출 순서다.
  const submitOrder = [5, 0, 11, 3, 7, 1, 9, 2, 10, 4, 8, 6];
  const assigned: number[] = [];
  for (const index of submitOrder) {
    const result = await attachPhoto(ids[index], PHOTO);
    assert.ok(result.ok);
    assigned.push(result.entry.shelfIndex as number);
  }

  // 제출 순서대로 0부터. 중복도 빈 번호도 없어야 Showcase 격자에 구멍이 안 생긴다.
  assert.deepEqual(assigned, [...Array(12).keys()]);
});

test('등록만 하고 사라진 사람은 정원을 갉아먹지 않는다', async () => {
  // 정원을 꽉 채울 만큼 등록만 시켜 둔다.
  for (let n = 0; n < MAX_ENTRIES + 5; n += 1) {
    await register(participant(n));
  }

  // 그래도 첫 제출은 0번 칸을 받아야 한다.
  const rows = (await getAdminState()).entries;
  const first = await attachPhoto(rows[0].id, PHOTO);
  assert.ok(first.ok);
  assert.equal(first.entry.shelfIndex, 0);
  assert.equal((await getAdminState()).counts.submitted, 1);
});

test(`${MAX_ENTRIES + 1}번째 사진 제출은 SHOWCASE_FULL로 막힌다`, async () => {
  const ids: string[] = [];
  for (let n = 0; n < MAX_ENTRIES + 1; n += 1) {
    const { entry } = await register(participant(n));
    ids.push(entry.id);
  }

  for (let n = 0; n < MAX_ENTRIES; n += 1) {
    const result = await attachPhoto(ids[n], PHOTO);
    assert.ok(result.ok, `${n}번째 제출이 막혔다`);
  }

  const overflow = await attachPhoto(ids[MAX_ENTRIES], PHOTO);
  assert.deepEqual(overflow, { ok: false, code: 'SHOWCASE_FULL' });
});

test('사진을 두 번 붙이면 ALREADY_SUBMITTED다', async () => {
  const { entry } = await register(participant(1));
  assert.ok((await attachPhoto(entry.id, PHOTO)).ok);

  assert.deepEqual(await attachPhoto(entry.id, PHOTO), {
    ok: false,
    code: 'ALREADY_SUBMITTED',
  });
});

test('등록하지 않은 참가자에게 사진을 붙이면 NOT_FOUND다', async () => {
  assert.deepEqual(await attachPhoto('없는-id', PHOTO), { ok: false, code: 'NOT_FOUND' });
});

test('운영자는 FAILED 건에 새 사진을 올릴 수 있고 칸은 그대로다', async () => {
  const { entry } = await register(participant(1));
  const first = await attachPhoto(entry.id, PHOTO);
  assert.ok(first.ok);
  const slot = first.entry.shelfIndex;

  await sweep(Date.now() + STUCK_MS);
  assert.equal(entry.status, 'FAILED');

  // 참가자 경로는 여전히 막힌다 — 사진이 이미 있다.
  assert.deepEqual(await attachPhoto(entry.id, PHOTO), {
    ok: false,
    code: 'ALREADY_SUBMITTED',
  });

  const retake = await attachPhoto(entry.id, PHOTO, { operator: true });
  assert.ok(retake.ok);
  assert.equal(retake.entry.status, 'SUBMITTED');
  assert.equal(retake.entry.failureReason, null);
  // 재촬영이 새 칸을 잡으면 진열장에 구멍이 남는다.
  assert.equal(retake.entry.shelfIndex, slot);
  assert.equal((await getAdminState()).counts.submitted, 1);
});

test('운영자 명단에는 실패 사유·지갑 주소·자동 내림 여부가 들어간다', async () => {
  const { entry } = await register(participant(7));
  await attachPhoto(entry.id, PHOTO);
  await sweep(Date.now() + STUCK_MS);

  const [row] = (await getAdminState()).entries;
  assert.equal(row.status, 'FAILED');
  assert.equal(row.failureReason, '처리 중 멈춤 (스위퍼)');
  assert.equal(row.walletAddress, participant(7).walletAddress.toLowerCase());
  assert.equal(row.autoHidden, false);

  // 실제 응답 본문에 실려 나가야 한다.
  assert.match(JSON.stringify(await getAdminState()), /처리 중 멈춤/);
});

test('스위퍼가 오븐에서 멈춘 행을 FAILED로 내린다', async () => {
  const { entry } = await register(participant(1));
  await attachPhoto(entry.id, PHOTO);

  assert.deepEqual(await sweep(Date.now() + STUCK_MS - 1_000), { failed: 0, hidden: 0 });
  assert.equal(entry.status, 'SUBMITTED');

  assert.deepEqual(await sweep(Date.now() + STUCK_MS), { failed: 1, hidden: 0 });
  assert.equal(entry.status, 'FAILED');
  assert.equal(entry.failureReason, '처리 중 멈춤 (스위퍼)');
});

test('스위퍼가 방치된 JOINED 카드를 내린다', async () => {
  const { entry } = await register(participant(1));

  assert.deepEqual(await sweep(Date.now() + ABANDONED_JOIN_MS - 1_000), { failed: 0, hidden: 0 });
  assert.equal(entry.hidden, false);

  assert.deepEqual(await sweep(Date.now() + ABANDONED_JOIN_MS), { failed: 0, hidden: 1 });
  assert.equal(entry.hidden, true);
  assert.equal((await getAdminState()).entries[0].autoHidden, true);
});

test('운영자가 다시 올린 카드를 스위퍼가 또 내리지 않는다', async () => {
  const { entry } = await register(participant(1));
  await sweep(Date.now() + ABANDONED_JOIN_MS);
  assert.equal(entry.hidden, true);

  // 늦게 온 참가자가 나타나서 운영자가 카드를 되살렸다.
  await setHidden(entry.id, false);

  // 한참 뒤에 스위퍼가 또 돌아도 운영자의 판단을 뒤집으면 안 된다.
  assert.deepEqual(await sweep(Date.now() + ABANDONED_JOIN_MS * 10), { failed: 0, hidden: 0 });
  assert.equal(entry.hidden, false);
});
