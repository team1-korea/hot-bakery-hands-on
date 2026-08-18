'use client';

import { AnimatePresence, motion } from 'framer-motion';

import type { Entry } from '@/lib/types';

import { CookieCard } from './CookieCard';
import { MockQr } from './MockQr';
import type { CardMotionPhase } from './displaySequence';
import { COUNTER_DURATION, DISPLAY_EASE, EASE_SETTLE } from './motion';

type LayoutTransition = { layout: { duration: number; ease: [number, number, number, number] } };

export function Workbench({
  entries,
  phases,
  qrVisible,
  transition,
}: {
  entries: Entry[];
  phases: Map<string, CardMotionPhase>;
  qrVisible: boolean;
  transition: LayoutTransition;
}) {
  const waitingCount = entries.filter((entry) => phases.get(entry.id) !== 'to-oven').length;

  return (
    <motion.section className={`workbench zone ${qrVisible ? 'has-qr' : ''}`} layout transition={transition}>
      <div className="workbench-surface">
        <header className="workbench-heading">
          <h2>오븐 대기</h2>
          <strong>{waitingCount}</strong>
        </header>
        <div className="workbench-content">
          <AnimatePresence initial={false}>
            {qrVisible ? (
              <motion.div
                className="qr-position"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.4, ease: DISPLAY_EASE }}
              >
                <MockQr />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="workbench-grid">
            <AnimatePresence initial={false}>
              {entries.map((entry, index) => (
                <div className={`queue-card-position ${index < entries.length - 3 ? 'is-buried' : ''}`} key={entry.id}>
                  {phases.get(entry.id) === 'to-oven' ? (
                    <span className="queue-card-placeholder" aria-hidden="true" />
                  ) : (
                    <CookieCard
                      entry={entry}
                      motionPhase={phases.get(entry.id)}
                      layoutDuration={COUNTER_DURATION}
                      layoutEase={EASE_SETTLE}
                    />
                  )}
                </div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
