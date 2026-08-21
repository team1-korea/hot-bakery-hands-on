import { NextResponse } from 'next/server';

import type { Entry } from '@/lib/api/types';
import { WalletNotFoundError, callerFrom } from '@/lib/server/auth';
import { fail } from '@/lib/server/http';
import { register } from '@/lib/server/store';
import { withoutFailureReason } from '@/lib/server/store.shared';

/**
 * 등록. 구글 로그인을 마치고 닉네임을 넣은 직후, **사진보다 먼저** 부른다.
 *
 * 여기서 카드가 생겨 TV 작업대에 올라간다. 제출 시점에 행을 만들면 사진을 못 올리는
 * 참가자는 서버에 존재조차 하지 않아 운영자가 대신 처리할 방법이 없다.
 */
export async function POST(request: Request) {
  let caller;
  try {
    caller = await callerFrom(request);
  } catch (error) {
    if (error instanceof WalletNotFoundError) {
      return fail('WALLET_NOT_FOUND', 'Privy 지갑을 만들지 못했어요. 다시 로그인해 주세요.');
    }
    throw error;
  }
  if (!caller) return fail('UNAUTHENTICATED', '다시 로그인해 주세요.');

  const { nickname } = (await request.json()) as { nickname?: string };
  const trimmed = String(nickname ?? '').trim();
  if (!trimmed || trimmed.length > 12) {
    return fail('INVALID_NICKNAME', '닉네임은 1~12자로 적어 주세요.');
  }

  // 새로고침하거나 다시 로그인해도 카드가 두 장 생기면 안 된다. 기존 행을 200으로 돌려준다.
  const { entry, created } = await register({
    privyDid: caller.did,
    walletAddress: caller.walletAddress,
    nickname: trimmed,
  });

  return NextResponse.json<Entry>(withoutFailureReason(entry), { status: created ? 201 : 200 });
}
