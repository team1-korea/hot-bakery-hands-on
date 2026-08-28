#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import nextEnv from '@next/env';

const FUJI_CHAIN_ID = 43113;
const DEFAULT_COUNT = 6;
const PROCESSING_STATUSES = new Set(['SUBMITTED', 'PINNED', 'MINTING']);
const options = parseArguments(process.argv.slice(2));

if (options.help) {
  usage();
  process.exit(0);
}
if (options.confirm !== 'fuji') {
  fail('실제 Supabase·Storage·Pinata·Fuji 자원을 사용합니다. --confirm fuji를 명시하세요.');
}

const count = integerOption('count', options.count, DEFAULT_COUNT, 1, 6);
const operatorDelayMs = integerOption('operator', options.operator, 5, 0, 3_600) * 1_000;
const timeoutMs = integerOption('timeout', options.timeout, 360, 1, 3_600) * 1_000;
const cleanupMode = cleanupOption(options.cleanup);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, '..');
const photoPath = path.resolve(webRoot, options.photo ?? 'tests/fixtures/certificate-frame.jpg');

if (!existsSync(photoPath)) fail(`화면에 표시할 JPEG을 찾지 못했습니다: ${photoPath}`);

const environment = localEnvironment(webRoot);
const passcode = environment.OPERATOR_PASSCODE?.trim();
if (!passcode) {
  fail('apps/web/.env.local 또는 현재 셸에 OPERATOR_PASSCODE를 설정하세요. 비밀번호를 인자로 받지는 않습니다.');
}

const displayUrl = resolveDisplayUrl(options.display, environment);
const cookie = await login(displayUrl, passcode);
const initialState = await adminState(displayUrl, cookie);
assertFuji(initialState);

const occupied = initialState.entries.filter((entry) => entry.shelfIndex !== null).length;
if (occupied + count > 30) {
  fail(`진열칸이 ${occupied}개 차 있어 ${count}건을 추가할 수 없습니다. 기존 데이터를 먼저 정리하세요.`);
}

const photo = await readFile(photoPath);
if (photo[0] !== 0xff || photo[1] !== 0xd8) {
  fail(`리허설 이미지는 JPEG이어야 합니다: ${photoPath}`);
}

console.log(`배포 화면    ${displayUrl}`);
console.log(`현재 상태    진열칸 ${occupied}/30 · 신규 ${count}건 추가 · 기존 데이터 유지`);
console.log(`제출 방식    ${count}건 동시 제출 · 운영자 복구 ${operatorDelayMs / 1000}초`);
console.log('');

const opened = openBrowser(displayUrl);
if (!opened) console.log('브라우저를 자동으로 열지 못했습니다. 위 주소를 직접 여세요.');
await waitUntilViewerIsReady();

const runId = randomUUID().slice(0, 8);
console.log(`실행 ID      ${runId}`);
const startedAt = Date.now();
const submissions = await Promise.all(Array.from({ length: count }, async (_, index) => {
  const nickname = `부하${String(index).padStart(2, '0')}`;
  const bytes = withJpegComment(photo, `${runId}-${index}`);
  const form = new FormData();
  form.set('photo', new File([bytes], 'certificate.jpg', { type: 'image/jpeg' }));

  const url = new URL('/api/admin/rehearsal', displayUrl);
  url.searchParams.set('nickname', nickname);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      cookie,
      'x-bakery-rehearsal': 'fuji',
      'x-bakery-rehearsal-run': runId,
    },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.json().catch(() => null);
  return { nickname, response, body };
}));

const accepted = submissions.filter(({ response }) => response.ok);
if (accepted.length === 0 && submissions.every(({ response }) => response.status === 404)) {
  fail('현재 배포본에 리허설 API가 없습니다. 이 변경을 배포한 뒤 다시 실행하세요.');
}
for (const rejected of submissions.filter(({ response }) => !response.ok)) {
  console.error(
    `제출 실패    ${rejected.nickname} · ${rejected.response.status} `
    + `${rejected.body?.error?.code ?? ''} ${rejected.body?.error?.message ?? ''}`.trim(),
  );
}
console.log(`동시 제출    ${accepted.length}/${count}건 접수`);

const ids = new Set(accepted.map(({ body }) => body.id).filter(Boolean));
const failedSince = new Map();
const retries = new Map();
let lastSweepAt = -Infinity;
let entries = [];

