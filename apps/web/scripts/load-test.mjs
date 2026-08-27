/**
 * 행사 리허설. 참가자가 몰리는 방식을 바꿔 가며 **끝까지 증서를 받는지**를 본다.
 *
 * 구글 로그인 **이후**만 본다. Privy는 목 인증으로 대신하므로(`PRIVY_APP_ID`와
 * `PRIVY_APP_SECRET`을 비운 채 서버를 띄우면 `x-dev-participant` 헤더 하나가 참가자 한 명이
 * 된다) 로그인 자체의 부하는 여기서 재지 않는다 — 그쪽은 Privy가 감당하는 몫이다.
 *
 * `--operator`를 주면 **운영자도 흉내낸다.** 실패한 카드를 보고 잠시 뒤 「재시도」를 누르고,
 * 오래 멈춘 카드가 보이면 「멈춘 작업 점검/복구」를 누른다. 행사장에서 실제로 하는 일이라,
 * 이걸 빼고 재면 "복구하면 되는 실패"와 "끝내 못 받는 실패"가 구분되지 않는다.
 *
 * **실제 자원을 쓴다.** Supabase DB와 Storage에 행과 파일이 쌓이고, Pinata에 핀이 올라가고,
 * 체인에 진짜 트랜잭션이 나간다. 테스트넷에서만 돌릴 것.
 *
 *   PRIVY_APP_ID= PRIVY_APP_SECRET= npx next dev --port 3100     # 다른 터미널에서
 *
 *   node scripts/load-test.mjs --count 20 --wave 20 --gap 0 --operator 5 --reset 1
 *   node scripts/load-test.mjs --count 20 --wave 1  --gap 1 --operator 5 --reset 1
 *
 * 사진을 주지 않으면 크기만 맞춘 바이트를 만들어 쓴다. 파이프라인의 어느 단계도 JPEG을
 * 디코딩하지 않으므로(멀티파트 파싱 → Storage 업로드 → Pinata 핀 → CID) 부하는 같지만,
 * TV 화면에는 깨진 그림으로 뜬다. 화면까지 같이 보려면 진짜 사진을 넘길 것.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import nextEnv from '@next/env';
import { createPublicClient, formatEther, http } from 'viem';
import { avalanche, avalancheFuji } from 'viem/chains';

nextEnv.loadEnvConfig(process.cwd());

const options = parseArguments(process.argv.slice(2));
const base = options.base ?? 'http://127.0.0.1:3000';
const count = Number(options.count ?? 30);
const photoBytes = Number(options.bytes ?? 350_000);
const pipelineTimeoutMs = Number(options.timeout ?? 300) * 1_000;
/** 한 번에 몇 명씩 던질지와 묶음 사이 간격. 기본은 전원 동시(최악의 경우). */
const waveSize = Number(options.wave ?? count);
const waveGapMs = Number(options.gap ?? 0) * 1_000;
/** 운영자가 실패를 알아채고 버튼을 누르기까지의 시간(초). 0이면 운영자가 없는 셈. */
const operatorDelayMs = Number(options.operator ?? 0) * 1_000;
/** 한 사람에게 몇 번까지 재시도해 줄지. 이걸 넘기면 "끝내 실패"로 센다. */
const maxRetries = Number(options.retries ?? 5);
const label = options.label ?? `${waveSize}명씩 ${waveGapMs / 1000}초 간격`;

/** 한 번 돌릴 때마다 참가자를 새로 만든다. 목 지갑 주소는 이름에서 나오므로, 이름을
 *  재활용하면 컨트랙트가 이미 발급한 주소로 보고 복구 경로로 새서 민팅을 재지 못한다. */
const runId = randomUUID().slice(0, 8);

const passcode = process.env.OPERATOR_PASSCODE;
if (!passcode) exit('OPERATOR_PASSCODE가 없습니다. 운영자 상태를 폴링할 수 없습니다.');
const operatorCookie = `bakery_operator=${createHash('sha256').update(`bakery-operator:${passcode}`).digest('hex')}`;

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || avalancheFuji.id;
const publicClient = createPublicClient({
  chain: chainId === avalanche.id ? avalanche : avalancheFuji,
  transport: http(process.env.AVALANCHE_RPC_URL),
});

// ---------------------------------------------------------------------------
// 준비
// ---------------------------------------------------------------------------

const template = options.photo ? await readFile(options.photo) : synthesizeJpeg(photoBytes);

if (options.reset) {
  const wiped = await fetch(`${base}/api/admin/reset`, { method: 'POST', headers: { cookie: operatorCookie } });
  if (!wiped.ok) exit(`초기화 실패 (${wiped.status}). ALLOW_DB_RESET=1인지 확인하세요.`);
  console.log(`초기화      ${JSON.stringify((await wiped.json()).deleted)}`);
}

