import { NextResponse } from 'next/server';

import type { StateResponse } from '@/lib/api/types';
import { getState } from '@/lib/server/store';

/** 행사장 TV가 반복해서 부른다. 캐시하지 않는다. */
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json<StateResponse>(getState());
}
