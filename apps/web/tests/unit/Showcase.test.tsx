import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { Showcase } from '@/components/display/Showcase';
import type { Entry } from '@/lib/api/types';

const transition = {
  layout: { duration: 0, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function renderShowcase({
  page = 0,
  pageCount = 1,
  entries = [],
  isMockServer = true,
  onStartSession,
}: {
  page?: number;
  pageCount?: number;
  entries?: Entry[];
  isMockServer?: boolean;
  onStartSession?: () => void;
}) {
  return render(
    <Showcase
      entries={entries}
      phases={new Map()}
      arrivalIds={new Set()}
      landedCount={0}
      isMockServer={isMockServer}
      page={page}
      pageCount={pageCount}
      onPage={() => {}}
      onStartSession={onStartSession}
      transition={transition}
    />,
  );
}

describe('진열장에서 교육 세션으로 이동', () => {
  test('마지막 진열장 쪽에서 버튼을 눌러 세션을 시작한다', () => {
    const onStartSession = vi.fn();
    renderShowcase({ onStartSession });

    fireEvent.click(screen.getByRole('button', { name: 'NFT 교육 세션으로 이동' }));

    expect(onStartSession).toHaveBeenCalledOnce();
  });

  test('다음 진열장 쪽이 남아 있으면 세션 버튼을 아직 보여 주지 않는다', () => {
    renderShowcase({ page: 0, pageCount: 2, onStartSession: () => {} });

    expect(screen.queryByRole('button', { name: 'NFT 교육 세션으로 이동' })).not.toBeInTheDocument();
  });
});

describe('진열된 NFT 링크', () => {
  test('카드 전체를 링크로 쓰고 토큰 번호와 닉네임을 한 줄 캡션에 표시한다', () => {
    const entry: Entry = {
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      nickname: '아발란체 짱',
      status: 'MINTED',
      photoUrl: '/cookie.png',
      tokenId: '8',
      txHash: '0x1234',
      shelfIndex: 0,
      hidden: false,
      failureReason: null,
      submittedAt: '2026-08-25T00:00:00.000Z',
    };

    renderShowcase({ entries: [entry], isMockServer: false });

    expect(screen.getByRole('link', { name: '아발란체 짱의 블록체인 기록 보기' })).toHaveAttribute(
      'href',
      expect.stringContaining('/0x1234'),
    );
    expect(screen.queryByText('발행 기록')).not.toBeInTheDocument();
    const caption = screen.getByText('#8').closest('.certificate-caption');
    expect(caption).toHaveTextContent('#8아발란체 짱');
    expect(caption).toContainElement(screen.getByText('아발란체 짱'));
  });
});