const before = await adminState();
// 진열칸은 30개뿐이다. 이미 잡힌 칸이 있으면 그만큼 SHOWCASE_FULL로 튕겨서 부하를 못 잰다.
const taken = before.entries.filter((entry) => entry.shelfIndex !== null).length;
if (taken + count > 30) {
  exit(`진열칸이 ${taken}개 차 있어 ${count}명을 다 넣을 수 없습니다. --reset 1을 주거나 운영자 화면에서 초기화하세요.`);
}

const minterAddress = before.minter?.address;
const minterBefore = minterAddress
  ? {
      nonce: await publicClient.getTransactionCount({ address: minterAddress }),
      balance: await publicClient.getBalance({ address: minterAddress }),
    }
  : null;

console.log(`시나리오    ${label}`);
console.log(`참가자      ${count}명 (run ${runId})`);
console.log(`운영자      ${operatorDelayMs > 0 ? `있음 · 실패 확인 후 ${operatorDelayMs / 1000}초 뒤 재시도 (최대 ${maxRetries}회)` : '없음'}`);
console.log(`사진        ${(template.length / 1024).toFixed(0)} KB ${options.photo ? '(실사진)' : '(합성)'}`);
console.log(`민터        ${minterAddress ?? '(없음)'}${minterBefore ? ` · nonce ${minterBefore.nonce}` : ''}`);
console.log('');

// ---------------------------------------------------------------------------
// 1단계 등록
// ---------------------------------------------------------------------------

const participants = Array.from({ length: count }, (_, index) => ({
  index,
  identity: `load-${runId}-${index}`,
  nickname: `부하${String(index).padStart(2, '0')}`,
}));

const registered = await inWaves(participants, waveSize, waveGapMs, (participant) => timed(async () => {
  const response = await fetch(`${base}/api/participants`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dev-participant': participant.identity },
    body: JSON.stringify({ nickname: participant.nickname }),
  });
  return { status: response.status, body: await response.json() };
}));

report('1단계 등록  POST /api/participants', registered);

// ---------------------------------------------------------------------------
// 2단계 제출 — 참가자마다 자기가 낸 시각을 기록한다
// ---------------------------------------------------------------------------

const runStartedAt = Date.now();
/** entryId -> 그 사람이 사진을 낸 시각(ms, 리허설 시작 기준) */
const startedAt = new Map();

const submitted = await inWaves(participants, waveSize, waveGapMs, (participant) => timed(async () => {
  const form = new FormData();
  // 참가자마다 바이트를 다르게 만든다. 같으면 Pinata가 CID 하나로 합쳐 핀 부하가 사라진다.
  const bytes = withComment(template, participant.identity);
  form.set('photo', new File([bytes], 'certificate.jpg', { type: 'image/jpeg' }), 'certificate.jpg');

  const response = await fetch(`${base}/api/entries`, {
    method: 'POST',
    headers: { 'x-dev-participant': participant.identity },
    body: form,
  });
  const body = await response.json();
  if (body?.id) startedAt.set(body.id, Date.now() - runStartedAt);
  return { status: response.status, body };
}));

report('2단계 제출  POST /api/entries', submitted);

const shelves = submitted.map((result) => result.value?.body?.shelfIndex).filter((index) => index !== undefined && index !== null);
if (shelves.length > 0) {
  console.log(`  진열칸    ${shelves.length}개 배정 · 중복 ${shelves.length - new Set(shelves).size}개`);
}
// 이 스크립트가 만든 행만 따라간다. 다른 데이터가 섞여 있어도 집계가 흔들리지 않는다.
const mine = new Set(submitted.map((result) => result.value?.body?.id).filter(Boolean));
console.log('');

// ---------------------------------------------------------------------------
// 3단계 파이프라인 + 운영자
// ---------------------------------------------------------------------------

/** entryId -> MINTED가 처음 보인 시각(ms) */
const finishedAt = new Map();
/** entryId -> 운영자가 「재시도」를 누른 횟수 */
const retried = new Map();
/** entryId -> FAILED가 처음 보인 시각. 운영자 반응 시간을 재는 기준. */
const failedSince = new Map();
/** entryId -> 중간 상태로 머문 시각. 스위퍼를 누를지 판단한다. */
const pendingSince = new Map();
/** 운영자가 한 일을 시간순으로 남긴다. */
const actions = [];
let lastSweepAt = -Infinity;
let entries = [];

console.log(`3단계 파이프라인${operatorDelayMs > 0 ? ' (운영자 개입 포함)' : ''}`);

