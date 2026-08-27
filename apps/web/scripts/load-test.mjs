/**
 * 동시 제출 부하 시험. 행사 당일 참가자가 **같은 순간에** 사진을 내는 최악의 경우를 만든다.
 *
 * 구글 로그인 **이후**만 본다. Privy는 목 인증으로 대신하므로(`PRIVY_APP_ID`와
 * `PRIVY_APP_SECRET`을 비운 채 서버를 띄우면 `x-dev-participant` 헤더 하나가 참가자 한 명이
 * 된다) 로그인 자체의 부하는 여기서 재지 않는다 — 그쪽은 Privy가 감당하는 몫이다.
 *
 * **실제 자원을 쓴다.** Supabase DB와 Storage에 행과 파일이 쌓이고, Pinata에 핀이 올라가고,
 * 체인에 진짜 트랜잭션이 나간다. 테스트넷에서만 돌릴 것.
 *
 *   PRIVY_APP_ID= PRIVY_APP_SECRET= npm start          # 다른 터미널에서
 *   node scripts/load-test.mjs --count 30 --photo ~/cert.jpg
 *   node scripts/load-test.mjs --count 20 --wave 5 --gap 1    # 5명씩 1초 간격
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

const before = await adminState();
// 진열칸은 30개뿐이다. 이미 잡힌 칸이 있으면 그만큼 SHOWCASE_FULL로 튕겨서 부하를 못 잰다.
const taken = before.entries.filter((entry) => entry.shelfIndex !== null).length;
if (taken + count > 30) {
  exit(`진열칸이 ${taken}개 차 있어 ${count}명을 다 넣을 수 없습니다. 운영자 화면에서 초기화한 뒤 돌리세요.`);
}

const minterAddress = before.minter?.address;
const minterBefore = minterAddress
  ? {
      nonce: await publicClient.getTransactionCount({ address: minterAddress }),
      balance: await publicClient.getBalance({ address: minterAddress }),
    }
  : null;

console.log(`대상        ${base}`);
console.log(`참가자      ${count}명 (run ${runId})`);
console.log(`던지는 법   ${waveSize}명씩 동시 · 묶음 간격 ${waveGapMs / 1000}초`);
console.log(`사진        ${(template.length / 1024).toFixed(0)} KB ${options.photo ? `(${options.photo})` : '(합성)'}`);
console.log(`민터        ${minterAddress ?? '(없음)'}${minterBefore ? ` · nonce ${minterBefore.nonce} · ${formatEther(minterBefore.balance)} AVAX` : ''}`);
console.log('');

// ---------------------------------------------------------------------------
// 1단계 등록 — 30명이 동시에 닉네임을 낸다
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
// 2단계 제출 — 등록을 다 끝낸 뒤, 30장을 같은 순간에 던진다
// ---------------------------------------------------------------------------

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
  return { status: response.status, body: await response.json() };
}));

report('2단계 제출  POST /api/entries', submitted);

const shelves = submitted.map((result) => result.value?.body?.shelfIndex).filter((index) => index !== undefined && index !== null);
if (shelves.length > 0) {
  console.log(`  진열칸    ${shelves.length}개 배정 · 중복 ${shelves.length - new Set(shelves).size}개 · 범위 ${Math.min(...shelves)}~${Math.max(...shelves)}`);
}
// 이 스크립트가 만든 행만 따라간다. 다른 데이터가 섞여 있어도 집계가 흔들리지 않는다.
const mine = new Set(submitted.map((result) => result.value?.body?.id).filter(Boolean));
console.log('');

// ---------------------------------------------------------------------------
// 3단계 파이프라인 — MINTED 또는 FAILED로 떨어질 때까지 운영자 화면을 폴링한다
// ---------------------------------------------------------------------------

const submittedAt = Date.now();
const firstSeen = new Map(); // entryId -> { status: ms }
let entries = [];

console.log('3단계 파이프라인 (핀 → 민팅 → 영수증)');
while (Date.now() - submittedAt < pipelineTimeoutMs) {
  const state = await adminState();
  entries = state.entries.filter((entry) => mine.has(entry.id));

  for (const entry of entries) {
    const seen = firstSeen.get(entry.id) ?? {};
    if (seen[entry.status] === undefined) seen[entry.status] = Date.now() - submittedAt;
    firstSeen.set(entry.id, seen);
  }

  const tally = count_by(entries, (entry) => entry.status);
  const done = entries.filter((entry) => entry.status === 'MINTED' || entry.status === 'FAILED').length;
  process.stdout.write(`\r  ${elapsed(submittedAt)}  ${JSON.stringify(tally)}          `);
  if (done >= mine.size) break;

  await sleep(2_000);
}
console.log('');
console.log('');

// ---------------------------------------------------------------------------
// 결과
// ---------------------------------------------------------------------------

const minted = entries.filter((entry) => entry.status === 'MINTED');
const failed = entries.filter((entry) => entry.status === 'FAILED');
const stuck = entries.filter((entry) => entry.status !== 'MINTED' && entry.status !== 'FAILED');

const durations = minted.map((entry) => firstSeen.get(entry.id)?.MINTED).filter((ms) => ms !== undefined);
console.log(`MINTED      ${minted.length}/${mine.size}${durations.length ? `  ${summarize(durations)}` : ''}`);
console.log(`FAILED      ${failed.length}`);
if (stuck.length > 0) console.log(`중간 상태   ${stuck.length}  ${JSON.stringify(count_by(stuck, (entry) => entry.status))}`);

for (const [reason, howMany] of Object.entries(count_by(failed, (entry) => String(entry.failureReason ?? '(사유 없음)').split('\n')[0].slice(0, 90)))) {
  console.log(`  실패      ${howMany}건 · ${reason}`);
}

const tokenIds = minted.map((entry) => entry.tokenId);
const txHashes = minted.map((entry) => entry.txHash);
console.log(`tokenId     ${tokenIds.length}개 · 중복 ${tokenIds.length - new Set(tokenIds).size}개`);
console.log(`txHash      ${new Set(txHashes).size}개 (서로 다른 트랜잭션)`);

if (minterBefore && minterAddress) {
  const nonce = await publicClient.getTransactionCount({ address: minterAddress });
  const balance = await publicClient.getBalance({ address: minterAddress });
  console.log(`민터 nonce  ${minterBefore.nonce} → ${nonce}  (+${nonce - minterBefore.nonce}, 성공한 민팅 ${minted.length}건)`);
  console.log(`가스 사용   ${formatEther(minterBefore.balance - balance)} AVAX · 잔액 ${formatEther(balance)} AVAX`);
}

// ---------------------------------------------------------------------------
// 4단계 정원 초과 — 31번째는 SHOWCASE_FULL로 막혀야 한다
// ---------------------------------------------------------------------------

if (taken + shelves.length >= 30) {
  const identity = `load-${runId}-overflow`;
  await fetch(`${base}/api/participants`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dev-participant': identity },
    body: JSON.stringify({ nickname: '정원초과' }),
  });

  const form = new FormData();
  form.set('photo', new File([withComment(template, identity)], 'certificate.jpg', { type: 'image/jpeg' }), 'certificate.jpg');
  const response = await fetch(`${base}/api/entries`, {
    method: 'POST',
    headers: { 'x-dev-participant': identity },
    body: form,
  });
  const body = await response.json();
  console.log(`정원 초과   ${response.status} ${body?.error?.code ?? ''} — ${body?.error?.code === 'SHOWCASE_FULL' ? 'OK' : '기대와 다름'}`);
}

// ---------------------------------------------------------------------------

async function adminState() {
  const response = await fetch(`${base}/api/admin/state`, { headers: { cookie: operatorCookie } });
  if (!response.ok) exit(`운영자 상태 조회 실패 (${response.status}). OPERATOR_PASSCODE가 서버와 같은지 확인하세요.`);
  return response.json();
}

/** 던지는 것까지 결과로 잡는다. 하나가 터져서 Promise.all이 통째로 죽으면 부하를 못 잰다. */
async function timed(run) {
  const startedAt = Date.now();
  try {
    const value = await run();
    return { ms: Date.now() - startedAt, value };
  } catch (error) {
    return { ms: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) };
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

function report(label, results) {
  const ok = results.filter((result) => result.value && result.value.status < 400);
  const bad = results.filter((result) => !result.value || result.value.status >= 400);
  console.log(`${label}`);
  console.log(`  성공      ${ok.length}/${results.length}  ${summarize(results.map((result) => result.ms))}`);
  for (const [reason, howMany] of Object.entries(count_by(bad, describeFailure))) {
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

function count_by(items, key) {
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

function elapsed(since) {
  return `${String(Math.floor((Date.now() - since) / 1000)).padStart(3)}s`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exit(message) {
  console.error(message);
  process.exit(1);
}