while (Date.now() - startedAt < timeoutMs && ids.size > 0) {
  const state = await adminState(displayUrl, cookie);
  entries = state.entries.filter((entry) => ids.has(entry.id));
  const now = Date.now();

  for (const entry of entries) {
    if (entry.status !== 'FAILED') {
      failedSince.delete(entry.id);
      continue;
    }

    const since = failedSince.get(entry.id) ?? now;
    failedSince.set(entry.id, since);
    const attempts = retries.get(entry.id) ?? 0;
    if (now - since >= operatorDelayMs && attempts < 5) {
      const response = await fetch(new URL(`/api/admin/entries/${entry.id}`, displayUrl), {
        method: 'PATCH',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ retry: true }),
        signal: AbortSignal.timeout(60_000),
      });
      retries.set(entry.id, attempts + 1);
      failedSince.delete(entry.id);
      console.log(`운영자 복구  ${entry.nickname} 재시도 ${attempts + 1}회 → ${response.status}`);
    }
  }

  const counts = countBy(entries, (entry) => entry.status);
  process.stdout.write(`\r진행 ${elapsed(Date.now() - startedAt)}  ${JSON.stringify(counts)}          `);
  const complete = entries.length === ids.size && entries.every((entry) => entry.status === 'MINTED');
  const exhausted = entries.length === ids.size && entries.every((entry) => (
    entry.status === 'MINTED'
    || (entry.status === 'FAILED' && (retries.get(entry.id) ?? 0) >= 5)
  ));
  if (complete || exhausted) break;

  const stuck = entries.some((entry) => (
    PROCESSING_STATUSES.has(entry.status)
    && now - Date.parse(entry.statusChangedAt) >= 100_000
  ));
  if (stuck && now - lastSweepAt >= 30_000) {
    lastSweepAt = now;
    await fetch(new URL('/api/admin/sweep', displayUrl), {
      method: 'POST',
      headers: { cookie },
      signal: AbortSignal.timeout(60_000),
    });
  }
  await sleep(2_000);
}
process.stdout.write('\n');

const minted = entries.filter((entry) => entry.status === 'MINTED');
for (const entry of [...entries].sort((left, right) => left.shelfIndex - right.shelfIndex)) {
  console.log(
    `결과         ${entry.nickname} · ${entry.status}`
    + `${entry.tokenId ? ` · #${entry.tokenId}` : ''}`
    + `${entry.shelfIndex !== null ? ` · 진열칸 ${entry.shelfIndex + 1}` : ''}`,
  );
}
console.log('');
console.log(`완료         ${minted.length}/${count}건 민팅 · ${displayUrl}`);
console.log('             브라우저에서 최종 진열 상태를 확인하세요.');

if (await shouldCleanup(cleanupMode)) {
  const response = await fetch(new URL('/api/admin/rehearsal', displayUrl), {
    method: 'DELETE',
    headers: {
      cookie,
      'content-type': 'application/json',
      'x-bakery-rehearsal': 'fuji',
    },
    body: JSON.stringify({ runId }),
    signal: AbortSignal.timeout(60_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(
      `정리 실패    ${response.status} ${result?.error?.code ?? ''} ${result?.error?.message ?? ''}`.trim(),
    );
    process.exitCode = 1;
  } else {
    console.log(
      `정리 완료    DB 참가자 ${result.deleted.participants} · 항목 ${result.deleted.entries}`
      + ` · Storage ${result.deleted.photos}`,
    );
    console.log('             /display와 /admin에서 사라졌고 진열칸을 반환했습니다.');
  }
} else {
  console.log(`정리 보류    실행 ID ${runId}의 테스트 데이터가 DB·Storage와 화면에 남아 있습니다.`);
}

if (accepted.length !== count || minted.length !== count) process.exitCode = 1;

function localEnvironment(directory) {
  const quietLog = { info() {}, error() {} };
  const { combinedEnv } = nextEnv.loadEnvConfig(directory, true, quietLog, true);
  return combinedEnv;
}

function resolveDisplayUrl(override, environmentValues) {
  const configured = override?.trim()
    || environmentValues.NEXT_PUBLIC_SITE_URL?.trim()
    || 'https://avalanche-bakery.vercel.app';
  let url;
  try {
    url = new URL('/display', configured);
  } catch {
    fail(`배포 주소가 올바르지 않습니다: ${configured}`);
  }
  if (url.protocol !== 'https:') fail(`배포 화면은 HTTPS 주소여야 합니다: ${url}`);
  return url.toString();
}

async function login(display, operatorPasscode) {
  const response = await fetch(new URL('/api/admin/session', display), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ passcode: operatorPasscode }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`배포된 운영자 로그인에 실패했습니다(${response.status}).`);
  const setCookie = response.headers.getSetCookie?.()[0] ?? response.headers.get('set-cookie');
  const sessionCookie = setCookie?.split(';', 1)[0];
  if (!sessionCookie) throw new Error('배포된 운영자 세션 쿠키를 받지 못했습니다.');
  return sessionCookie;
}

async function adminState(display, sessionCookie) {
  const response = await fetch(new URL('/api/admin/state', display), {
    headers: { cookie: sessionCookie },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`배포된 운영자 상태를 확인하지 못했습니다(${response.status}).`);
  return response.json();
}

function assertFuji(state) {
  if (state.chain?.id !== FUJI_CHAIN_ID || state.chain.customRpc) {
    fail(
      `이 리허설은 Fuji 공개 RPC에서만 실행합니다: chain=${state.chain?.id ?? 'unknown'}, `
      + `customRpc=${String(state.chain?.customRpc)}`,
    );
  }
}

function withJpegComment(jpeg, text) {
  const payload = Buffer.from(text, 'utf8');
  const marker = Buffer.alloc(4);
  marker.writeUInt16BE(0xfffe, 0);
  marker.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), marker, payload, jpeg.subarray(2)]);
}

