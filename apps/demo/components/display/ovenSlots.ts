'use client';

import { useCallback, useRef, useState } from 'react';

import type { Entry } from '@/lib/types';

const OVEN_SLOT_COUNT = 4;

function slotsFor(entries: Entry[]) {
  return new Map(entries
    .filter((entry) => entry.status === 'MINTING')
    .slice(0, OVEN_SLOT_COUNT)
    .map((entry, index) => [entry.id, index] as const));
}

export function firstOpenOvenSlot(slots: Map<string, number>) {
  const used = new Set(slots.values());
  return Array.from({ length: OVEN_SLOT_COUNT }, (_, index) => index)
    .find((index) => !used.has(index));
}

export function useOvenSlots(source: Entry[]) {
  const [ovenSlots, setOvenSlots] = useState(() => slotsFor(source));
  const slotsRef = useRef(ovenSlots);

  const replace = useCallback((next: Map<string, number>) => {
    slotsRef.current = next;
    setOvenSlots(next);
  }, []);

  const resetOvenSlots = useCallback((entries: Entry[]) => {
    replace(slotsFor(entries));
  }, [replace]);

  const assignOvenSlot = useCallback((id: string) => {
    if (slotsRef.current.has(id)) return;
    const next = new Map(slotsRef.current);
    const openSlot = firstOpenOvenSlot(next);
    if (openSlot === undefined) return;
    next.set(id, openSlot);
    replace(next);
  }, [replace]);

  const releaseOvenSlot = useCallback((id: string) => {
    const releasedSlot = slotsRef.current.get(id);
    if (releasedSlot === undefined) return;
    const next = new Map(slotsRef.current);
    next.delete(id);
    replace(next);
  }, [replace]);

  const hasOpenOvenSlot = useCallback(() => (
    firstOpenOvenSlot(slotsRef.current) !== undefined
  ), []);
  const hasOvenSlot = useCallback((id: string) => slotsRef.current.has(id), []);

  return {
    ovenSlots,
    assignOvenSlot,
    releaseOvenSlot,
    resetOvenSlots,
    hasOpenOvenSlot,
    hasOvenSlot,
  };
}
