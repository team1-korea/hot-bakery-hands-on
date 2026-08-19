import type { ApiErrorBody, ApiErrorCode, Entry, Session, ShowState, StateResponse } from './types';

/**
 * 화면이 서버와 이야기하는 유일한 통로.
 *
 * 지금은 같은 앱의 `app/api/` 목 라우트를 부른다. 백엔드가 생기면
 * `NEXT_PUBLIC_API_BASE_URL`만 지정하면 되고 화면 코드는 바뀌지 않는다.
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

/**
 * 백엔드 주소가 없으면 같은 앱의 목 라우트를 쓰고 있다는 뜻이다.
 * 이때 `tokenId`와 `txHash`는 실제 발행 결과가 아니므로 화면이 진짜인 척하지 않아야 한다.
 */
export const USING_MOCK_SERVER = BASE.length === 0;

/*
 * 행사장 와이파이는 깨끗하게 끊기기보다 응답 없이 매달린다.
 *
 * 기다림에 끝이 없으면 참가자는 "보내는 중…"에 갇히고, 1초마다 도는 TV 폴링은
 * 죽은 요청을 쌓아 브라우저 연결 한도를 막는다. 그래서 모든 호출에 시한을 둔다.
 *
 * 제출만 넉넉하다. 사진 한 장이 올라가는 중일 수 있어서, 느린 성공을 실패로
 * 만드는 쪽보다 조금 더 기다리는 쪽이 낫다.
 */
const TIMEOUT_MS = 15_000;
const SUBMIT_TIMEOUT_MS = 30_000;

/** 폴링은 매초 다시 시도하므로 짧게 끊고 다음 주기에 맡긴다. */
const POLL_TIMEOUT_MS = 5_000;

export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<T> {
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
    // 시한 초과와 연결 실패를 참가자 입장에서 구별할 이유가 없다. 할 일이 같다.
    throw new ApiError('INTERNAL', '네트워크가 불안정해요. 잠시 뒤 다시 시도해 주세요.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      body?.error.code ?? 'INTERNAL',
      body?.error.message ?? '잠시 후 다시 시도해 주세요.',
    );
  }

  return (await response.json()) as T;
}

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function requestCode(email: string) {
  return call<{ ok: true; mockCode?: string }>('/api/auth/request-code', json({ email }));
}

export function verifyCode(email: string, code: string) {
  return call<Session>('/api/auth/verify', json({ email, code }));
}

export function getSession() {
  return call<Session>('/api/auth/session');
}

export function submitEntry(input: { nickname: string; photo: Blob }) {
  const form = new FormData();
  form.set('nickname', input.nickname);
  form.set('photo', input.photo, 'cookie.jpg');
  return call<Entry>('/api/entries', { method: 'POST', body: form }, SUBMIT_TIMEOUT_MS);
}

export function getMyEntry() {
  return call<Entry | null>('/api/entries');
}

export function getState() {
  return call<StateResponse>('/api/state', { cache: 'no-store' }, POLL_TIMEOUT_MS);
}

export function checkOperator() {
  return call<{ ok: true }>('/api/admin/session');
}

export function loginOperator(passcode: string) {
  return call<{ ok: true }>('/api/admin/session', json({ passcode }));
}

export function logoutOperator() {
  return call<{ ok: true }>('/api/admin/session', { method: 'DELETE' });
}

export function updateEntry(id: string, patch: { hidden?: boolean; retry?: boolean }) {
  return call<Entry>(`/api/admin/entries/${id}`, {
    ...json(patch),
    method: 'PATCH',
  });
}

export function updateShow(patch: Partial<ShowState>) {
  return call<ShowState>('/api/admin/show', { ...json(patch), method: 'PATCH' });
}
