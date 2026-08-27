import { createHash, randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import type { Entry } from '@/lib/api/types';
import { chainRuntime } from '@/lib/server/chain';
import { blockNonOperator, fail, readPhoto } from '@/lib/server/http';
import { runPipelineAfterResponse } from '@/lib/server/pipeline';
import { attachPhoto, deleteRehearsalRun, register } from '@/lib/server/store';

export const maxDuration = 60;
const RUN_ID = /^[0-9a-f]{8}$/;

/**
 * 배포된 Fuji 파이프라인과 TV 화면을 함께 보는 운영자 전용 리허설 입구.
 *
 * 일반 참가자 API의 Privy 인증을 느슨하게 만들지 않고, 운영자 세션·Fuji 확인 헤더·실제 서버
 * 체인을 모두 확인한 뒤 접근할 수 있다. 메인넷에서는 어떤 요청도 받지 않는다.
 */
export async function POST(request: Request) {
  const blocked = await blockNonOperator(request);
  if (blocked) return blocked;

  if (!isSafeFujiRehearsal(request)) {
    return fail('INVALID_REQUEST', '이 리허설은 Fuji 공개 RPC에서만 실행할 수 있어요.');
  }

  const runId = request.headers.get('x-bakery-rehearsal-run')?.trim() ?? '';
  if (!RUN_ID.test(runId)) return fail('INVALID_REQUEST', '리허설 실행 ID가 올바르지 않아요.');

  const nickname = new URL(request.url).searchParams.get('nickname')?.trim() ?? '';
  if (!nickname || nickname.length > 12) {
    return fail('INVALID_NICKNAME', '닉네임은 1~12자로 적어 주세요.');
  }

  const read = await readPhoto(request);
  if ('error' in read) return read.error;

  const rehearsalId = randomUUID();
  const walletHash = createHash('sha256')
    .update(`bakery-rehearsal:${runId}:${rehearsalId}`)
    .digest('hex');
  const registered = await register({
    privyDid: `did:privy:rehearsal-${runId}-${rehearsalId}`,
    walletAddress: `0x${walletHash.slice(0, 40)}`,
    nickname,
  });
  const result = await attachPhoto(registered.entry.id, read.photo, { operator: true });
  if (!result.ok) {
    if (result.code === 'SHOWCASE_FULL') return fail(result.code, '오늘 진열장이 다 찼어요.');
    if (result.code === 'ALREADY_SUBMITTED') return fail(result.code, '이미 사진을 보냈어요.');
    return fail(result.code, '리허설 참가자를 찾을 수 없어요.');
  }

  runPipelineAfterResponse(result.entry.id);
  return NextResponse.json<Entry>(result.entry, {
    status: 201,
    headers: { 'cache-control': 'no-store' },
  });
}

/** 리허설 한 번이 만든 DB 행과 Storage 이미지만 정리한다. 체인·IPFS 기록은 건드리지 않는다. */
export async function DELETE(request: Request) {
  const blocked = await blockNonOperator(request);
  if (blocked) return blocked;
  if (!isSafeFujiRehearsal(request)) {
    return fail('INVALID_REQUEST', '이 리허설은 Fuji 공개 RPC에서만 정리할 수 있어요.');
  }

  const body = await request.json().catch(() => null) as { runId?: unknown } | null;
  const runId = typeof body?.runId === 'string' ? body.runId.trim() : '';
  if (!RUN_ID.test(runId)) return fail('INVALID_REQUEST', '리허설 실행 ID가 올바르지 않아요.');

  try {
    const result = await deleteRehearsalRun(runId);
    if (!result.ok) {
      if (result.code === 'NOT_READY') {
        return fail('INVALID_REQUEST', '처리 중이거나 리허설 뒤에 들어온 카드가 있어 정리할 수 없어요.');
      }
      return fail('NOT_FOUND', '정리할 리허설 카드를 찾지 못했어요.');
    }
    return NextResponse.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return fail('INTERNAL', '리허설 데이터를 정리하지 못했어요. 운영자 명단을 확인해 주세요.');
  }
}

function isSafeFujiRehearsal(request: Request): boolean {
  return request.headers.get('x-bakery-rehearsal') === 'fuji'
    && chainRuntime.id === 43113
    && !chainRuntime.customRpc;
}
