import { NextResponse } from 'next/server';

import { fail } from '@/lib/server/http';
import { sweepPipeline } from '@/lib/server/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Supabase Cron(pg_cron + pg_net)이 부르는 내부 라우트. 비밀값이 비어 있으면 잠긴다.
 * 스케줄러는 `Authorization: Bearer <CRON_SECRET>`를 붙인다.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return fail('UNAUTHENTICATED', '내부 작업 인증이 필요합니다.');
  }

  return NextResponse.json(await sweepPipeline());
}

export const GET = handle;
export const POST = handle;