while (Date.now() - runStartedAt < pipelineTimeoutMs) {
  entries = (await adminState()).entries.filter((entry) => mine.has(entry.id));
  const now = Date.now() - runStartedAt;

  for (const entry of entries) {
    if (entry.status === 'MINTED' && !finishedAt.has(entry.id)) finishedAt.set(entry.id, now);
    if (entry.status === 'FAILED') {
      pendingSince.delete(entry.id);
      if (!failedSince.has(entry.id)) failedSince.set(entry.id, now);
    } else if (entry.status !== 'MINTED') {
      failedSince.delete(entry.id);
      if (!pendingSince.has(entry.id)) pendingSince.set(entry.id, now);
    }
  }

  if (operatorDelayMs > 0) {
    // ① 실패한 카드를 보고 잠시 뒤 「재시도」를 누른다.
    for (const entry of entries) {
      if (entry.status !== 'FAILED') continue;
      const since = failedSince.get(entry.id);
      if (since === undefined || now - since < operatorDelayMs) continue;
      if ((retried.get(entry.id) ?? 0) >= maxRetries) continue;

      const attempt = (retried.get(entry.id) ?? 0) + 1;
      const pressed = await fetch(`${base}/api/admin/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { cookie: operatorCookie, 'content-type': 'application/json' },
        body: JSON.stringify({ retry: true }),
      });
      retried.set(entry.id, attempt);
      failedSince.delete(entry.id);
      actions.push({ at: now, what: `재시도 ${entry.nickname} (${attempt}회) → ${pressed.status}` });
    }

    // ② 오래 멈춘 카드가 있으면 「멈춘 작업 점검/복구」를 누른다.
    //    재시도는 FAILED에만 듣기 때문에, 중간 상태로 멈춘 카드는 먼저 이걸로 내려야 한다.
    const longStuck = entries.some((entry) => {
      const since = pendingSince.get(entry.id);
      return since !== undefined && now - since > 100_000;
    });
    if (longStuck && now - lastSweepAt > 30_000) {
      lastSweepAt = now;
      const swept = await fetch(`${base}/api/admin/sweep`, { method: 'POST', headers: { cookie: operatorCookie } });
      actions.push({ at: now, what: `멈춘 작업 점검/복구 → ${JSON.stringify(await swept.json())}` });
    }
  }

  process.stdout.write(`\r  ${elapsed(now)}  ${JSON.stringify(countBy(entries, (entry) => entry.status))}          `);

  const settled = entries.filter((entry) => (
    entry.status === 'MINTED' ||
    (entry.status === 'FAILED' && (retried.get(entry.id) ?? 0) >= maxRetries)
  )).length;
  if (settled >= mine.size) break;

  await sleep(2_000);
}
console.log('\n');

// ---------------------------------------------------------------------------
// 결과
// ---------------------------------------------------------------------------

if (actions.length > 0) {
  console.log('운영자가 한 일');
  for (const action of actions) console.log(`  ${elapsed(action.at)}  ${action.what}`);
  console.log('');
}

console.log('참가자별  제출 → 완료 (걸린 시간)');
const rows = [...entries].sort((left, right) => (startedAt.get(left.id) ?? 0) - (startedAt.get(right.id) ?? 0));
for (const entry of rows) {
  const start = startedAt.get(entry.id) ?? 0;
  const end = finishedAt.get(entry.id);
  const helps = retried.get(entry.id) ?? 0;
  const took = end === undefined ? '   —  ' : `${((end - start) / 1000).toFixed(1)}s`.padStart(6);
  const mark = entry.status === 'MINTED' ? `#${entry.tokenId}` : `${entry.status} ← 끝내 실패`;
  console.log(
    `  ${entry.nickname}  ${(start / 1000).toFixed(1).padStart(5)}s → ${end === undefined ? '    —' : `${(end / 1000).toFixed(1).padStart(5)}s`}` +
    `  (${took}${helps > 0 ? `, 개입 ${helps}회` : ''})  ${mark}`,
  );
}
console.log('');

const minted = entries.filter((entry) => entry.status === 'MINTED');
const lost = entries.filter((entry) => entry.status !== 'MINTED');
const waits = minted.map((entry) => (finishedAt.get(entry.id) ?? 0) - (startedAt.get(entry.id) ?? 0));
const helped = [...retried.values()].filter((n) => n > 0).length;

console.log(`증서 받음   ${minted.length}/${mine.size}${waits.length ? `  참가자 체감 ${summarize(waits)}` : ''}`);
console.log(`운영자 개입 ${helped}명에게 총 ${[...retried.values()].reduce((a, b) => a + b, 0)}회`);
console.log(`끝내 실패   ${lost.length}${lost.length ? `  (${lost.map((e) => e.nickname).join(', ')})` : ''}`);
for (const [reason, howMany] of Object.entries(countBy(lost, (entry) => String(entry.failureReason ?? '(사유 없음)').split('\n')[0].slice(0, 80)))) {
  console.log(`  ${howMany}건 · ${reason}`);
}
if (finishedAt.size > 0) {
  console.log(`전체 소요   ${elapsed(Math.max(...finishedAt.values()))} (마지막 사람이 증서를 받은 시각)`);
}

if (minterBefore && minterAddress) {
  const nonce = await publicClient.getTransactionCount({ address: minterAddress });
  const balance = await publicClient.getBalance({ address: minterAddress });
  console.log(`민터        nonce +${nonce - minterBefore.nonce} · 가스 ${formatEther(minterBefore.balance - balance)} AVAX`);
}

// ---------------------------------------------------------------------------

async function adminState() {
  const response = await fetch(`${base}/api/admin/state`, { headers: { cookie: operatorCookie } });
  if (!response.ok) exit(`운영자 상태 조회 실패 (${response.status}). OPERATOR_PASSCODE가 서버와 같은지 확인하세요.`);
  return response.json();
}

/** 던지는 것까지 결과로 잡는다. 하나가 터져서 Promise.all이 통째로 죽으면 부하를 못 잰다. */
async function timed(run) {
  const startedTimer = Date.now();
  try {
    const value = await run();
    return { ms: Date.now() - startedTimer, value };
  } catch (error) {
    return { ms: Date.now() - startedTimer, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * `size`명씩 묶어 동시에 던지고, 묶음 **시작 시각**을 `gapMs`만큼 벌린다.
 *
 * 앞 묶음이 끝나기를 기다리지 않는다. 행사장에서도 앞사람 발행이 끝나기 전에 뒷사람이
 * 누르므로, 기다리면 실제보다 순한 부하가 된다.
 */
async function inWaves(items, size, gapMs, run) {
  const inFlight = [];
  for (let start = 0; start < items.length; start += size) {
    inFlight.push(...items.slice(start, start + size).map(run));
    if (start + size < items.length && gapMs > 0) await sleep(gapMs);
  }
  return Promise.all(inFlight);
}

function report(title, results) {
  const ok = results.filter((result) => result.value && result.value.status < 400);
  const bad = results.filter((result) => !result.value || result.value.status >= 400);
  console.log(title);
  console.log(`  성공      ${ok.length}/${results.length}  ${summarize(results.map((result) => result.ms))}`);
  for (const [reason, howMany] of Object.entries(countBy(bad, describeFailure))) {
    console.log(`  실패      ${howMany}건 · ${reason}`);
  }
}

function describeFailure(result) {
  if (result.error) return `요청 자체 실패: ${result.error}`;
  return `${result.value.status} ${result.value.body?.error?.code ?? ''} ${result.value.body?.error?.message ?? ''}`.trim();
}

function summarize(samples) {
  if (samples.length === 0) return '';
  const sorted = [...samples].sort((left, right) => left - right);
  const at = (ratio) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  return `p50 ${(at(0.5) / 1000).toFixed(1)}s · p95 ${(at(0.95) / 1000).toFixed(1)}s · max ${(sorted.at(-1) / 1000).toFixed(1)}s`;
}

function countBy(items, key) {
  const tally = {};
  for (const item of items) tally[key(item)] = (tally[key(item)] ?? 0) + 1;
  return tally;
}

/**
 * JPEG COM 세그먼트(0xFFFE)를 SOI 바로 뒤에 끼워 참가자마다 다른 바이트로 만든다.
 * 주석이라 그림은 그대로고 길이만 몇 바이트 늘어난다.
 */
function withComment(jpeg, text) {
  const payload = Buffer.from(text, 'utf8');
  const marker = Buffer.alloc(4);
  marker.writeUInt16BE(0xfffe, 0);
  marker.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), marker, payload, jpeg.subarray(2)]);
}

/** 진짜 사진이 없을 때 크기만 맞춘 바이트. 헤더와 EOI만 진짜고 안은 난수다. */
function synthesizeJpeg(size) {
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const end = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([header, randomBytes(Math.max(0, size - header.length - end.length)), end]);
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 2) {
    parsed[argv[index].replace(/^--/, '')] = argv[index + 1];
  }
  return parsed;
}

function elapsed(ms) {
  return `${String(Math.floor(ms / 1000)).padStart(3)}s`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exit(message) {
  console.error(message);
  process.exit(1);
}
