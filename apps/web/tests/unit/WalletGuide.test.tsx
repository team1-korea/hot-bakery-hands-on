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
    expect(screen.getByText('Loading...').closest('li')).toHaveTextContent('Loading...이 사라질 때까지');
    expect(screen.getByText('Your wallet').closest('p')).toHaveTextContent('Copy는 누르지 마세요');
    expect(screen.getByText('Private key').closest('li')).toHaveTextContent('Copy를 누릅니다');
    fireEvent.click(screen.getByRole('button', { name: '내 지갑 내보내기' }));

    await waitFor(() => expect(exportWallet).toHaveBeenCalledOnce());
    expect(await screen.findByRole('heading', { name: 'Core 모바일로 같은 지갑 가져오기' })).toBeVisible();
    await waitFor(() => expect(screen.getByRole('button', { name: /Core로 가져오기/ })).toHaveFocus());
    expect(screen.queryByRole('button', { name: '가져오기를 마쳤어요' })).not.toBeInTheDocument();
  });

  test('Core 공식 가져오기 순서와 NFT 새로고침 안내를 제공한다', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /Core로 가져오기/ }));
    expect(screen.getByText('Import a private key')).toBeVisible();
    expect(screen.getByText('0x').closest('p')).toHaveTextContent('0x로 시작하는 66자 전체');
    expect(screen.getByRole('link', { name: 'Core 모바일 설치' })).toHaveAttribute('href', 'https://core.app/download');

    fireEvent.click(screen.getByRole('button', { name: /참가증서 확인/ }));
    expect(screen.getByText('Collectibles')).toBeVisible();
    expect(screen.getByText(/방금 가져온 계정을 선택/)).toBeVisible();
    expect(screen.getByText('Avalanche Bakery Certificate')).toBeVisible();
    expect(screen.getByText(/갱신에는 최대 24시간/)).toBeVisible();
    expect(screen.getByAltText(/Collectibles 탭에 세로형/)).toBeVisible();
    expect(screen.getByAltText(/상세 화면에서 세로형 증서의 위아래 일부/)).toBeVisible();
    expect(screen.getByText(/IPFS 원본은 그대로입니다/)).toBeVisible();
    expect(screen.getByText('Core에서 선택할 EVM 계정')).toBeVisible();
    expect(screen.getAllByText('0x123456…345678').at(-1)).toBeVisible();
    expect(screen.getByText(/지갑을 연결하지 않아도 OpenSea/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'OpenSea에서 참가증서 확인' })).toHaveAttribute(
      'href',
      'https://opensea.io/collection/0x787d2971ec3eaa6b63d51bb52834ab41d2cd18a9',
    );
    expect(screen.getByText(/다른 지갑으로 보낼 수는 없습니다/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Core NFT 확인 안내' })).toHaveAttribute(
      'href',
      'https://support.core.app/en/articles/11469838-core-mobile-how-do-i-refresh-nft-metadata',
    );
  });

  test('다른 단계를 열어도 기존 단계를 자동으로 접지 않는다', () => {
    render(<WalletGuideContent state={unauthenticated} />);
    fireEvent.click(screen.getByRole('button', { name: /참가증서 확인/ }));

    expect(screen.getByRole('button', { name: '로그인' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /참가증서 확인/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { name: '행사 때 쓴 Google 계정으로 로그인' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '가져온 계정의 Collectibles에서 확인' })).toBeVisible();
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
