import { NextResponse } from 'next/server';

import { fail } from '@/lib/server/http';
import { issueCode } from '@/lib/server/store';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email?: string };
  if (!email || !EMAIL.test(email)) {
    return fail('INVALID_EMAIL', '이메일 주소를 다시 확인해 주세요.');
  }

  const code = issueCode(email);

  // 목 구현이라 메일을 보내지 않고 코드를 그대로 돌려준다. 백엔드가 붙으면 이 필드는 사라진다.
  return NextResponse.json({ ok: true, mockCode: code });
}