function openBrowser(url) {
  const command = process.platform === 'darwin'
    ? ['open', [url]]
    : process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  const result = spawnSync(command[0], command[1], { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

async function waitUntilViewerIsReady() {
  if (!process.stdin.isTTY) {
    console.log('화면 준비    8초 뒤 동시 제출을 시작합니다.');
    await sleep(8_000);
    return;
  }

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    await prompt.question('화면 준비    브라우저에서 /display가 보이면 Enter를 누르세요. ');
  } finally {
    prompt.close();
  }
}

async function shouldCleanup(mode) {
  if (mode === 'delete') return true;
  if (mode === 'keep') return false;
  if (!process.stdin.isTTY) return false;

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(
      '정리 확인    확인을 마쳤으면 Enter를 눌러 이번 6건을 DB·Storage·화면에서 지우세요. '
      + '남기려면 keep 입력: ',
    );
    return answer.trim().toLowerCase() !== 'keep';
  } finally {
    prompt.close();
  }
}

function parseArguments(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help') {
      parsed.help = true;
      continue;
    }
    if (![
      '--confirm',
      '--count',
      '--operator',
      '--timeout',
      '--photo',
      '--display',
      '--cleanup',
    ].includes(token)) {
      fail(`알 수 없는 옵션입니다: ${token}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`${token} 값이 없습니다.`);
    parsed[token.slice(2)] = value;
    index += 1;
  }
  return parsed;
}

function cleanupOption(raw) {
  const value = raw ?? 'ask';
  if (!['ask', 'delete', 'keep'].includes(value)) {
    fail(`--cleanup은 ask, delete, keep 중 하나여야 합니다: ${value}`);
  }
  return value;
}

function integerOption(name, raw, fallback, minimum, maximum) {
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail(`--${name}는 ${minimum}~${maximum} 범위의 정수여야 합니다: ${raw ?? fallback}`);
  }
  return value;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

function elapsed(milliseconds) {
  return `${String(Math.floor(milliseconds / 1000)).padStart(3)}s`;
}

function usage() {
  console.log('배포된 /display를 열고 운영자 인증으로 Fuji NFT를 동시에 발행합니다.');
  console.log('');
  console.log('npm run rehearse:display -- --confirm fuji');
  console.log('npm run rehearse:display -- --confirm fuji --count 6 --photo ./my-certificate.jpg');
  console.log('npm run rehearse:display -- --confirm fuji --cleanup delete');
  console.log('');
  console.log('기본값: 6건 동시 제출, 운영자 복구 5초, 최대 360초 대기, 종료 뒤 정리 여부 확인');
}

function fail(message) {
  console.error(message);
  console.error('사용법: npm run rehearse:display -- --confirm fuji [--count 6] [--photo ./image.jpg]');
  process.exit(1);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
