'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export const PRIVY_ENABLED = Boolean(PRIVY_APP_ID);

export function PrivyClientProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return children;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['google'],
        appearance: {
          theme: 'light',
          accentColor: '#e84142',
          landingHeader: 'Avalanche Bakery',
          loginMessage: '구글 계정으로 참가하세요',
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'all-users' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
