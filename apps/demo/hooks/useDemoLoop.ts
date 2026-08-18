'use client';

import { useEffect } from 'react';

import { participantTiming } from '@/lib/mockScenario';

import { mockControls } from './useShowState';

const LOOP_DURATION = 30_000;
const PARTICIPANT_COUNT = 15;

export function useDemoLoop(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timers = new Set<number>();
    const later = (callback: () => void, delay: number) => {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (active) callback();
      }, delay);
      timers.add(timer);
    };

    const runCycle = () => {
      mockControls.reset();
      for (let index = 0; index < PARTICIPANT_COUNT; index += 1) {
        const entryId = `entry-${index + 1}`;
        const timing = participantTiming(index, 'BURST');
        later(() => mockControls.addParticipants(1), timing.submittedAt);
        later(() => mockControls.advanceOne(entryId), timing.renderedAt);
        later(() => mockControls.advanceOne(entryId), timing.pinnedAt);
        later(() => mockControls.advanceOne(entryId), timing.mintingAt);
        later(() => mockControls.advanceOne(entryId), timing.mintedAt);
      }
      later(runCycle, LOOP_DURATION);
    };

    runCycle();
    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, [enabled]);
}
