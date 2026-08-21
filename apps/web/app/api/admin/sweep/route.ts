import { NextResponse } from 'next/server';

import { blockNonOperator, fail } from '@/lib/server/http';
import { sweepPipeline, type SweepResult } from '@/lib/server/pipeline';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * 행사 운영자가 CLI 없이 멈춘 항목을 점검·복구한다.
 *
 * 자동 cron과 같은 안전한 경로를 공유한다. MINTING은 영수증과 온체인 이벤트를
 * 먼저 확인해 MINTED로 복구하고, RPC 조회 자체가 실패하면 FAILED로 내리지 않는다.
 * DB advisory lock 덕분에 cron이나 중복 클릭과 겹쳐도 한 번만 실행된다.
 */
export async function POST(request: Request) {
  const blocked = await blockNonOperator(request);
  if (blocked) return blocked;

  try {
    return NextResponse.json<SweepResult>(await sweepPipeline(), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return fail('INTERNAL', '멈춘 작업을 점검하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  }
}
