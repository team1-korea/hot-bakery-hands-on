import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { SESSION_SLIDES, SessionDeck } from '@/components/display/SessionDeck';

describe('교육 세션 슬라이드', () => {
  test('도입과 여섯 개 질문을 한 흐름으로 제공한다', () => {
    expect(SESSION_SLIDES.map((slide) => slide.title)).toEqual([
      '방금, 쿠키가 NFT가 되었습니다',
      'NFT 한 장은 세 겹으로 이루어집니다',
      '사진은 체인 안이 아니라 IPFS에 있습니다',
      'Google 로그인 뒤, 내 지갑이 만들어졌습니다',
      '오븐 안에서는 다섯 단계가 지나갔습니다',
      '이번 참가증서는 팔 수 없는 NFT입니다',
      'C-Chain에는 소유와 발행 기록이 남습니다',
    ]);
  });

  test('현재 장의 내용만 간결하게 보여 주고 버튼으로 이동한다', () => {
    const onSlide = vi.fn();
    render(
      <SessionDeck
        slide={0}
        stale={false}
        onSlide={onSlide}
        onExit={() => {}}
      />,
    );

    expect(screen.getByRole('heading', { name: '방금, 쿠키가 NFT가 되었습니다' })).toBeVisible();
    expect(screen.queryByText(/개의 참가증서/)).not.toBeInTheDocument();
    expect(screen.queryByText('NFT 교육 세션')).not.toBeInTheDocument();
    expect(screen.queryByText('Space')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전 슬라이드' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '다음 슬라이드' }));
    expect(onSlide).toHaveBeenCalledWith(1);
  });

  test('마지막 장에서는 진열장으로 돌아갈 수 있다', () => {
    const onExit = vi.fn();
    render(
      <SessionDeck
        slide={SESSION_SLIDES.length - 1}
        stale={false}
        onSlide={() => {}}
        onExit={onExit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '진열장으로 돌아가기' }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  test('참가증서 복구는 전송 예외가 아니라 소각 후 재발급으로 안내한다', () => {
    render(
      <SessionDeck
        slide={5}
        stale={false}
        onSlide={() => {}}
        onExit={() => {}}
      />,
    );

    expect(screen.getByText(/오발급은 소각 후 새 토큰으로 재발급/)).toBeVisible();
    expect(screen.queryByText(/운영 복구만 예외/)).not.toBeInTheDocument();
  });
});
