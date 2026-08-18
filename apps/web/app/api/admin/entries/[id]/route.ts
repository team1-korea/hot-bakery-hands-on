import { NextResponse } from 'next/server';

import type { Entry } from '@/lib/api/types';
import { blockNonOperator, fail } from '@/lib/server/http';
import { retryEntry, setHidden } from '@/lib/server/store';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await blockNonOperator();
  if (blocked) return blocked;

  const { id } = await params;
  const body = (await request.json()) as { hidden?: boolean; retry?: boolean };

  const entry = body.retry ? retryEntry(id) : setHidden(id, Boolean(body.hidden));
  if (!entry) return fail('NOT_FOUND', '해당 참가자를 찾을 수 없어요.');

  return NextResponse.json<Entry>(entry);
}
