import { NextResponse } from 'next/server';

import type { Entry } from '@/lib/api/types';
import { blockNonOperator, fail, readPhoto } from '@/lib/server/http';
import { runPipelineAfterResponse } from '@/lib/server/pipeline';
import { attachPhoto } from '@/lib/server/store';

export const maxDuration = 60;

/**
 * 운영자 대리 업로드. 참가자가 사진을 못 올릴 때 운영자가 대신 올려 파이프라인을 시작한다.
 *
 * JOINED와 FAILED **둘 다** 받는다. 사진 자체가 문제였던 실패는 재시도로 풀리지 않고
 * 새 사진을 받아야 한다.
 *
 * 운영자 화면도 브라우저이므로 프레임 합성은 거기서 `lib/photo.ts`로 끝내서 보낸다.
 * 서버는 받은 바이트를 다시 그리지 않는다.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await blockNonOperator();
  if (blocked) return blocked;

  const { id } = await params;
  const read = await readPhoto(request);
  if ('error' in read) return read.error;

  const result = await attachPhoto(id, read.photo, { operator: true });
  if (!result.ok) {
    if (result.code === 'ALREADY_SUBMITTED') {
      return fail(result.code, '이미 사진이 올라간 참가자예요.');
    }
    if (result.code === 'SHOWCASE_FULL') return fail(result.code, '진열장이 다 찼어요.');
    return fail(result.code, '해당 참가자를 찾을 수 없어요.');
  }

  runPipelineAfterResponse(result.entry.id);
  return NextResponse.json<Entry>(result.entry, { status: 201 });
}
