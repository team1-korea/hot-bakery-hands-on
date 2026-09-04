import { NextResponse } from 'next/server';

import type { WalletGuideEligibilityResponse } from '@/lib/api/types';
import { WalletNotFoundError, callerFrom } from '@/lib/server/auth';
import { fail } from '@/lib/server/http';
import { findEntryByDidAndWallet } from '@/lib/server/store';

/** 지갑 안내 진입 때 한 번, 현재 Privy 지갑이 실제 발급 지갑과 같은지 확인한다. */
export async function GET(request: Request) {
  let caller;
  try {
    caller = await callerFrom(request);
  } catch (error) {
    if (error instanceof WalletNotFoundError) {
      return NextResponse.json<WalletGuideEligibilityResponse>({ eligible: false });
    }
    throw error;
  }
  if (!caller) return fail('UNAUTHENTICATED', '다시 로그인해 주세요.');

  const entry = await findEntryByDidAndWallet(caller.did, caller.walletAddress);
  return NextResponse.json<WalletGuideEligibilityResponse>({
    eligible: entry?.status === 'MINTED',
  });
}
