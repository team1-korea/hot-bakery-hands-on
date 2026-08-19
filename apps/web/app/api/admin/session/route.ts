import { NextResponse } from 'next/server';

import { OPERATOR_COOKIE, blockNonOperator, fail, operatorToken } from '@/lib/server/http';

/** 지금 운영자로 들어와 있는지 확인한다. */
export async function GET() {
  const blocked = await blockNonOperator();
  return blocked ?? NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const { passcode } = (await request.json()) as { passcode?: string };
  const expected = process.env.OPERATOR_PASSCODE;

  if (!expected) {
    return fail('INTERNAL', '운영자 비밀번호가 서버에 설정되지 않았어요.');
  }
  if (passcode !== expected) {
    return fail('UNAUTHENTICATED', '비밀번호가 맞지 않아요.');
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(OPERATOR_COOKIE, operatorToken(expected), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return response;
}

/** 노트북을 남에게 넘길 때 세션을 끊는다. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(OPERATOR_COOKIE);
  return response;
}
