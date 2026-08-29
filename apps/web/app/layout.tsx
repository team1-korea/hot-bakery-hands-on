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
  'THESIS: 네 단계의 작업 영수증으로 복잡한 지갑 가져오기를 한 번에 한 행동씩 안내하며, 둥근 SaaS 카드형 설명서를 거절한다.',
  'OWN-WORLD: 살구빛 종이 #f7f1e8, Avalanche red #e84142, carbon ink #17110f, 굵은 고딕 제목, 2–4px 규칙선과 절취선 티켓.',
  'STORY: 같은 Google 계정으로 로그인하고, 본인만 개인키를 확인해 Core 모바일에서 같은 지갑을 연 뒤 참가증서를 확인한다.',
  'FIRST VIEWPORT: 빨간 브랜드 띠와 4칸 진행선, 2줄 제목, 같은 지갑 안내, 펼쳐진 01 로그인 티켓과 02 보안 띠의 시작.',
  'FORM: 승인된 Four Work Receipts의 A안, 펼치는 작업 티켓. surface seed 3f899613.',
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
