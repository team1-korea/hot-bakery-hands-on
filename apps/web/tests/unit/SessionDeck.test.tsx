import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { SESSION_SLIDES, SessionDeck } from '@/components/display/SessionDeck';

describe('교육 세션 슬라이드', () => {
  test('도입부터 공개 검증까지 일곱 장으로 설명한다', () => {
    expect(SESSION_SLIDES.map((slide) => slide.title)).toEqual([
      '방금 받은 참가증서, 이렇게 만들었습니다',
      'NFT 한 장은 세 가지로 이루어집니다',
      '증서 파일은 IPFS에, 소유 기록은 C-Chain에 남습니다',
      'NFT의 주인은 Google 계정이 아니라 지갑 주소입니다',
      '제출부터 진열까지 다섯 단계를 거칩니다',
      'ERC-721 형식이지만 다른 지갑으로 보낼 수 없습니다',
      '공개되는 것과 공개하지 않는 것',
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

    expect(screen.getByRole('heading', { name: '방금 받은 참가증서, 이렇게 만들었습니다' })).toBeVisible();
    expect(screen.queryByText(/개의 참가증서/)).not.toBeInTheDocument();
    expect(screen.queryByText('NFT 교육 세션')).not.toBeInTheDocument();
    expect(screen.queryByText('Space')).not.toBeInTheDocument();
    expect(screen.getByText('블록체인')).toBeVisible();
    expect(screen.getByText('여러 사람이 같은 내용을 확인하는 공개 기록')).toBeVisible();
    expect(screen.queryByRole('img', { name: '예시용 쿠키 참가증서' })).not.toBeInTheDocument();
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
    expect(screen.getByText('C-Chain')).toBeVisible();
    expect(screen.getByText('IPFS')).toBeVisible();
    expect(screen.getByText(/최종 참가증서\(쿠키 사진·닉네임\)/)).toBeVisible();
    expect(screen.getByText('원본 사진')).toBeVisible();
    expect(screen.getByText('Google 계정')).toBeVisible();
    expect(screen.queryByText(/Chain ID 43113/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Avalanche Bakery Certificate/)).not.toBeInTheDocument();
    expect(screen.queryByText(/서버도 받지 않습니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(/원본 사진 · 이미지 바이트/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Core/)).not.toBeInTheDocument();
  });

  test('기술 샘플 대신 세 요소와 저장 위치의 역할만 설명한다', () => {
    const { rerender } = render(
      <SessionDeck
        slide={1}
        stale={false}
        onSlide={() => {}}
        onExit={() => {}}
      />,
    );

    const anatomySlide = screen.getByRole('group', { name: '2 / 7' });
    expect(within(anatomySlide).getByText('쿠키 사진과 프레임을 합친 완성본')).toBeVisible();
    expect(within(anatomySlide).getByText('증서 이름과 이미지를 설명하는 정보')).toBeVisible();
    expect(within(anatomySlide).getByText('증서 번호와 소유 지갑을 연결한 기록')).toBeVisible();
    expect(within(anatomySlide).queryByText(/1080/)).not.toBeInTheDocument();
    expect(within(anatomySlide).queryByText(/certificate\.jpg/)).not.toBeInTheDocument();
    expect(within(anatomySlide).queryByText('tokenURI')).not.toBeInTheDocument();

    rerender(
      <SessionDeck
        slide={2}
        stale={false}
        onSlide={() => {}}
        onExit={() => {}}
      />,
    );

    const storageSlide = screen.getByRole('group', { name: '3 / 7' });
    expect(within(storageSlide).getByRole('heading', {
      name: '증서 파일은 IPFS에, 소유 기록은 C-Chain에 남습니다',
    })).toBeVisible();
    expect(within(storageSlide).getByText('참가증서 이미지')).toBeVisible();
    expect(within(storageSlide).getByText('증서 번호')).toBeVisible();
    expect(within(storageSlide).getByText('참가자의 지갑 주소')).toBeVisible();
    expect(within(storageSlide).queryByText(/ipfs:\/\//)).not.toBeInTheDocument();
    expect(within(storageSlide).queryByText('번호')).not.toBeInTheDocument();

    rerender(
      <SessionDeck
        slide={3}
        stale={false}
        onSlide={() => {}}
        onExit={() => {}}
      />,
    );

    const walletSlide = screen.getByRole('group', { name: '4 / 7' });
    expect(within(walletSlide).getByText('참가자 지갑')).toBeVisible();
    expect(within(walletSlide).queryByText(/0x…A91C/)).not.toBeInTheDocument();
  });

  test('영수증 확인은 실제 상태값인 것처럼 표시하지 않는다', () => {
    render(
      <SessionDeck
        slide={4}
        stale={false}
        onSlide={() => {}}
        onExit={() => {}}
      />,
    );

    expect(screen.getByText('영수증과 발행 이벤트 확인')).toBeVisible();
    expect(screen.queryByText('RECEIPT')).not.toBeInTheDocument();
    expect(screen.getByText('MINTING')).toBeVisible();
    expect(screen.getByText('MINTED')).toBeVisible();
  });

  test('ERC-721 규격과 참가증서 잠금 규칙을 설명한다', () => {
    render(
      <SessionDeck
        slide={5}
        stale={false}
        onSlide={() => {}}
        onExit={() => {}}
      />,
    );

    expect(screen.getByText(/지갑과 Explorer가 NFT를 읽을 때/)).toBeVisible();
    expect(screen.getByText('증서 번호')).toBeVisible();
    expect(screen.getByText('다른 지갑으로 보내기')).toBeVisible();
    expect(screen.getByText('거래를 위한 승인')).toBeVisible();
    expect(screen.getAllByText('불가')).toHaveLength(2);
    expect(screen.getByText('일반 발급')).toBeVisible();
    expect(screen.queryByText(/소각 후 재발급/)).not.toBeInTheDocument();
    expect(screen.getByText(/전송과 판매는 막혀/)).toBeVisible();
  });

});
