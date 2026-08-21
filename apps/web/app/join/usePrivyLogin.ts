'use client';

import { getAccessToken, useLogin as usePrivyLoginHook, usePrivy } from '@privy-io/react-auth';
import { useCallback, useEffect, useRef } from 'react';

import { setAuthTokenGetter } from '@/lib/api/client';

import { PRIVY_ENABLED } from './PrivyClientProvider';

type PrivyLoginResult = {
  login: () => Promise<void>;
  authenticated: boolean;
};

function useRealPrivyLogin(): PrivyLoginResult {
  const { authenticated } = usePrivy();
  const resolveRef = useRef<(() => void) | null>(null);
  const rejectRef = useRef<((reason: Error) => void) | null>(null);

  useEffect(() => {
    if (authenticated) {
      setAuthTokenGetter(() => getAccessToken());
    }
    return () => setAuthTokenGetter(null);
  }, [authenticated]);

  const { login: triggerLogin } = usePrivyLoginHook({
    onComplete: () => resolveRef.current?.(),
    onError: (error) => rejectRef.current?.(new Error(String(error))),
  });

  const login = useCallback(() => {
    if (authenticated) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
      triggerLogin();
    });
  }, [authenticated, triggerLogin]);

  return { login, authenticated };
}

function useMockLogin(): PrivyLoginResult {
  return {
    login: () => Promise.resolve(),
    authenticated: true,
  };
}

export function usePrivyLogin(): PrivyLoginResult {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return PRIVY_ENABLED ? useRealPrivyLogin() : useMockLogin();
}
