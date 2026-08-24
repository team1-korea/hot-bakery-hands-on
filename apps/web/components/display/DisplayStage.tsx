'use client';

import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { updateShow } from '@/lib/api/client';
import { useEventState } from '@/lib/useEventState';

import { BakeryScene } from './BakeryScene';
import { SESSION_SLIDES, SessionDeck } from './SessionDeck';

/** TV는 1920×1080 좌표계로 그리고 화면 크기에 맞춰 통째로 줄인다. */
function useStageScale() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return scale;
}

function DisplayView({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const enterClip = reduceMotion ? undefined : { clipPath: 'inset(0 0 0 100%)' };
  const visibleClip = { clipPath: 'inset(0 0 0 0)' };
  const exitClip = reduceMotion ? undefined : { clipPath: 'inset(0 100% 0 0)' };

  return (
    <motion.div
      className="display-view"
      initial={enterClip}
      animate={visibleClip}
      exit={exitClip}
      transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function DisplayStage({ qrSvg, isMockServer }: { qrSvg: string; isMockServer: boolean }) {
  const { state, stale, ready } = useEventState();
  const scale = useStageScale();
  const [sessionSlide, setSessionSlide] = useState<number | null>(null);
  const startSession = useCallback(() => setSessionSlide(0), []);
  const exitSession = useCallback(() => setSessionSlide(null), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) return;
      if (target instanceof HTMLElement && ['BUTTON', 'A'].includes(target.tagName) && event.key === ' ') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (sessionSlide === null) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        exitSession();
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        setSessionSlide(0);
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        setSessionSlide(SESSION_SLIDES.length - 1);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        setSessionSlide((current) => Math.max(0, (current ?? 0) - 1));
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        setSessionSlide((current) => Math.min(SESSION_SLIDES.length - 1, (current ?? 0) + 1));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exitSession, sessionSlide]);

  return (
    <main className="display-viewport">
      <MotionConfig reducedMotion="user">
        <div className="display-canvas" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
          <AnimatePresence initial={false} mode="wait">
            {sessionSlide === null ? (
              <DisplayView key="bakery">
                <BakeryScene
                  state={state}
                  stale={stale}
                  ready={ready}
                  qrSvg={qrSvg}
                  isMockServer={isMockServer}
                  onShelfPage={(page) => void updateShow({ shelfPage: page })}
                  onStartSession={startSession}
                />
              </DisplayView>
            ) : (
              <DisplayView key="session">
                <SessionDeck
                  slide={sessionSlide}
                  mintedCount={state.counts.minted}
                  stale={stale}
                  onSlide={setSessionSlide}
                  onExit={exitSession}
                />
              </DisplayView>
            )}
          </AnimatePresence>
        </div>
      </MotionConfig>
    </main>
  );
}
