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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko" className={`${archivoBlack.variable} ${gothicA1.variable}`}>
      <body>{children}</body>
    </html>
  );
}
