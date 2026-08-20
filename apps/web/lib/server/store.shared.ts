import type { Entry } from '@/lib/api/types';

/**
 * 메모리 구현과 Postgres 구현이 같이 쓰는 것들. 두 곳에 나눠 적으면 스위퍼 시간 같은
 * 값이 조용히 어긋난다.
 */

export type AttachFailure = 'NOT_FOUND' | 'ALREADY_SUBMITTED' | 'SHOWCASE_FULL';
export type AttachResult = { ok: true; entry: Entry } | { ok: false; code: AttachFailure };

/** 중간 상태(오븐 안)로 이만큼 멈춰 있으면 스위퍼가 FAILED로 내린다. */
export const STUCK_MS = 5 * 60 * 1_000;

/** 사진 없이 JOINED로 이만큼 방치되면 스위퍼가 TV에서 내린다. */
export const ABANDONED_JOIN_MS = 10 * 60 * 1_000;

/** 스위퍼가 내린 행에 남기는 사유. 운영자가 화면에서 이 문구로 구분한다. */
export const SWEPT_REASON = '처리 중 멈춤 (스위퍼)';
