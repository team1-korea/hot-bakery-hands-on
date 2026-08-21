import type { ApiErrorBody, ApiErrorCode, Entry, ShowState, StateResponse } from './types';

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

let authTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: (() => Promise<string | null>) | null) {
  authTokenGetter = getter;
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init?.headers);
  if (authTokenGetter) {
    const token = await authTokenGetter();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      ...init,
      headers,
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

/**
 * 로그인·닉네임 직후의 등록. **사진보다 먼저다.**
 *
 * 여기서 카드가 생겨 TV 작업대에 올라간다. 사진을 못 올리는 참가자를 운영자가 대신
 * 처리하려면 지갑 주소와 닉네임이 먼저 서버에 있어야 한다.
 *
 * 같은 사람이 두 번 불러도 카드는 한 장이다. 새로고침해도 안전하다.
 */
export function registerParticipant(nickname: string) {
  return call<Entry>('/api/participants', json({ nickname }));
}

/**
 * 프레임까지 합성이 끝난 증서를 낸다. 카드가 오븐으로 들어간다.
 *
 * 닉네임은 등록 때 이미 받았으므로 보내지 않는다. 등록하지 않았으면 404다.
 */
export function submitEntry(input: { photo: Blob }) {
  const form = new FormData();
  form.set('photo', input.photo, 'certificate.jpg');
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
