import { JOIN_VARIANTS } from '@/app/join/_shared/variants';
import { ExitLink } from '@/components/nav/ExitLink';

import type { DemoVariant, SubmissionPattern } from './demoState';

export function DemoSetup({
  variant,
  participantCount,
  pattern,
  scale,
  onVariant,
  onParticipantCount,
  onPattern,
  onStart,
}: {
  variant: DemoVariant;
  participantCount: number;
  pattern: SubmissionPattern;
  scale: number;
  onVariant: (variant: DemoVariant) => void;
  onParticipantCount: (count: number) => void;
  onPattern: (pattern: SubmissionPattern) => void;
  onStart: () => void;
}) {
  const setCount = (count: number) => onParticipantCount(Math.min(15, Math.max(1, count)));

  return (
    <main className="simulation-viewport">
      <div className="setup-canvas" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <section className="setup-brand-panel">
          <div className="setup-exit">
            <ExitLink label="처음 화면" href="/" tone="paper" />
          </div>
          <svg className="setup-brand-mark" viewBox="0 0 1503 1504" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M1502.5 752c0 414.77-336.23 751-751 751-414.766 0-751-336.23-751-751C.5 337.234 336.734 1 751.5 1c414.77 0 751 336.234 751 751Zm-963.812 298.86H392.94c-30.626 0-45.754 0-54.978-5.9-9.963-6.46-16.051-17.16-16.789-28.97-.554-10.88 7.011-24.168 22.139-50.735l359.87-634.32c15.313-26.936 23.061-40.404 32.839-45.385 10.516-5.35 23.062-5.35 33.578 0 9.778 4.981 17.527 18.449 32.839 45.385l73.982 129.144.377.659c16.539 28.897 24.926 43.551 28.588 58.931 4.058 16.789 4.058 34.5 0 51.289-3.69 15.497-11.992 30.257-28.781 59.591L687.573 964.702l-.489.856c-16.648 29.135-25.085 43.902-36.778 55.042-12.73 12.18-28.043 21.03-44.832 26.02-15.313 4.24-32.47 4.24-66.786 4.24Zm368.062 0h208.84c30.81 0 46.31 0 55.54-6.08 9.96-6.46 16.23-17.35 16.79-29.15.53-10.53-6.87-23.3-21.37-48.323-.5-.852-1-1.719-1.51-2.601L1060.43 785.75l-1.19-2.015c-14.7-24.858-22.12-37.411-31.65-42.263-10.51-5.351-22.88-5.351-33.391 0-9.594 4.981-17.342 18.08-32.655 44.462L857.306 964.891l-.357.616c-15.259 26.34-22.885 39.503-22.335 50.303.738 11.81 6.826 22.69 16.788 29.15 9.041 5.9 24.538 5.9 55.348 5.9Z" fill="currentColor" />
          </svg>
          <h1>행사 흐름을<br />직접 돌려봐요</h1>
          <p>사진을 보내는 순간부터 TV에 증서가 놓일 때까지 같은 시간으로 이어집니다.</p>
          <ol className="setup-flow-summary">
            <li><b>참가 경험</b><span>제출 뒤 휴대폰이 무엇을 보여줄지</span></li>
            <li><b>제출 간격</b><span>사람들이 얼마나 몰려서 보낼지</span></li>
            <li><b>참가 인원</b><span>한 번에 재생할 쿠키 수</span></li>
          </ol>
        </section>

        <section className="setup-form-panel">
          <header>
            <h2>먼저 참가자 화면을 골라요</h2>
            <p>두 안의 차이는 제출을 마친 뒤 휴대폰에서 시작됩니다.</p>
          </header>
          <div className="setup-variants">
            {JOIN_VARIANTS.map((item) => (
              <button
                type="button"
                aria-pressed={variant === item.id}
                onClick={() => onVariant(item.id)}
                key={item.id}
              >
                <b>{item.id.toUpperCase()}</b>
                <span><strong>{item.title}</strong><small>{item.copy}</small></span>
              </button>
            ))}
          </div>

          <section className="setup-pattern">
            <header><h3>사진이 들어오는 간격</h3><p>실제 행사처럼 서로 다른 간격과 한 명씩 차례로 보내는 흐름을 비교할 수 있어요.</p></header>
            <div role="group" aria-label="제출 흐름">
              <button type="button" aria-pressed={pattern === 'BURST'} onClick={() => onPattern('BURST')}>
                <strong>서로 다른 간격</strong><small>0.5~1.5초 사이</small>
              </button>
              <button type="button" aria-pressed={pattern === 'SEQUENTIAL'} onClick={() => onPattern('SEQUENTIAL')}>
                <strong>한 명씩 차례로</strong><small>완료 후 다음 참가자</small>
              </button>
            </div>
          </section>

          <div className="setup-count">
            <div role="status" aria-live="polite"><span>참가 인원</span><strong>{String(participantCount).padStart(2, '0')}</strong><small>/ 15명</small></div>
            <div className="count-stepper">
              <button type="button" onClick={() => setCount(participantCount - 1)} disabled={participantCount === 1} aria-label="참가자 한 명 줄이기">−</button>
              <button type="button" onClick={() => setCount(participantCount + 1)} disabled={participantCount === 15} aria-label="참가자 한 명 늘리기">+</button>
            </div>
            <div className="count-presets">
              {[5, 10, 15].map((count) => <button type="button" aria-pressed={participantCount === count} onClick={() => setCount(count)} key={count}>{count}명</button>)}
            </div>
          </div>

          <button className="setup-start" type="button" onClick={onStart}>
            {participantCount}명 시뮬레이션 시작
          </button>
        </section>
      </div>
    </main>
  );
}
