import type { Metadata } from 'next';
import { headers } from 'next/headers';
import QRCode from 'qrcode';

import { DisplayStage } from '@/components/display/DisplayStage';

import './display.css';

/** 행사장에서 켜 두는 화면이라 캐시하지 않는다. */
export const dynamic = 'force-dynamic';

/** 행사장 안에서만 쓰는 화면이다. 검색 결과에 나올 이유가 없다. */
export const metadata: Metadata = {
  title: '행사장 화면 · Avalanche Bakery',
  robots: { index: false, follow: false },
};

async function joinUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL('/join', configured).toString();

  // 행사장에서는 노트북의 LAN 주소로 접속한다. 요청 호스트를 그대로 쓴다.
  const list = await headers();
  const host = list.get('host') ?? 'localhost:3000';
  const protocol = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}/join`;
}

export default async function DisplayPage() {
  const svg = await QRCode.toString(await joinUrl(), {
    type: 'svg',
    margin: 0,
    color: { dark: '#17110f', light: '#f7f1e8' },
  });

  return <DisplayStage qrSvg={svg} />;
}
