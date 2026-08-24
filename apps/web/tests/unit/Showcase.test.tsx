import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { Showcase } from '@/components/display/Showcase';

const transition = {
  layout: { duration: 0, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function renderShowcase({ page = 0, pageCount = 1, onStartSession }: {
  page?: number;
  pageCount?: number;
  onStartSession?: () => void;
}) {
  return render(
    <Showcase
      entries={[]}
      phases={new Map()}
      arrivalIds={new Set()}
      landedCount={0}
      isMockServer
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
