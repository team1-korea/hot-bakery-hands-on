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
  certificateStatus: 'idle' as const,
  authError: null,
  exportError: null,
  exporting: false,
};

describe('참가증서 확인 및 Core 모바일 안내', () => {
  test('OpenSea 확인을 먼저 제공하고 Core 로그인은 참가자가 선택한다', () => {
    const login = vi.fn();

    render(
      <WalletGuideContent
        state={unauthenticated}
        actions={{
          login,
          useAnotherAccount: vi.fn(),
          exportWallet: vi.fn().mockResolvedValue(false),
          retryCertificateCheck: vi.fn(),
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'OpenSea에서 참가증서 확인' })).toBeVisible();
    expect(screen.getByText(/지갑을 연결하거나 개인키를 입력하지 않아도 됩니다/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'OpenSea에서 확인하기' })).toHaveAttribute(
      'href',
      'https://opensea.io/collection/0x787d2971ec3eaa6b63d51bb52834ab41d2cd18a9',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }));
    expect(login).toHaveBeenCalledOnce();
  });

  test('개인키 위험을 확인한 참가자만 Privy 공식 보안 창을 연다', async () => {
    const exportWallet = vi.fn().mockResolvedValue(true);

    render(
      <WalletGuideContent
        state={{
          ...unauthenticated,
          authenticated: true,
          email: 'participant@example.com',
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          certificateStatus: 'verified',
        }}
        actions={{
          login: vi.fn(),
          useAnotherAccount: vi.fn(),
          exportWallet,
          retryCertificateCheck: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText('participant@example.com')).toBeVisible();
    expect(screen.getByText('0x123456…345678')).toBeVisible();
    expect(screen.getByText(/이 안내 페이지와 서버는 개인키 값을 읽거나 저장하지 않습니다/)).toBeVisible();

    const exportButton = screen.getByRole('button', { name: 'Privy 보안 창 열기' });
    expect(exportButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /본인의 Core 앱에만 직접 입력/ }));
    expect(exportButton).toBeEnabled();
    fireEvent.click(exportButton);

    await waitFor(() => expect(exportWallet).toHaveBeenCalledOnce());
  });

  test('개인키 입력 UI 없이 Core 가져오기와 NFT 확인 순서를 안내한다', () => {
    render(
      <WalletGuideContent
        state={{
          ...unauthenticated,
          authenticated: true,
          email: 'participant@example.com',
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          certificateStatus: 'verified',
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Core 앱 먼저 준비하기' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '같은 지갑을 Core로 가져오기' })).toBeVisible();
    expect(screen.getByText('Import a private key')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Collectibles에서 참가증서 확인' })).toBeVisible();
    expect(screen.getByAltText(/Collectibles 탭에 세로형/)).toBeVisible();
  });

  test('발급되지 않은 Google 계정은 지갑 주소와 내보내기를 열지 않는다', () => {
    const exportWallet = vi.fn().mockResolvedValue(true);

    render(
      <WalletGuideContent
        state={{
          ...unauthenticated,
          authenticated: true,
          email: 'other@example.com',
          walletAddress: '0x9999999999999999999999999999999999999999',
          certificateStatus: 'not-found',
        }}
        actions={{
          login: vi.fn(),
          useAnotherAccount: vi.fn(),
          exportWallet,
          retryCertificateCheck: vi.fn(),
        }}
      />,
    );

    expect(screen.getByText('other@example.com')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('안내 메일을 받은 Google 계정');
    expect(screen.queryByText('0x999999…999999')).not.toBeInTheDocument();

    const exportButton = screen.getByRole('button', { name: 'Privy 보안 창 열기' });
    expect(exportButton).toBeDisabled();
    fireEvent.click(exportButton);
    expect(exportWallet).not.toHaveBeenCalled();
  });

  test('발급 기록 확인 실패는 다시 확인할 수 있다', () => {
    const retryCertificateCheck = vi.fn();

    render(
      <WalletGuideContent
        state={{
          ...unauthenticated,
          authenticated: true,
          email: 'participant@example.com',
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          certificateStatus: 'error',
        }}
        actions={{
          login: vi.fn(),
          useAnotherAccount: vi.fn(),
          exportWallet: vi.fn().mockResolvedValue(false),
          retryCertificateCheck,
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '발급 기록 다시 확인' }));
    expect(retryCertificateCheck).toHaveBeenCalledOnce();
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
