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

describe('참가증서 확인 및 Core 모바일 안내', () => {
  test('개인키 없이 확인할 수 있는 OpenSea 경로를 가장 먼저 제공한다', () => {
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

    expect(screen.getByRole('heading', { name: 'OpenSea에서 참가증서 확인' })).toBeVisible();
    expect(screen.getByText(/지갑을 연결하지 않아도/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'OpenSea에서 확인하기' })).toHaveAttribute(
      'href',
      'https://opensea.io/collection/0x787d2971ec3eaa6b63d51bb52834ab41d2cd18a9',
    );
    expect(screen.getByText(/OpenSea 확인만으로 충분하며 개인키가 필요하지 않습니다/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }));
    expect(login).toHaveBeenCalledOnce();
  });

  test('개인키 위험을 확인하기 전에는 Privy 내보내기를 막는다', async () => {
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

    expect(screen.getAllByText('0x123456…345678')).toHaveLength(2);
    expect(screen.getByText('Loading...').closest('li')).toHaveTextContent('Loading...이 사라질 때까지');
    expect(screen.getByText('Your wallet').closest('p')).toHaveTextContent('지갑 주소만 복사');
    expect(screen.getAllByText('Private key')[0]?.closest('li')).toHaveTextContent('Copy를 누릅니다');

    const exportButton = screen.getByRole('button', { name: '확인하고 Privy 보안 창 열기' });
    expect(exportButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /개인키가 지갑을 사용할 수 있는 비밀 정보/ }));
    expect(exportButton).toBeEnabled();
    fireEvent.click(exportButton);

    await waitFor(() => expect(exportWallet).toHaveBeenCalledOnce());
  });

  test('Core를 먼저 설치한 뒤 가져오는 순서와 실제 NFT 확인 화면을 제공한다', () => {
    render(
      <WalletGuideContent
        state={{
          ...unauthenticated,
          authenticated: true,
          email: 'participant@example.com',
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Core 모바일 먼저 준비하기' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Privy 지갑을 Core로 가져오기' })).toBeVisible();
    expect(screen.getByText('Import a private key')).toBeVisible();
    expect(screen.getByText('0x').closest('p')).toHaveTextContent('0x로 시작하는 66자 전체');
    expect(screen.getByRole('link', { name: 'Core 모바일 설치' })).toHaveAttribute('href', 'https://core.app/download');

    expect(screen.getByRole('heading', { name: 'Collectibles에서 참가증서 확인' })).toBeVisible();
    expect(screen.getByText('Avalanche Bakery Certificate')).toBeVisible();
    expect(screen.getByAltText(/Collectibles 탭에 세로형/)).toBeVisible();
    expect(screen.getByAltText(/상세 화면에서 세로형 증서의 위아래 일부/)).toBeVisible();
    expect(screen.getByText('Core에서 선택할 EVM 계정')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Core NFT 확인 안내' })).toHaveAttribute(
      'href',
      'https://support.core.app/en/articles/11469838-core-mobile-how-do-i-refresh-nft-metadata',
    );
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
