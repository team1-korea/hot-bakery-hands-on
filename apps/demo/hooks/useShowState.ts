'use client';

import { useSyncExternalStore } from 'react';

import { mockActions, mockStore } from '@/lib/mockStore';

export function useShowState() {
  return useSyncExternalStore(
    mockStore.subscribe,
    mockStore.getSnapshot,
    mockStore.getSnapshot,
  );
}

// Dev-only controls stay behind the same adapter boundary as state reads.
export const mockControls = mockActions;
