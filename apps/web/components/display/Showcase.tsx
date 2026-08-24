'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import { SHELF_SLOTS, type Entry } from '@/lib/api/types';
import { C_CHAIN_EXPLORER_TX } from '@/lib/explorer';

import { CookieCard } from './CookieCard';
import type { CardMotionPhase } from './displaySequence';
import { SHOWCASE_COMPLETE_MS, SLOT_LIGHT_MS } from './motion';

type LayoutTransition = { layout: { duration: number; ease: [number, number, number, number] } };

export function Showcase({
  entries,
  phases,
  arrivalIds,
  landedCount,
  isMockServer,
  page,
  pageCount,
  onPage,
  onStartSession,
  transition,
}: {
  entries: Entry[];
  phases: Map<string, CardMotionPhase>;
  arrivalIds: Set<string>;
  landedCount: number;
  isMockServer: boolean;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  onStartSession?: () => void;
  transition: LayoutTransition;
}) {
  const reduceMotion = useReducedMotion();
  const previousCount = useRef(landedCount);
  const [fullPulse, setFullPulse] = useState(false);
  const firstSlot = page * SHELF_SLOTS;
  const slots = Array.from({ length: SHELF_SLOTS }, (_, offset) => (
    entries.find((entry) => entry.shelfIndex === firstSlot + offset)
  ));
  useEffect(() => {
    const reachedFull = previousCount.current < SHELF_SLOTS && landedCount === SHELF_SLOTS;
    previousCount.current = landedCount;
    if (!reachedFull || reduceMotion) {
      const clear = window.setTimeout(() => setFullPulse(false), 0);
      return () => window.clearTimeout(clear);
    }
    const startDelay = SLOT_LIGHT_MS;
    const start = window.setTimeout(() => setFullPulse(true), startDelay);
    const end = window.setTimeout(() => setFullPulse(false), startDelay + SHOWCASE_COMPLETE_MS);
    return () => { window.clearTimeout(start); window.clearTimeout(end); };
  }, [landedCount, reduceMotion]);

  return (
    <motion.section className={`showcase zone ${fullPulse ? 'is-complete' : ''}`} layout transition={transition}>
      <header className="showcase-heading">
        <h2>오늘의 진열장</h2>
        <div className="showcase-actions">
          {pageCount > 1 ? (
            <div className="shelf-pager">
              <button type="button" onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="이전 쪽">
                <PagerArrow direction="left" />
              </button>
              <strong>{page + 1} / {pageCount}</strong>
              <button
                type="button"
                onClick={() => onPage(page + 1)}
                disabled={page >= pageCount - 1}
                aria-label="다음 쪽"
              >
                <PagerArrow direction="right" />
              </button>
            </div>
          ) : null}
          {onStartSession && page === pageCount - 1 ? (
            <button
              className="showcase-session-next"
              type="button"
              aria-label="NFT 교육 세션으로 이동"
              onClick={onStartSession}
            >
              NEXT
              <PagerArrow direction="right" />
            </button>
          ) : null}
        </div>
      </header>
      <motion.div className="shelf-frame" layout transition={transition}>
        <div className="shelf-grid">
          <span className="shelf-rail rail-one" aria-hidden="true" />
          <span className="shelf-rail rail-two" aria-hidden="true" />
          <span className="shelf-rail rail-three" aria-hidden="true" />
          {slots.map((entry, index) => {
            const phase = entry ? phases.get(entry.id) : undefined;
            const arriving = phase === 'to-shelf';
            const lit = Boolean(entry && arrivalIds.has(entry.id));
            return (
              <motion.div
                className={`shelf-slot ${entry ? 'is-filled' : ''} ${arriving ? 'is-arriving' : ''} ${lit ? 'is-lit' : ''}`}
                key={index}
                layout
                transition={transition}
              >
                <span className="slot-light" aria-hidden="true" />
                {entry ? (
                  entry.txHash && !isMockServer ? (
                    <a
                      className="shelf-card-frame shelf-card-link"
                      href={`${C_CHAIN_EXPLORER_TX}/${encodeURIComponent(entry.txHash)}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${entry.nickname}의 블록체인 기록 보기`}
                    >
                      <CookieCard entry={entry} motionPhase={phase} />
                    </a>
                  ) : (
                    <div className="shelf-card-frame">
                      <CookieCard entry={entry} motionPhase={phase} />
                    </div>
                  )
                ) : (
                  <span className="empty-slot" aria-hidden="true">
                    <span className="shelf-number">{String(firstSlot + index + 1).padStart(2, '0')}</span>
                  </span>
                )}
              </motion.div>
            );
          })}
          <span className="shelf-glass" aria-hidden="true" />
        </div>
      </motion.div>
    </motion.section>
  );
}

function PagerArrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M15 4 7 12l8 8' : 'M9 4l8 8-8 8'}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
    </svg>
  );
}
