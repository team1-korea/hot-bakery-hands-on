'use client';

import { useState } from 'react';

import { ExitLink } from '@/components/nav/ExitLink';

import type { DemoVariant, DemoView } from './demoState';

export function SimulationControls({
  variant,
  participantCount,
  selectedParticipant,
  submittedCount,
  view,
  playing,
  complete,
  onView,
  onParticipant,
  onTogglePlaying,
  onReset,
  onSetup,
}: {
  variant: DemoVariant;
  participantCount: number;
  selectedParticipant: number;
  submittedCount: number;
  view: DemoView;
  playing: boolean;
  complete: boolean;
  onView: (view: DemoView) => void;
  onParticipant: (offset: number) => void;
  onTogglePlaying: () => void;
  onReset: () => void;
  onSetup: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const variantLabel = variant === 'a' ? '앞 화면 중심' : '단계 확인';

  const chooseView = (nextView: DemoView) => {
    onView(nextView);
    setExpanded(false);
  };

  return (
    <aside className="simulation-controls" data-view={view} data-tools-open={expanded} aria-label="시뮬레이션 조작">
      <div className="simulation-exit">
        <ExitLink label="설정 화면" onClick={onSetup} tone="paper" />
      </div>
      <div className="simulation-status" role="status" aria-live="polite">
        <b>{variantLabel}</b>
        <span>{complete ? '완료' : view === 'phone'
          ? `내 쿠키 ${String(selectedParticipant + 1).padStart(2, '0')}`
          : `도착 ${String(submittedCount).padStart(2, '0')} / ${String(participantCount).padStart(2, '0')}`}</span>
      </div>
      <div className="simulation-view-switch" role="group" aria-label="관찰 화면">
        <button type="button" aria-pressed={view === 'phone'} onClick={() => chooseView('phone')}>참가자 폰</button>
        <button type="button" aria-pressed={view === 'tv'} onClick={() => chooseView('tv')}>행사장 TV</button>
      </div>
      <div className="simulation-tools">
        <button
          type="button"
          className="simulation-tools-trigger"
          aria-expanded={expanded}
          aria-controls="simulation-tools-menu"
          onClick={() => setExpanded((current) => !current)}
        >
          데모 조작
        </button>
        <div
          id="simulation-tools-menu"
          className="simulation-tools-menu"
          data-open={expanded}
          aria-hidden={!expanded}
          inert={!expanded}
        >
          <div className="simulation-action-group">
            <span>참가자 보기</span>
            <div>
              <button type="button" onClick={() => onParticipant(-1)} disabled={selectedParticipant === 0}>이전 참가자</button>
              <button type="button" onClick={() => onParticipant(1)} disabled={selectedParticipant === participantCount - 1}>다음 참가자</button>
            </div>
          </div>
          <div className="simulation-action-group">
            <span>재생</span>
            <div>
              <button type="button" onClick={onTogglePlaying} disabled={complete}>{playing ? '일시정지' : '계속 재생'}</button>
              <button type="button" onClick={onReset}>처음부터</button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
