import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PrivyClientProvider } from '@/app/join/PrivyClientProvider';

export const metadata: Metadata = {
  title: 'Core에서 참가증서 확인하기 | Avalanche Bakery',
  description: '행사 때 사용한 지갑을 Core 모바일에서 열고 참가증서를 확인하는 안내입니다.',
};

export default function WalletGuideLayout({ children }: { children: ReactNode }) {
  return <PrivyClientProvider>{children}</PrivyClientProvider>;
}
