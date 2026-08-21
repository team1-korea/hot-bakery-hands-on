'use client';

/** 운영자 API가 401을 받았을 때 Gate로 돌아가기 위한 화면 내부 신호. */
export const OPERATOR_SESSION_EXPIRED_EVENT = 'bakery:operator-session-expired';

export function expireOperatorSession() {
  window.dispatchEvent(new Event(OPERATOR_SESSION_EXPIRED_EVENT));
}
