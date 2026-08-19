import { NextResponse } from 'next/server';

import type { ShowState } from '@/lib/api/types';
import { blockNonOperator } from '@/lib/server/http';
import { updateShow } from '@/lib/server/store';

export async function PATCH(request: Request) {
  const blocked = await blockNonOperator();
  if (blocked) return blocked;

  const body = (await request.json()) as Partial<ShowState>;
  return NextResponse.json<ShowState>(updateShow(body));
}
