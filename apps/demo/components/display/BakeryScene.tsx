'use client';

import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

import type { EntryStatus, StateResponse } from '@/lib/types';

import { Oven } from './Oven';
import { Showcase } from './Showcase';
import { TopBar } from './TopBar';
import { Workbench } from './Workbench';
import { useDisplaySequence } from './displaySequence';
import { DISPLAY_EASE } from './motion';

const WORKBENCH_STATUSES = new Set<EntryStatus>([
  'SUBMITTED',
  'RENDERED',
  'PINNED',
  'FAILED',
]);

export function BakeryScene({
  state,
}: {
  state: StateResponse;
}) {
  const reduceMotion = useReducedMotion();
  const sequence = useDisplaySequence(state.entries, Boolean(reduceMotion));
  const visibleEntries = useMemo(
    () => sequence.entries.filter((entry) => !entry.hidden),
    [sequence.entries],
  );
  const workbenchEntries = visibleEntries.filter((entry) => (
    WORKBENCH_STATUSES.has(entry.status) || sequence.phases.get(entry.id) === 'to-oven'
    || (entry.status === 'MINTING' && !sequence.ovenSlots.has(entry.id))
  ));
  const ovenEntries = visibleEntries.filter((entry) => (
    sequence.phases.get(entry.id) === 'to-oven'
    || (entry.status === 'MINTING' && sequence.ovenSlots.has(entry.id))
    || sequence.phases.get(entry.id) === 'to-shelf'
  ));
  const shelfEntries = visibleEntries.filter((entry) => (
    entry.status === 'MINTED' || sequence.phases.get(entry.id) === 'to-shelf'
  ));
  const layoutTransition = {
    layout: {
      duration: reduceMotion ? 0 : 0.65,
      ease: DISPLAY_EASE,
    },
  };

  return (
    <section className="bakery-scene">
      <TopBar />
      <LayoutGroup id="bakery-entry-flow">
        <motion.div
          className="bakery-floor"
          data-layout={state.show.layout.toLowerCase()}
          layout
          transition={layoutTransition}
        >
          <motion.div className="production-wall" layout transition={layoutTransition}>
            <Oven
              entries={ovenEntries}
              phases={sequence.phases}
              slots={sequence.ovenSlots}
              flowActive={sequence.boundaryBusy}
              transition={layoutTransition}
            />
            <Workbench
              entries={workbenchEntries}
              phases={sequence.phases}
              qrVisible={state.show.qrVisible && state.show.layout === 'LIVE'}
              transition={layoutTransition}
            />
          </motion.div>
          <Showcase
            entries={shelfEntries}
            phases={sequence.phases}
            arrivalIds={sequence.arrivalIds}
            landedCount={sequence.counts.minted}
            transition={layoutTransition}
          />
        </motion.div>
      </LayoutGroup>
    </section>
  );
}
