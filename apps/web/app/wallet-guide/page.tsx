import type { Metadata } from 'next';

import { WalletGuide } from './WalletGuide';
import './wallet-guide.css';

export const metadata: Metadata = {
  title: '참가증서 확인 및 지갑 안내 | Avalanche Bakery',
  description: 'OpenSea에서 참가증서를 확인하고, Core Wallet에서 같은 지갑을 이용하는 과정을 안전하게 안내합니다.',
};

export default function WalletGuidePage() {
  return <WalletGuide />;
}
