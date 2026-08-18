import { createHash } from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import type { ApiErrorBody, ApiErrorCode } from '@/lib/api/types';

const STATUS: Record<ApiErrorCode, number> = {
  INVALID_EMAIL: 400,
  INVALID_CODE: 400,
  UNAUTHENTICATED: 401,
  ALREADY_SUBMITTED: 409,
  INVALID_PHOTO: 400,
  INVALID_NICKNAME: 400,
  SHOWCASE_FULL: 409,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

export function fail(code: ApiErrorCode, message: string) {
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status: STATUS[code] });
}

export const SESSION_COOKIE = 'bakery_participant';
export const OPERATOR_COOKIE = 'bakery_operator';

/**
 * 쿠키에 담는 값. 비밀번호 자체를 브라우저에 보내지 않는다.
 * 서버 상태 없이 검증할 수 있어야 해서 무작위 세션 대신 고정 해시를 쓴다.
 */
export function operatorToken(passcode: string) {
  return createHash('sha256').update(`bakery-operator:${passcode}`).digest('hex');
}

/**
 * 운영자 확인. 통과하면 null, 막히면 그대로 돌려줄 응답을 준다.
 *
 * `OPERATOR_PASSCODE`가 비어 있으면 아무도 통과하지 못한다. 설정을 잊었을 때
 * 운영 화면이 열리는 쪽이 아니라 잠기는 쪽으로 실패해야 한다.
 */
export async function blockNonOperator() {
  const expected = process.env.OPERATOR_PASSCODE;
  const given = (await cookies()).get(OPERATOR_COOKIE)?.value;
  if (expected && given === operatorToken(expected)) return null;
  return fail('UNAUTHENTICATED', '운영자 비밀번호를 다시 입력해 주세요.');
}
