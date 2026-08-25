import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('TV 참가 QR 확대', () => {
  test('작은 QR을 누르면 전체 화면으로 키우고 버튼으로 돌아간다', async () => {
    render(
      <BakeryScene
        state={LIVE_STATE}
        stale={false}
        ready
        qrSvg="<svg></svg>"
        isMockServer
        onShelfPage={() => {}}
        onStartSession={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '참가 QR 크게 보기' }));

    expect(screen.getByRole('dialog', { name: '참가 QR 확대' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '원래 화면으로 돌아가기' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '참가 QR 확대' }))
        .not.toBeInTheDocument();
    });
  });

  test('확대 화면에서 Esc를 누르면 원래 화면으로 돌아간다', async () => {
    render(
      <BakeryScene
        state={LIVE_STATE}
        stale={false}
        ready
        qrSvg="<svg></svg>"
        isMockServer
        onShelfPage={() => {}}
        onStartSession={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '참가 QR 크게 보기' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '참가 QR 확대' }))
        .not.toBeInTheDocument();
    });
  });
});
