'use client';

import { useEffect, useState } from 'react';

import { getState } from '@/lib/api/client';
import type { StateResponse } from '@/lib/api/types';

const POLL_MS = 1_000;

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
 */
export function useEventState() {
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => {
    let alive = true;

    const pull = async () => {
      try {
        const next = await getState();
        if (alive) setState(next);
      } catch {
        // 다음 주기에 다시 시도한다. 화면은 마지막으로 받은 상태를 유지한다.
      }
    };

    void pull();
    const timer = window.setInterval(pull, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return state;
}
