'use client';

import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

import { SHELF_SLOTS, type EntryStatus, type StateResponse } from '@/lib/api/types';

import { Oven } from './Oven';
import { Showcase } from './Showcase';
import { TopBar } from './TopBar';
import { Workbench } from './Workbench';
import { useDisplaySequence } from './displaySequence';
import { DISPLAY_EASE } from './motion';

/** 작업대는 사람 손이 필요한 것만 놓인다 — 아직 사진을 안 낸 사람과 실패한 사람. */
const WORKBENCH_STATUSES = new Set<EntryStatus>(['JOINED', 'FAILED']);

/** 오븐은 기계가 처리 중인 것이 놓인다. 제출 순간부터 영수증 확인까지다. */
const OVEN_STATUSES = new Set<EntryStatus>(['SUBMITTED', 'PINNED', 'MINTING']);

export function BakeryScene({
  state,
  stale,
  ready,
  qrSvg,
  isMockServer,
  onShelfPage,
}: {
  state: StateResponse;
  stale: boolean;
  ready: boolean;
  qrSvg: string;
  isMockServer: boolean;
  onShelfPage: (page: number) => void;
}) {
  const reduceMotion = useReducedMotion();
  const sequence = useDisplaySequence(state.entries, Boolean(reduceMotion), ready);
  const visibleEntries = useMemo(
    () => sequence.entries.filter((entry) => !entry.hidden),
    [sequence.entries],
  );
  /*
   * 오븐은 4칸뿐이다. 다섯 명이 한꺼번에 제출하면 자리가 날 때까지 작업대에서 기다린다.
   * 그동안은 오븐 상태여도 작업대에 그려야 카드가 사라지지 않는다.
   */
  const workbenchEntries = visibleEntries.filter((entry) => (
    WORKBENCH_STATUSES.has(entry.status) || sequence.phases.get(entry.id) === 'to-oven'
    || (OVEN_STATUSES.has(entry.status) && !sequence.ovenSlots.has(entry.id))
  ));
  const ovenEntries = visibleEntries.filter((entry) => (
    sequence.phases.get(entry.id) === 'to-oven'
    || (OVEN_STATUSES.has(entry.status) && sequence.ovenSlots.has(entry.id))
    || sequence.phases.get(entry.id) === 'to-shelf'
  ));
  const shelfEntries = visibleEntries.filter((entry) => (
    entry.status === 'MINTED' || sequence.phases.get(entry.id) === 'to-shelf'
  ));
  const pageCount = Math.max(
    1,
    Math.ceil((Math.max(...shelfEntries.map((entry) => entry.shelfIndex ?? 0), -1) + 1) / SHELF_SLOTS),
  );
  const page = Math.min(state.show.shelfPage, pageCount - 1);
  const layoutTransition = {
    layout: {
      duration: reduceMotion ? 0 : 0.65,
      ease: DISPLAY_EASE,
    },
  };

  return (
    <section className="bakery-scene">
      <TopBar stale={stale} />
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
              qrSvg={qrSvg}
              transition={layoutTransition}
            />
          </motion.div>
          <Showcase
            entries={shelfEntries}
            phases={sequence.phases}
            arrivalIds={sequence.arrivalIds}
            landedCount={sequence.counts.minted}
            isMockServer={isMockServer}
            page={page}
            pageCount={pageCount}
            onPage={onShelfPage}
            transition={layoutTransition}
          />
        </motion.div>
      </LayoutGroup>
    </section>
  );
}
