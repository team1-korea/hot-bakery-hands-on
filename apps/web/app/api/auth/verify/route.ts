import { NextResponse } from 'next/server';

import type { Session } from '@/lib/api/types';
import { SESSION_COOKIE, fail } from '@/lib/server/http';
import { verifyCode } from '@/lib/server/store';

export async function POST(request: Request) {
  const { email, code } = (await request.json()) as { email?: string; code?: string };
  if (!email || !code) return fail('INVALID_CODE', '인증 코드를 입력해 주세요.');

  const participantId = verifyCode(email, code);
  if (!participantId) return fail('INVALID_CODE', '인증 코드가 맞지 않아요.');

  const response = NextResponse.json<Session>({ participantId, email });
  response.cookies.set(SESSION_COOKIE, participantId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return response;
}
