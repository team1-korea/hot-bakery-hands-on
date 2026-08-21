import { NextResponse } from 'next/server';

import type { Entry } from '@/lib/api/types';
import { blockNonOperator, fail } from '@/lib/server/http';
import { runPipelineAfterResponse } from '@/lib/server/pipeline';
import { retryEntry, setHidden, updateNickname } from '@/lib/server/store';

export const maxDuration = 60;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await blockNonOperator(request);
  if (blocked) return blocked;

  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    hidden?: unknown;
    retry?: unknown;
    nickname?: unknown;
  } | null;

  if (!body || typeof body !== 'object') {
    return fail('INVALID_REQUEST', '조작 내용을 확인해 주세요.');
  }

  if ('nickname' in body) {
    if (typeof body.nickname !== 'string') {
      return fail('INVALID_NICKNAME', '닉네임은 1~12자로 적어 주세요.');
    }
    const nickname = body.nickname.trim();
    if (!nickname || nickname.length > 12) {
      return fail('INVALID_NICKNAME', '닉네임은 1~12자로 적어 주세요.');
    }

    const result = await updateNickname(id, nickname);
    if (!result.ok) {
      if (result.code === 'ALREADY_SUBMITTED') {
        return fail(result.code, '이미 메타데이터를 올려 닉네임을 바꿀 수 없어요.');
      }
      return fail(result.code, '해당 참가자를 찾을 수 없어요.');
    }
    return NextResponse.json<Entry>(result.entry);
  }

  let entry: Entry | null;
  if (body.retry === true) entry = await retryEntry(id);
  else if (typeof body.hidden === 'boolean') entry = await setHidden(id, body.hidden);
  else return fail('INVALID_REQUEST', '조작 내용을 확인해 주세요.');
  if (!entry) return fail('NOT_FOUND', '해당 참가자를 찾을 수 없어요.');

  if (body.retry === true) runPipelineAfterResponse(entry.id);
  return NextResponse.json<Entry>(entry);
}
