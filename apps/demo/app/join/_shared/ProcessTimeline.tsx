import { PROCESS_STEPS } from './processSteps';

function DoneMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
    </svg>
  );
}

/**
 * 네 단계 진행 목록.
 * live — 진행 중인 한 단계만 앞으로 나온다.
 * review — 끝난 뒤 다시 볼 때. 네 단계를 같은 무게로 읽는다.
 */
export function ProcessTimeline({ phase, mode = 'live' }: {
  phase: number;
  mode?: 'live' | 'review';
}) {
  return (
    <ol className="process-steps" data-mode={mode}>
      {PROCESS_STEPS.map(([title, copy], index) => {
        const done = index < phase;
        return (
          <li className={index === phase ? 'is-current' : done ? 'is-past' : ''} key={title}>
            <i>{done ? <DoneMark /> : index + 1}</i>
            <span><b>{title}</b><small>{copy}</small></span>
          </li>
        );
      })}
    </ol>
  );
}
