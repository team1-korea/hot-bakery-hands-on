'use client';

import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BakeryScene } from '@/components/display/BakeryScene';

import { DemoPhone } from './DemoPhone';
import { DemoSetup } from './DemoSetup';
import { SimulationControls } from './SimulationControls';
import {
  DEFAULT_PARTICIPANTS,
  makeSimulationState,
  participantLocalTime,
  sessionDuration,
  type DemoVariant,
  type DemoView,
  type SubmissionPattern,
} from './demoState';

type SessionConfig = {
  variant: DemoVariant;
  participantCount: number;
  pattern: SubmissionPattern;
};

// 조작 바는 두 관찰 화면에서 같은 자리(아래 가운데)에 있어야 한다.
// TV는 그 바가 앉을 띠를 아래에 비워 두고 그만큼 작게 그린다.
const CONTROL_BAND = 96;

function useViewportScale(width: number, height: number, reserve = 0) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const resize = () => setScale(Math.min(
      window.innerWidth / width,
      Math.max(0, window.innerHeight - reserve) / height,
    ));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [height, reserve, width]);
  return scale;
}

function isEditable(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

function readConfig(params: URLSearchParams, fallbackVariant: DemoVariant): SessionConfig {
  const count = Number.parseInt(params.get('n') ?? '', 10);
  return {
    variant: params.get('v') === 'b' ? 'b' : params.get('v') === 'a' ? 'a' : fallbackVariant,
    participantCount: Number.isFinite(count) ? Math.min(15, Math.max(1, count)) : DEFAULT_PARTICIPANTS,
    pattern: params.get('p') === 'sequential' ? 'SEQUENTIAL' : 'BURST',
  };
}

function sessionQuery({ variant, participantCount, pattern }: SessionConfig) {
  return `?run=1&v=${variant}&n=${participantCount}&p=${pattern.toLowerCase()}`;
}

export function DemoExperience({ initialVariant = 'a' }: { initialVariant?: DemoVariant }) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // 재생 중인 세션은 주소에 남는다. 브라우저 뒤로 가기가 설정 화면으로 돌아오고,
  // 같은 주소를 다시 열면 같은 조건이 재생된다.
  const running = params.get('run') === '1';
  const query = params.toString();
  const pushedRef = useRef(false);

  const [draft, setDraft] = useState<SessionConfig>(() => readConfig(new URLSearchParams(query), initialVariant));
  const session = running ? readConfig(new URLSearchParams(query), initialVariant) : draft;
  const { variant, participantCount, pattern } = session;

  const [view, setView] = useState<DemoView>('phone');
  const [selectedParticipant, setSelectedParticipant] = useState(0);
  const [playing, setPlaying] = useState(running);
  const [elapsed, setElapsed] = useState(0);

  // 주소가 바뀌면 그 조건으로 세션을 처음부터 다시 재생한다.
  const runKey = `${running ? 'run' : 'setup'}|${query}`;
  const [lastRunKey, setLastRunKey] = useState(runKey);
  if (runKey !== lastRunKey) {
    setLastRunKey(runKey);
    setView('phone');
    setSelectedParticipant(0);
    setElapsed(0);
    setPlaying(running);
    if (running) setDraft(readConfig(new URLSearchParams(query), initialVariant));
  }
  const duration = sessionDuration(participantCount, pattern);
  const showingTv = running && view === 'tv';
  const scale = useViewportScale(showingTv ? 1920 : 1600, showingTv ? 1080 : 900, showingTv ? CONTROL_BAND : 0);
  const state = makeSimulationState(participantCount, elapsed, pattern);
  const phoneLocalMs = participantLocalTime(selectedParticipant, elapsed, pattern);
  const complete = elapsed >= duration;

  const start = useCallback(() => {
    pushedRef.current = true;
    router.push(`${pathname}${sessionQuery(draft)}`);
  }, [draft, pathname, router]);
  const reset = useCallback(() => {
    setElapsed(0);
    setPlaying(true);
  }, []);
  const openSetup = useCallback(() => {
    setPlaying(false);
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
      return;
    }
    router.push(pathname);
  }, [pathname, router]);

  useEffect(() => {
    if (!running || !playing) return;
    const interval = window.setInterval(() => {
      setElapsed((current) => {
        const next = Math.min(current + 100, duration);
        if (next >= duration) window.clearInterval(interval);
        return next;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [duration, playing, running]);
  useEffect(() => {
    if (!running) return;
    const keydown = (event: KeyboardEvent) => {
      if (isEditable(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'p') setView('phone');
      else if (key === 't') setView('tv');
      else if (key === 'r') reset();
      else if (event.key === 'Escape') openSetup();
      else if (event.code === 'Space' && !complete) {
        event.preventDefault();
        setPlaying((current) => !current);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [complete, openSetup, reset, running]);

  if (!running) {
    return (
      <DemoSetup
        variant={variant}
        participantCount={participantCount}
        pattern={pattern}
        scale={scale}
        onVariant={(next) => setDraft((current) => ({ ...current, variant: next }))}
        onParticipantCount={(next) => setDraft((current) => ({ ...current, participantCount: next }))}
        onPattern={(next) => setDraft((current) => ({ ...current, pattern: next }))}
        onStart={start}
      />
    );
  }

  const transition = { duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] as const };
  return (
    <main className="simulation-viewport">
      <MotionConfig reducedMotion="user">
        <AnimatePresence initial={false}>
          {view === 'phone' ? (
            <motion.section className="simulation-stage" key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
              <div className="simulation-phone-canvas" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
                <div className="simulation-paper-plane" aria-hidden="true" />
                <div className="simulation-bench-plane" aria-hidden="true" />
                <article className="simulation-phone-device" aria-label={`${selectedParticipant + 1}번째 참가자 휴대폰`}>
                  <i className="simulation-speaker" aria-hidden="true" />
                  <i className="simulation-volume" aria-hidden="true" />
                  <i className="simulation-power" aria-hidden="true" />
                  <div className="simulation-phone-screen">
                    <div className="simulation-phone-scale">
                      <DemoPhone
                        variant={variant}
                        participantIndex={selectedParticipant}
                        localMs={phoneLocalMs}
                        pattern={pattern}
                      />
                    </div>
                  </div>
                </article>
              </div>
            </motion.section>
          ) : (
            <motion.section className="simulation-stage" key="tv" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>
              <div
                className="simulation-tv-canvas"
                style={{ top: `calc(50% - ${CONTROL_BAND / 2}px)`, transform: `translate(-50%, -50%) scale(${scale})` }}
              >
                <BakeryScene state={state} />
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </MotionConfig>
      <SimulationControls
        variant={variant}
        participantCount={participantCount}
        selectedParticipant={selectedParticipant}
        submittedCount={state.counts.submitted}
        view={view}
        playing={playing && !complete}
        complete={complete}
        onView={setView}
        onParticipant={(offset) => setSelectedParticipant((current) => (
          Math.min(participantCount - 1, Math.max(0, current + offset))
        ))}
        onTogglePlaying={() => setPlaying((current) => !current)}
        onReset={reset}
        onSetup={openSetup}
      />
    </main>
  );
}
