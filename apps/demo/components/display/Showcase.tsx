'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import type { Entry } from '@/lib/types';

import { CookieCard } from './CookieCard';
import type { CardMotionPhase } from './displaySequence';
import { SHOWCASE_COMPLETE_MS, SLOT_LIGHT_MS } from './motion';

type LayoutTransition = { layout: { duration: number; ease: [number, number, number, number] } };
const C_CHAIN_EXPLORER_TX = 'https://build.avax.network/explorer/c-chain/tx';

export function Showcase({
  entries,
  phases,
  arrivalIds,
  landedCount,
  transition,
}: {
  entries: Entry[];
  phases: Map<string, CardMotionPhase>;
  arrivalIds: Set<string>;
  landedCount: number;
  transition: LayoutTransition;
}) {
  const reduceMotion = useReducedMotion();
  const previousCount = useRef(landedCount);
  const [fullPulse, setFullPulse] = useState(false);
  const slots = Array.from({ length: 15 }, (_, shelfIndex) => (
    entries.find((entry) => entry.shelfIndex === shelfIndex)
  ));
  useEffect(() => {
    const reachedFull = previousCount.current < 15 && landedCount === 15;
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
      <header className="showcase-heading"><h2>오늘의 진열장</h2></header>
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
                  entry.txHash ? (
                    <a
                      className="shelf-card-link"
                      href={`${C_CHAIN_EXPLORER_TX}/${encodeURIComponent(entry.txHash)}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${entry.nickname}의 발행 기록 보기`}
                    >
                      <CookieCard entry={entry} motionPhase={phase} recordLink />
                    </a>
                  ) : (
                    <CookieCard entry={entry} motionPhase={phase} />
                  )
                ) : (
                  <span className="empty-slot" aria-hidden="true">
                    <span className="shelf-number">{String(index + 1).padStart(2, '0')}</span>
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
