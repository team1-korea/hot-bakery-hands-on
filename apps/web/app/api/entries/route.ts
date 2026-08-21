import { NextResponse } from 'next/server';

import type { Entry } from '@/lib/api/types';
import { didFrom } from '@/lib/server/auth';
import { fail, readPhoto } from '@/lib/server/http';
import { runPipelineAfterResponse } from '@/lib/server/pipeline';
import { attachPhoto, findEntryByDid } from '@/lib/server/store';
import { withoutFailureReason } from '@/lib/server/store.shared';

export const maxDuration = 60;

/**
 * 합성이 끝난 증서 한 장을 제출한다. `POST /api/participants`로 만들어 둔 JOINED 행을
 * SUBMITTED로 올리고 카드가 오븐으로 들어간다.
 *
 * **닉네임을 받지 않는다.** 등록 때 이미 받았다.
 */
export async function POST(request: Request) {
  const did = await didFrom(request);
  if (!did) return fail('UNAUTHENTICATED', '다시 로그인해 주세요.');

  const entry = await findEntryByDid(did);
  if (!entry) return fail('NOT_FOUND', '먼저 닉네임을 등록해 주세요.');

  const read = await readPhoto(request);
  if ('error' in read) return read.error;

  const result = await attachPhoto(entry.id, read.photo);
  if (!result.ok) {
    if (result.code === 'ALREADY_SUBMITTED') return fail(result.code, '이미 사진을 보냈어요.');
    if (result.code === 'SHOWCASE_FULL') {
      return fail(result.code, '오늘 진열장이 다 찼어요. 운영자에게 말씀해 주세요.');
    }
    return fail(result.code, '해당 참가자를 찾을 수 없어요.');
  }

  runPipelineAfterResponse(result.entry.id);
  return NextResponse.json<Entry>(withoutFailureReason(result.entry), { status: 201 });
}

/** 등록 후 참가자 폰이 3초마다 부른다. 아직 등록하지 않았으면 404가 아니라 200에 null이다. */
export async function GET(request: Request) {
  const did = await didFrom(request);
  if (!did) return fail('UNAUTHENTICATED', '다시 로그인해 주세요.');

  const entry = await findEntryByDid(did);
  return NextResponse.json<Entry | null>(entry ? withoutFailureReason(entry) : null);
}
