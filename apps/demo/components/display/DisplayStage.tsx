'use client';

import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { ExitLink } from '@/components/nav/ExitLink';
import { mockControls, useShowState } from '@/hooks/useShowState';
import { useDemoLoop } from '@/hooks/useDemoLoop';

import { BakeryScene } from './BakeryScene';
import { DevPanel } from './DevPanel';
import { SlidesShell } from './SlidesShell';
import { DISPLAY_DURATION, DISPLAY_EASE } from './motion';

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const resize = () => setScale(Math.min(
      window.innerWidth / 1920,
      window.innerHeight / 1080,
    ));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return scale;
}

export function DisplayStage({ devMode = false }: { devMode?: boolean }) {
  const state = useShowState();
  useDemoLoop(!devMode);
  const scale = useStageScale();
  const reduceMotion = useReducedMotion();

  return (
    <main className="display-viewport">
      <MotionConfig reducedMotion="user">
        <div
          className="display-canvas"
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {state.show.mode === 'SLIDES' ? (
              <motion.div
                key="slides"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : DISPLAY_DURATION, ease: DISPLAY_EASE }}
              >
                <SlidesShell slideIndex={state.show.slideIndex} />
              </motion.div>
            ) : (
              <motion.div
                key="bakery"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : DISPLAY_DURATION, ease: DISPLAY_EASE }}
              >
                <BakeryScene state={state} />
              </motion.div>
            )}
          </AnimatePresence>
          {devMode ? <DevPanel state={state} controls={mockControls} /> : null}
        </div>
        <div className="display-exit">
          <ExitLink label="처음 화면" href="/" tone="quiet" />
        </div>
      </MotionConfig>
    </main>
  );
}
