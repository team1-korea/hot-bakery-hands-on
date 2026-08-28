'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { Ref } from 'react';

import type { Entry } from '@/lib/api/types';

import { CookieCard } from './CookieCard';
import { EventQr } from './EventQr';
import type { CardMotionPhase } from './displaySequence';
import { COUNTER_DURATION, DISPLAY_EASE, EASE_SETTLE } from './motion';

type LayoutTransition = { layout: { duration: number; ease: [number, number, number, number] } };

export function Workbench({
  entries,
  phases,
  qrVisible,
  qrSvg,
  onExpandQr,
  qrButtonRef,
  transition,
}: {
  entries: Entry[];
  phases: Map<string, CardMotionPhase>;
  qrVisible: boolean;
  qrSvg: string;
  onExpandQr: () => void;
  qrButtonRef: Ref<HTMLButtonElement>;
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
                <EventQr svg={qrSvg} onExpand={onExpandQr} buttonRef={qrButtonRef} />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="workbench-grid">
            <AnimatePresence initial={false}>
              {entries.map((entry, index) => {
                const progress = entries.length === 1 ? 0.5 : index / (entries.length - 1);
                return (
                  <div
                    className="queue-card-position"
                    key={entry.id}
                    style={{
                      left: `${progress * 100}%`,
                      transform: `translateX(${-progress * 100}%)`,
                      zIndex: index + 1,
                    }}
                  >
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
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
