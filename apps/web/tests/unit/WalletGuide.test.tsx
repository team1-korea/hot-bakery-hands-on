import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { WalletGuide } from '@/app/wallet-guide/WalletGuide';

describe('참가증서 확인 및 Core 모바일 안내', () => {
  test('개인키 없이 확인할 수 있는 OpenSea 경로를 가장 먼저 제공한다', () => {
    render(<WalletGuide />);

    expect(screen.getByRole('heading', { name: 'OpenSea에서 참가증서 확인' })).toBeVisible();
    expect(screen.getByText(/지갑을 연결하지 않아도/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'OpenSea에서 확인하기' })).toHaveAttribute(
      'href',
      'https://opensea.io/collection/0x787d2971ec3eaa6b63d51bb52834ab41d2cd18a9',
    );
    expect(screen.getByText(/OpenSea 확인만으로 충분하며 개인키가 필요하지 않습니다/)).toBeVisible();
  });

  test('공개 안내 페이지에서는 로그인과 개인키 내보내기를 실행할 수 없다', () => {
    render(<WalletGuide />);

    expect(screen.getByText('이 페이지는 방법만 안내합니다.')).toBeVisible();
    expect(screen.getByText(/Google 로그인이나 개인키 내보내기 기능이 없으며/)).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('Core 가져오기 개요와 실제 NFT 확인 화면을 제공한다', () => {
    render(<WalletGuide />);

    expect(screen.getByRole('heading', { name: 'Core 모바일 준비' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Privy 지갑 내보내기' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '같은 지갑을 Core로 가져오기' })).toBeVisible();
    expect(screen.getByText('Import a private key')).toBeVisible();
    expect(screen.getByText(/실제로 가져오려면 별도로 전달되는 안내/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Core 모바일 설치' })).toHaveAttribute('href', 'https://core.app/download');

    expect(screen.getByRole('heading', { name: 'Collectibles에서 참가증서 확인' })).toBeVisible();
    expect(screen.getByText('Avalanche Bakery Certificate')).toBeVisible();
    expect(screen.getByAltText(/Collectibles 탭에 세로형/)).toBeVisible();
    expect(screen.getByAltText(/상세 화면에서 세로형 증서의 위아래 일부/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Core NFT 확인 안내' })).toHaveAttribute(
      'href',
      'https://support.core.app/en/articles/11469838-core-mobile-how-do-i-refresh-nft-metadata',
    );
  });
});
