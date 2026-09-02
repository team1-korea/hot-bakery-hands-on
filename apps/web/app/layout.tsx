import type { Metadata, Viewport } from 'next';
import { Archivo_Black, Gothic_A1 } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-sign-latin',
  display: 'swap',
});

const gothicA1 = Gothic_A1({
  weight: ['700', '900'],
  subsets: ['latin'],
  variable: '--font-sign-korean',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Avalanche Bakery',
  description: '오늘 구운 쿠키가 참가 증서가 됩니다.',
};

/** 참가자는 행사장에서 휴대폰을 세로로 들고 쓴다. 확대 축소는 막지 않는다. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#e84142',
};

const WALLET_GUIDE_DESIGN_CONTRACT = [
  'THESIS: 참가증서 확인을 먼저 완료하게 하고, 개인키가 필요한 Core 관리는 명확한 선택 경로로 분리한다.',
  'OWN-WORLD: 살구빛 종이 #f7f1e8, Avalanche red #e84142, carbon ink #17110f, 굵은 고딕 제목과 직선적인 규칙선.',
  'STORY: OpenSea에서 개인키 없이 확인한 뒤, 원하는 사람만 같은 Google 계정으로 로그인해 Core 모바일에서 기존 지갑을 연다.',
  'FIRST VIEWPORT: 빨간 브랜드 띠, 참가증서와 지갑 안내 제목, 선택 사항 설명, OpenSea 기본 행동.',
  'FORM: 카드 전환 없이 위에서 아래로 읽는 모바일 우선 단일 안내 페이지.',
  'FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance',
].join(' ');

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className={`${archivoBlack.variable} ${gothicA1.variable}`}>
      <body>
        <template data-impeccable-contract={WALLET_GUIDE_DESIGN_CONTRACT} data-target="/wallet-guide" />
        {children}
      </body>
    </html>
  );
}
