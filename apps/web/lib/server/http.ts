import { createHash } from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import type { ApiErrorBody, ApiErrorCode } from '@/lib/api/types';
import type { Photo } from '@/lib/server/store';

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  WALLET_NOT_FOUND: 400,
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

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * 참가자 제출과 운영자 대리 업로드가 같은 검증을 쓴다. 한쪽만 느슨하면 그쪽으로 다 들어온다.
 *
 * **바이트를 다시 그리지 않는다.** 프론트가 자르기와 프레임 합성을 끝내서 보낸 것이라,
 * 재인코딩하면 참가자가 확인 화면에서 본 증서와 체인에 박히는 증서가 달라진다.
 */
export async function readPhoto(
  request: Request,
): Promise<{ photo: Photo } | { error: NextResponse }> {
  const form = await request.formData();
  const photo = form.get('photo');

  if (!(photo instanceof File) || photo.size === 0) {
    return { error: fail('INVALID_PHOTO', '쿠키 사진을 선택해 주세요.') };
  }
  if (!ALLOWED_PHOTO_TYPES.has(photo.type)) {
    return { error: fail('INVALID_PHOTO', 'JPG, PNG, WebP 사진만 보낼 수 있어요.') };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { error: fail('INVALID_PHOTO', '사진이 너무 커요. 다시 찍어 주세요.') };
  }

  return {
    photo: { bytes: new Uint8Array(await photo.arrayBuffer()), contentType: photo.type },
  };
}
