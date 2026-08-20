import { NextResponse } from 'next/server';

import type { StateResponse } from '@/lib/api/types';
import { getState } from '@/lib/server/store';

/** 행사장 TV가 반복해서 부른다. 캐시하지 않는다. */
export const dynamic = 'force-dynamic';

/**
 * **인증 없이 TV에서 열리는 응답이다.** 실패 사유·지갑 주소·DID가 섞이면 TV URL을 아는
 * 사람에게 그대로 샌다. 걸러내는 일은 `getState()`가 필드를 하나씩 적어서 하고,
 * 여기서는 그 결과를 그대로 내보낸다.
 */
export async function GET() {
  return NextResponse.json<StateResponse>(await getState());
}
