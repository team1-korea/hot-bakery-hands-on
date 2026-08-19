'use client';

import { MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';

import { updateShow } from '@/lib/api/client';
import { useEventState } from '@/lib/useEventState';

import { BakeryScene } from './BakeryScene';

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

export function DisplayStage({ qrSvg }: { qrSvg: string }) {
  const state = useEventState();
  const scale = useStageScale();

  return (
    <main className="display-viewport">
      <MotionConfig reducedMotion="user">
        <div className="display-canvas" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
          <BakeryScene
            state={state}
            qrSvg={qrSvg}
            onShelfPage={(page) => void updateShow({ shelfPage: page })}
          />
        </div>
      </MotionConfig>
    </main>
  );
}
