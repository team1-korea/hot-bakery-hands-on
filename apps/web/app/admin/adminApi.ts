import type { AdminStateResponse } from '@/lib/api/adminTypes';
import { ApiError } from '@/lib/api/client';
import type { ApiErrorBody, Entry, ShowState } from '@/lib/api/types';

import { expireOperatorSession } from './operatorSession';

/**
 * 운영자 화면만 쓰는 두 개의 호출.
 *
 * 공용 `lib/api/client.ts`에 얹지 않은 이유는 이 두 응답이 **운영자 전용**이기 때문이다.
 * 실패 사유와 지갑 주소는 인증 없는 화면에 절대 닿으면 안 되므로, 그것을 다루는 호출을
 * 참가자·TV 화면이 함께 import 하는 파일에 두지 않는다.
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/** 폴링은 매초 다시 시도하므로 짧게 끊고 다음 주기에 맡긴다. */
const POLL_TIMEOUT_MS = 5_000;

/** 대리 업로드는 사진 한 장이 올라가는 중일 수 있어 넉넉히 기다린다. */
const UPLOAD_TIMEOUT_MS = 30_000;

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = POLL_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      ...init,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('INTERNAL', '네트워크가 불안정해요. 잠시 뒤 다시 시도해 주세요.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const error = new ApiError(
      body?.error.code ?? 'INTERNAL',
      body?.error.message ?? '잠시 후 다시 시도해 주세요.',
    );
    if (response.status === 401 || error.code === 'UNAUTHENTICATED') expireOperatorSession();
    throw error;
  }

  return (await response.json()) as T;
}

/**
 * 운영자 명단. 공개 `GET /api/state`에는 계약상 `failureReason`이 없어서,
 * 그것으로는 무엇이 왜 실패했는지 알 수 없다.
 */
export function getAdminState() {
  return call<AdminStateResponse>('/api/admin/state', { cache: 'no-store' }, POLL_TIMEOUT_MS);
}

/**
 * 대리 업로드. 보내는 것은 원본 사진이 아니라 **합성이 끝난 증서**다(`certificate.ts`).
 * 참가자 제출과 같은 필드 이름을 쓴다.
 */
export function uploadEntryPhoto(id: string, certificate: Blob) {
  const form = new FormData();
  form.set('photo', certificate, 'cookie.jpg');
  return call<Entry>(
    `/api/admin/entries/${id}/photo`,
    { method: 'POST', body: form },
    UPLOAD_TIMEOUT_MS,
  );
}

function json(body: unknown): RequestInit {
  return {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function updateAdminEntry(
  id: string,
  patch: { hidden?: boolean; retry?: boolean; nickname?: string },
) {
  return call<Entry>(
    `/api/admin/entries/${id}`,
    { ...json(patch), method: 'PATCH' },
    15_000,
  );
}

export function updateAdminShow(patch: Partial<ShowState>) {
  return call<ShowState>('/api/admin/show', { ...json(patch), method: 'PATCH' }, 15_000);
}

export type ResetResult = { deleted: { participants: number; entries: number } };

export function resetAdminData() {
  return call<ResetResult>('/api/admin/reset', { method: 'POST' }, 30_000);
}
