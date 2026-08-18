import type { ApiErrorBody, ApiErrorCode, Entry, Session, ShowState, StateResponse } from './types';

/**
 * 화면이 서버와 이야기하는 유일한 통로.
 *
 * 지금은 같은 앱의 `app/api/` 목 라우트를 부른다. 백엔드가 생기면
 * `NEXT_PUBLIC_API_BASE_URL`만 지정하면 되고 화면 코드는 바뀌지 않는다.
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { credentials: 'include', ...init });

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
  return call<Entry>('/api/entries', { method: 'POST', body: form });
}

export function getMyEntry() {
  return call<Entry | null>('/api/entries');
}

export function getState() {
  return call<StateResponse>('/api/state', { cache: 'no-store' });
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
