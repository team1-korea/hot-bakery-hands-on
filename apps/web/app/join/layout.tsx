import type { ReactNode } from 'react';

import { PrivyClientProvider } from './PrivyClientProvider';

export default function JoinLayout({ children }: { children: ReactNode }) {
  return <PrivyClientProvider>{children}</PrivyClientProvider>;
}
