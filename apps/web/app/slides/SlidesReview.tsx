'use client';

import { useCallback, useEffect, useState } from 'react';

import { SESSION_SLIDES, SessionDeck } from '@/components/display/SessionDeck';

function hashSlide() {
  if (typeof window === 'undefined') return 0;
  const index = Number(window.location.hash.slice(1)) - 1;
  return Number.isInteger(index) && index >= 0 && index < SESSION_SLIDES.length ? index : 0;
}

export function SlidesReview() {
  const [slide, setSlide] = useState(0);
  const [scale, setScale] = useState(1);

  const showSlide = useCallback((next: number) => {
    const clamped = Math.min(Math.max(next, 0), SESSION_SLIDES.length - 1);
    setSlide(clamped);
    window.history.replaceState(null, '', `#${clamped + 1}`);
  }, []);

  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    const frame = window.requestAnimationFrame(() => {
      setSlide(hashSlide());
      resize();
    });
    window.addEventListener('resize', resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Home') showSlide(0);
      if (event.key === 'End') showSlide(SESSION_SLIDES.length - 1);
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') showSlide(slide - 1);
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        showSlide(slide + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSlide, slide]);

  return (
    <main className="display-viewport">
      <div
        className="display-canvas"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <SessionDeck
          slide={slide}
          stale={false}
          onSlide={showSlide}
          onExit={() => showSlide(0)}
          exitLabel="처음부터 다시 보기"
        />
      </div>
    </main>
  );
}
