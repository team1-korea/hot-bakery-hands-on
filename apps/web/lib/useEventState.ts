'use client';

import { useEffect, useState } from 'react';

import { getState } from '@/lib/api/client';
import type { StateResponse } from '@/lib/api/types';

const POLL_MS = 1_000;

/**
 * 이 시간만큼 상태를 못 받으면 화면이 멈춘 것으로 본다.
 *
 * 폴링 한 번을 놓치는 일은 행사장 와이파이에서 늘 있는 일이라 알릴 가치가 없다.
 * 여섯 번을 내리 놓쳤다면 사람이 개입해야 하는 상황이다.
 */
const STALE_AFTER_MS = 6_000;

export const EMPTY_STATE: StateResponse = {
  entries: [],
  show: { layout: 'LIVE', qrVisible: true, shelfPage: 0 },
  counts: { submitted: 0, minted: 0 },
};

/**
 * 행사장 TV와 운영자 화면이 같은 상태를 본다.
 *
 * 1초 폴링이다. 15명 규모에서 SSE를 붙일 이유가 없고, 행사장 와이파이가 끊겼다
 * 돌아와도 다음 주기에 저절로 회복된다.
 *
 * 끊긴 동안에도 화면은 마지막으로 받은 상태를 그대로 들고 있는다. 그래서 멈춘
 * 화면과 조용한 화면이 똑같아 보인다. `stale`은 그 둘을 구별해 준다.
 */
export function useEventState() {
  const [state, setState] = useState(EMPTY_STATE);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    let lastOkAt = Date.now();

    const pull = async () => {
      try {
        const next = await getState();
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
