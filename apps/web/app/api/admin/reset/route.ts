import { NextResponse } from 'next/server';

import { blockNonOperator, fail } from '@/lib/server/http';
import { resetAdminData, type ResetResult } from '@/lib/server/store';

export const maxDuration = 60;

/**
 * 준비 기간에만 쓰는 전체 초기화. 운영 배포에서는 환경변수를 빼 엔드포인트 자체를 숨긴다.
 */
export async function POST(request: Request) {
  if (process.env.ALLOW_DB_RESET !== '1') {
    return fail('NOT_FOUND', '테스트 데이터 초기화 기능이 꺼져 있어요.');
  }

  const blocked = await blockNonOperator(request);
  if (blocked) return blocked;

  try {
    return NextResponse.json<ResetResult>(await resetAdminData());
  } catch {
    return fail('INTERNAL', '테스트 데이터를 초기화하지 못했어요.');
  }
}
