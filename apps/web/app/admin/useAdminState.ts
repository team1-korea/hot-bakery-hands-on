'use client';

import { useEffect, useState } from 'react';

import type { AdminStateResponse } from '@/lib/api/adminTypes';

import { getAdminState } from './adminApi';

const POLL_MS = 1_000;

/**
 * 이 시간만큼 상태를 못 받으면 화면이 멈춘 것으로 본다.
 * 판단 기준은 TV와 같다(`lib/useEventState.ts`).
 */
const STALE_AFTER_MS = 6_000;

const EMPTY_STATE: AdminStateResponse = {
  entries: [],
  show: { layout: 'LIVE', qrVisible: true, shelfPage: 0 },
  counts: { submitted: 0, minted: 0 },
};

/**
 * 운영자 명단 폴링. TV가 쓰는 `useEventState`와 주기도 회복 방식도 같지만
 * **부르는 곳이 다르다.**
 *
 * 공개 `GET /api/state`에는 `failureReason`이 없다. 인증 없이 열리는 응답이라
 * 넣을 수 없기 때문이다. 그래서 운영자 화면만 `GET /api/admin/state`를 본다.
 * 공용 훅에 조건을 얹지 않고 따로 둔 이유는, 조건이 하나 잘못되면 TV 쪽에서
 * 실패 사유와 지갑 주소가 새기 때문이다.
 */
export function useAdminState() {
  const [state, setState] = useState(EMPTY_STATE);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    let lastOkAt = Date.now();

    const pull = async () => {
      try {
        const next = await getAdminState();
        if (!alive) return;
        lastOkAt = Date.now();
        setState(next);
      } catch {
        // 다음 주기에 다시 시도한다. 화면은 마지막으로 받은 상태를 유지한다.
      }
    };

    // 응답이 오지 않고 매달려 있어도 이 판단은 제때 돌아야 하므로 pull 바깥에 둔다.
    const tick = () => {
      void pull();
      if (alive) setStale(Date.now() - lastOkAt > STALE_AFTER_MS);
    };

    void pull();
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return { state, stale };
}
