import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { SESSION_SLIDES, SessionDeck } from '@/components/display/SessionDeck';

describe('교육 세션 슬라이드', () => {
  test('도입부터 Core 관리와 공개 검증까지 여덟 장으로 설명한다', () => {
    expect(SESSION_SLIDES.map((slide) => slide.title)).toEqual([
      '내 쿠키 사진이, 내 지갑의 참가증서가 되었습니다',
      'NFT는 세 가지가 연결된 하나의 기록입니다',
      '사진은 IPFS에, 소유 기록은 C-Chain에 남습니다',
      'Google은 로그인 수단, 지갑 주소가 실제 소유자입니다',
      '제출한 뒤, 한 사람씩 즉시 발행했습니다',
      'ERC-721 규격 위에, 전송 잠금 규칙을 더했습니다',
      '행사 뒤에는 Core에서 같은 지갑을 열 수 있습니다',
      '발행 기록은 공개되고, 개인키는 공개되지 않습니다',
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

    expect(screen.getByRole('heading', { name: '내 쿠키 사진이, 내 지갑의 참가증서가 되었습니다' })).toBeVisible();
    expect(screen.queryByText(/개의 참가증서/)).not.toBeInTheDocument();
    expect(screen.queryByText('NFT 교육 세션')).not.toBeInTheDocument();
    expect(screen.queryByText('Space')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '예시용 쿠키 참가증서' })).toHaveAttribute(
      'src',
      '/assets/session/certificate-illustration-v1.png',
    );
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
    expect(screen.getByText(/Fuji C-Chain/)).toBeVisible();
    expect(screen.getByText('43113')).toBeVisible();
    expect(screen.getByText('Avalanche Bakery Certificate')).toBeVisible();
    expect(screen.getByText(/IPFS 공개 파일/)).toBeVisible();
    expect(screen.getByText(/최종 참가증서 JPEG/)).toBeVisible();
    expect(screen.getByText(/원본 사진 · Google 계정/)).toBeVisible();
    expect(screen.queryByText(/원본 사진 · 이미지 바이트/)).not.toBeInTheDocument();
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

    expect(screen.getByText(/NFT를 지갑과 Explorer가 같은 방식으로 읽게/)).toBeVisible();
    expect(screen.getByText('각 증서의 고유 번호')).toBeVisible();
    expect(screen.getByText(/전송과 승인 요청을 모두 거절/)).toBeVisible();
    expect(screen.getByText(/소각 후 새 번호로 재발급/)).toBeVisible();
    expect(screen.getByText(/팔 수는 없습니다/)).toBeVisible();
  });

  test('Core에서는 전송하지 않고 같은 지갑을 연다고 안내한다', () => {
    render(
      <SessionDeck
        slide={6}
        stale={false}
        onSlide={() => {}}
        onExit={() => {}}
      />,
    );

    expect(screen.getByText(/Google 로그인에 사용한 이메일로/)).toBeVisible();
    expect(screen.getByText('본인 인증')).toBeVisible();
    expect(screen.getByText('계정 가져오기')).toBeVisible();
    expect(screen.getByText(/앱만 달라지고 지갑 주소는 같습니다/)).toBeVisible();
    expect(screen.getByText(/개인키는 지갑 소유권 자체/)).toBeVisible();
  });
});
