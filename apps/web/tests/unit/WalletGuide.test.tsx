import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import {
  selectEmbeddedEthereumWallet,
  WalletGuideContent,
} from '@/app/wallet-guide/WalletGuide';

const unauthenticated = {
  ready: true,
  authenticated: false,
  email: null,
  walletAddress: null,
  authError: null,
  exportError: null,
  exporting: false,
};

describe('Core 모바일 참가증서 안내', () => {
  test('행사 때 쓴 Google 계정 로그인부터 시작한다', () => {
    const login = vi.fn();

    render(
      <WalletGuideContent
        state={unauthenticated}
        actions={{
          login,
          useAnotherAccount: vi.fn(),
          exportWallet: vi.fn().mockResolvedValue(false),
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }));

    expect(login).toHaveBeenCalledOnce();
    expect(screen.getByText(/같은 지갑을 Core 모바일에서 여는 과정/)).toBeVisible();
    expect(screen.getByRole('button', { name: /지갑 내보내기/ })).toHaveAttribute('aria-expanded', 'false');
  });

  test('로그인한 Privy 지갑 주소를 축약해 보여 주고 내보내기 완료 후 Core 단계로 이동한다', async () => {
    const exportWallet = vi.fn().mockResolvedValue(true);

    render(
      <WalletGuideContent
        state={{
          ...unauthenticated,
          authenticated: true,
          email: 'participant@example.com',
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        }}
        actions={{
          login: vi.fn(),
          useAnotherAccount: vi.fn(),
          exportWallet,
        }}
      />,
    );

    expect(screen.getByText('0x123456…345678')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '내 지갑 내보내기' }));

    await waitFor(() => expect(exportWallet).toHaveBeenCalledOnce());
    expect(await screen.findByRole('heading', { name: 'Core 모바일로 같은 지갑 가져오기' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: /Core로 가져오기/ })).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: '가져오기를 마쳤어요' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /참가증서 확인/ })).toHaveFocus());
  });

  test('Core 공식 가져오기 순서와 NFT 새로고침 안내를 제공한다', () => {
    render(<WalletGuideContent state={unauthenticated} />);

    fireEvent.click(screen.getByRole('button', { name: /Core로 가져오기/ }));
    expect(screen.getByText('Import a private key')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Core 모바일 설치 페이지 열기' })).toHaveAttribute('href', 'https://core.app/download');

    fireEvent.click(screen.getByRole('button', { name: /참가증서 확인/ }));
    expect(screen.getByText('Collectibles')).toBeVisible();
    expect(screen.getByText(/최대 24시간/)).toBeVisible();
    expect(screen.getByText(/다른 지갑으로 보낼 수는 없습니다/)).toBeVisible();
  });

  test('여러 Privy EVM 지갑 중 백엔드와 같이 가장 낮은 wallet index를 고른다', () => {
    expect(selectEmbeddedEthereumWallet([
      {
        type: 'wallet',
        walletClientType: 'privy',
        chainType: 'ethereum',
        address: '0x2222222222222222222222222222222222222222',
        walletIndex: 2,
      },
      {
        type: 'wallet',
        walletClientType: 'privy',
        chainType: 'ethereum',
        address: '0x1111111111111111111111111111111111111111',
        walletIndex: 0,
      },
    ])).toBe('0x1111111111111111111111111111111111111111');
  });
});
