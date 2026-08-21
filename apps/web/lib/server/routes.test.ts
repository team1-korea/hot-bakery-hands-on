import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { PATCH as patchAdminEntry } from '@/app/api/admin/entries/[id]/route';
import { POST as resetAdmin } from '@/app/api/admin/reset/route';
import { POST as sweepAdmin } from '@/app/api/admin/sweep/route';
import { GET as getEntry, POST as postEntry } from '@/app/api/entries/route';
import { POST as sweepRoute } from '@/app/api/internal/sweep/route';
import { POST as postParticipant } from '@/app/api/participants/route';
import { GET as getPublicState } from '@/app/api/state/route';
import type { ApiErrorBody, Entry, StateResponse } from '@/lib/api/types';

import { callerFrom } from './auth';
import { OPERATOR_COOKIE, operatorToken } from './http';
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

function asOperator(path: string, body?: unknown) {
  const passcode = process.env.OPERATOR_PASSCODE ?? 'route-test-passcode';
  process.env.OPERATOR_PASSCODE = passcode;
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      cookie: `${OPERATOR_COOKIE}=${operatorToken(passcode)}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

test('참가자 조회·재등록 응답에는 내부 failureReason 값이 새지 않는다', async () => {
  await postParticipant(asParticipant('phone-a', joinBody('쿠키왕')));
  await postEntry(asParticipant('phone-a', photoBody()));
  await sweep(Date.now() + STUCK_MS);

  const admin = await getAdminState();
  const internalReason = admin.entries[0].failureReason;
  assert.ok(internalReason);

  const polled = await getEntry(asParticipant('phone-a'));
  const pollBody = await polled.text();
  assert.ok(!pollBody.includes(internalReason));
  assert.equal((JSON.parse(pollBody) as Entry).failureReason, null);

  const registered = await postParticipant(asParticipant('phone-a', joinBody('무시될이름')));
  const registerBody = await registered.text();
  assert.ok(!registerBody.includes(internalReason));
  assert.equal((JSON.parse(registerBody) as Entry).failureReason, null);
});

test('POST /api/internal/sweep — CRON_SECRET 없이는 막고 Bearer로만 연다', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-cron-secret';
  try {
    const blocked = await sweepRoute(new Request('http://localhost/api/internal/sweep', { method: 'POST' }));
    assert.equal(blocked.status, 401);

    const allowed = await sweepRoute(new Request('http://localhost/api/internal/sweep', {
      method: 'POST',
      headers: { authorization: 'Bearer test-cron-secret' },
    }));
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), { failed: 0, hidden: 0, recovered: 0, deferred: 0 });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('POST /api/admin/sweep — 운영자만 멈춘 작업을 수동 점검할 수 있다', async () => {
  const blocked = await sweepAdmin(new Request('http://localhost/api/admin/sweep', { method: 'POST' }));
  assert.equal(blocked.status, 401);

  await postParticipant(asParticipant('phone-a', joinBody('쿠키왕')));
  await postEntry(asParticipant('phone-a', photoBody()));
  const originalNow = Date.now;
  Date.now = () => originalNow() + STUCK_MS;
  try {
    const response = await sweepAdmin(asOperator('/api/admin/sweep'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      failed: 1,
      hidden: 0,
      recovered: 0,
      deferred: 0,
    });
  } finally {
    Date.now = originalNow;
  }
});

test('PATCH /api/admin/entries/{id} — 닉네임을 trim하고 잘못된 본문은 hidden을 바꾸지 않는다', async () => {
  const created = await postParticipant(asParticipant('phone-a', joinBody('처음이름')));
  const entry = (await created.json()) as Entry;
  const context = { params: Promise.resolve({ id: entry.id }) };

  const renamed = await patchAdminEntry(
    asOperator(`/api/admin/entries/${entry.id}`, { nickname: '  새이름  ' }),
    context,
  );
  assert.equal(renamed.status, 200);
  assert.equal(((await renamed.json()) as Entry).nickname, '새이름');

  const malformed = await patchAdminEntry(
    asOperator(`/api/admin/entries/${entry.id}`, { hidden: 'false' }),
    context,
  );
  assert.equal(malformed.status, 400);
  assert.equal((await getAdminState()).entries[0].hidden, false);

  const empty = await patchAdminEntry(
    asOperator(`/api/admin/entries/${entry.id}`, {}),
    context,
  );
  assert.equal(empty.status, 400);
  assert.equal((await getAdminState()).entries[0].hidden, false);
});

test('PATCH /api/admin/entries/{id} — 닉네임은 1~12자만 받고 없는 항목은 404다', async () => {
  const created = await postParticipant(asParticipant('phone-a', joinBody('처음이름')));
  const entry = (await created.json()) as Entry;

  const invalid = await patchAdminEntry(
    asOperator(`/api/admin/entries/${entry.id}`, { nickname: ' '.repeat(3) }),
    { params: Promise.resolve({ id: entry.id }) },
  );
  assert.equal(invalid.status, 400);
  assert.equal(((await invalid.json()) as ApiErrorBody).error.code, 'INVALID_NICKNAME');

  const missing = await patchAdminEntry(
    asOperator('/api/admin/entries/missing', { nickname: '새이름' }),
    { params: Promise.resolve({ id: 'missing' }) },
  );
  assert.equal(missing.status, 404);
});

test('PATCH /api/admin/entries/{id} — 메타데이터가 올라간 뒤에는 409로 거절한다', async () => {
  const created = await postParticipant(asParticipant('phone-a', joinBody('처음이름')));
  const entry = (await created.json()) as Entry;
  await postEntry(asParticipant('phone-a', photoBody()));
  await new Promise((resolve) => setTimeout(resolve, 3_300));

  const response = await patchAdminEntry(
    asOperator(`/api/admin/entries/${entry.id}`, { nickname: '늦은수정' }),
    { params: Promise.resolve({ id: entry.id }) },
  );
  assert.equal(response.status, 409);
  assert.equal(((await response.json()) as ApiErrorBody).error.code, 'ALREADY_SUBMITTED');
  assert.equal((await getAdminState()).entries[0].nickname, '처음이름');
});

test('POST /api/admin/reset — 기능을 끄면 404, 켜도 운영자 인증 없이는 401이다', async () => {
  const previous = process.env.ALLOW_DB_RESET;
  try {
    delete process.env.ALLOW_DB_RESET;
    const disabled = await resetAdmin(new Request('http://localhost/api/admin/reset', { method: 'POST' }));
    assert.equal(disabled.status, 404);

    process.env.ALLOW_DB_RESET = '1';
    const blocked = await resetAdmin(new Request('http://localhost/api/admin/reset', { method: 'POST' }));
    assert.equal(blocked.status, 401);
  } finally {
    if (previous === undefined) delete process.env.ALLOW_DB_RESET;
    else process.env.ALLOW_DB_RESET = previous;
  }
});

test('POST /api/admin/reset — 운영자가 명단을 지우고 삭제 건수를 받는다', async () => {
  const previous = process.env.ALLOW_DB_RESET;
  process.env.ALLOW_DB_RESET = '1';
  try {
    await postParticipant(asParticipant('phone-a', joinBody('가')));
    await postParticipant(asParticipant('phone-b', joinBody('나')));

    const response = await resetAdmin(asOperator('/api/admin/reset'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      deleted: { participants: 2, entries: 2 },
    });
    assert.equal((await getAdminState()).entries.length, 0);
  } finally {
    if (previous === undefined) delete process.env.ALLOW_DB_RESET;
    else process.env.ALLOW_DB_RESET = previous;
  }
});
