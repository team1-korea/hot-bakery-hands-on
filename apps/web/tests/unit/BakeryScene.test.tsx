import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { BakeryScene } from '@/components/display/BakeryScene';
import type { StateResponse } from '@/lib/api/types';

const LIVE_STATE: StateResponse = {
  entries: [],
  show: { layout: 'LIVE', qrVisible: true, shelfPage: 0 },
  counts: { submitted: 0, minted: 0 },
};

describe('TV 교육 세션 진입', () => {
  test('오븐과 작업대가 보이는 LIVE 화면에서도 진열장의 NEXT 버튼으로 시작한다', () => {
    const onStartSession = vi.fn();
    render(
      <BakeryScene
        state={LIVE_STATE}
        stale={false}
        ready
        qrSvg="<svg></svg>"
        isMockServer
        onShelfPage={() => {}}
        onStartSession={onStartSession}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'NFT 교육 세션으로 이동' }));

    expect(onStartSession).toHaveBeenCalledOnce();
  });
});
