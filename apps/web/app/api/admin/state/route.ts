import { NextResponse } from 'next/server';

import type { AdminStateResponse } from '@/lib/api/adminTypes';
import { blockNonOperator } from '@/lib/server/http';
import { getAdminState } from '@/lib/server/store';

/** 운영자 화면이 1초마다 부른다. 캐시하지 않는다. */
export const dynamic = 'force-dynamic';

/**
 * 운영자 명단. 공개 `GET /api/state`와 **일부러 다른 엔드포인트**다.
 *
 * 같은 엔드포인트가 쿠키 여부로 다른 것을 뱉게 만들면 캐시 헤더 한 줄이나 CDN 설정
 * 하나만 잘못돼도 실패 사유와 지갑 주소가 TV URL로 그대로 샌다.
 */
export async function GET() {
  const blocked = await blockNonOperator();
  if (blocked) return blocked;

  return NextResponse.json<AdminStateResponse>(await getAdminState());
}
