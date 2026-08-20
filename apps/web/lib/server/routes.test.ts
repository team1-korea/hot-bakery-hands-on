import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { POST as postEntry } from '@/app/api/entries/route';
import { POST as postParticipant } from '@/app/api/participants/route';
import { GET as getPublicState } from '@/app/api/state/route';
import type { ApiErrorBody, Entry, StateResponse } from '@/lib/api/types';

import { callerFrom } from './auth';
import { STUCK_MS, getAdminState, resetStore, sweep } from './store';

/**
 * 라우트 핸들러를 직접 부른다. **직렬화된 실제 응답**을 봐야 하는 검사가 있어서다 —
 * 공개 `GET /api/state`에 무엇이 실려 나가는지는 저장소 함수가 아니라 응답 본문이 정본이다.
 *
 * 운영자 라우트는 여기서 부를 수 없다. `blockNonOperator()`가 `next/headers`의 `cookies()`를
 * 쓰는데 요청 컨텍스트 밖에서는 던진다. 그 라우트는 `getAdminState()`를 그대로 내보내므로
 * 저장소 쪽에서 확인한다.
 */

beforeEach(() => resetStore());

/** 목 인증은 `x-dev-participant`로 참가자를 가른다. 폰 여러 대를 흉내내는 통로다. */
function asParticipant(who: string, init: RequestInit = {}) {
  return new Request('http://localhost/api', {
    ...init,
    headers: { ...(init.headers ?? {}), 'x-dev-participant': who },
  });
}

function joinBody(nickname: string): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify({ nickname }),
    headers: { 'content-type': 'application/json' },
  };
}

function photoBody(): RequestInit {
  const form = new FormData();
  form.set('photo', new File([new Uint8Array([0xff, 0xd8, 0xff])], 'cookie.jpg', {
    type: 'image/jpeg',
  }));
  return { method: 'POST', body: form };
}

test('POST /api/participants — 처음은 201, 다시 부르면 같은 카드로 200', async () => {
  const first = await postParticipant(asParticipant('phone-a', joinBody('쿠키왕')));
  assert.equal(first.status, 201);
  const created = (await first.json()) as Entry;
  assert.equal(created.status, 'JOINED');
  assert.equal(created.shelfIndex, null);
  assert.equal(created.photoUrl, null);

  const again = await postParticipant(asParticipant('phone-a', joinBody('쿠키왕')));
  assert.equal(again.status, 200);
  assert.equal(((await again.json()) as Entry).id, created.id);
});

test('POST /api/participants — 폰이 다르면 다른 참가자다', async () => {
  await postParticipant(asParticipant('phone-a', joinBody('가')));
  await postParticipant(asParticipant('phone-b', joinBody('나')));

  assert.equal((await getAdminState()).entries.length, 2);
});

test('POST /api/participants — 닉네임이 12자를 넘으면 INVALID_NICKNAME', async () => {
  const response = await postParticipant(asParticipant('phone-a', joinBody('가'.repeat(13))));
  assert.equal(response.status, 400);
  assert.equal(((await response.json()) as ApiErrorBody).error.code, 'INVALID_NICKNAME');
});

test('POST /api/entries — 등록하지 않았으면 404 NOT_FOUND', async () => {
  const response = await postEntry(asParticipant('phone-a', photoBody()));
  assert.equal(response.status, 404);
  assert.equal(((await response.json()) as ApiErrorBody).error.code, 'NOT_FOUND');
});

test('POST /api/entries — 등록한 참가자의 사진이 카드를 오븐으로 보낸다', async () => {
  await postParticipant(asParticipant('phone-a', joinBody('쿠키왕')));

  const response = await postEntry(asParticipant('phone-a', photoBody()));
  assert.equal(response.status, 201);
  const entry = (await response.json()) as Entry;
  assert.equal(entry.status, 'SUBMITTED');
  assert.equal(entry.shelfIndex, 0);

  const again = await postEntry(asParticipant('phone-a', photoBody()));
  assert.equal(again.status, 409);
  assert.equal(((await again.json()) as ApiErrorBody).error.code, 'ALREADY_SUBMITTED');
});

/**
 * 이 검사가 이 파일에서 제일 중요하다. `GET /api/state`는 인증이 없어 TV URL을 아는
 * 사람이면 누구나 본다. 여기로 실패 사유·지갑 주소·DID가 새면 되돌릴 방법이 없다.
 */
test('GET /api/state — 실패 사유·지갑 주소·DID가 응답 본문에 없다', async () => {
  await postParticipant(asParticipant('phone-a', joinBody('쿠키왕')));
  await postEntry(asParticipant('phone-a', photoBody()));
  // 아직 사진을 안 낸 카드도 공개 응답에 실린다. 새는 면적에 포함시켜 확인한다.
  await postParticipant(asParticipant('phone-b', joinBody('밀가루')));

  // 실패 사유가 실제로 채워진 카드가 있어야 이 검사가 의미를 가진다.
  const swept = await sweep(Date.now() + STUCK_MS);
  assert.equal(swept.failed, 1);

  const admin = await getAdminState();
  const failed = admin.entries.find((entry) => entry.status === 'FAILED');
  assert.ok(failed?.failureReason, '실패 사유가 준비되지 않아 검사가 무의미하다');

  const caller = await callerFrom(asParticipant('phone-a'));
  assert.ok(caller);

  const body = await (await getPublicState()).text();

  assert.ok(!body.includes(failed.failureReason), `failureReason이 샜다: ${body}`);
  assert.ok(!body.includes(caller.walletAddress), `지갑 주소가 샜다: ${body}`);
  assert.ok(!body.includes(caller.did), `DID가 샜다: ${body}`);
  assert.ok(!/wallet|privy|did:/i.test(body), `개인정보 필드 이름이 샜다: ${body}`);

  // 카드 자체는 그대로 나가야 한다. 다 지워서 통과한 것이 아님을 확인한다.
  const state = JSON.parse(body) as StateResponse;
  assert.equal(state.entries.length, 2);
  assert.ok(state.entries.some((entry) => entry.status === 'FAILED'));
  assert.ok(state.entries.every((entry) => entry.failureReason === null));
  assert.deepEqual(state.counts, { submitted: 1, minted: 0 });
});
