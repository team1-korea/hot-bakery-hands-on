import type { ReactNode } from 'react';

import { BrandMark } from '@/components/BrandMark';

export const JOIN_STEPS = ['로그인', '사진', '이름', '제출'] as const;

/** `step`이 0이면 참가 흐름 밖이다. 밟을 수 없는 단계를 막대로 약속하지 않는다. */
export function JoinShell({ step, children }: { step: number; children: ReactNode }) {
  return (
    <main className="join">
      <header className="join-header">
        <div className="join-brand">
          <BrandMark />
          <strong>AVALANCHE BAKERY</strong>
        </div>
        {step > 0 ? (
          <ol className="join-progress" aria-label={`${JOIN_STEPS.length}단계 중 ${step}단계`}>
            {JOIN_STEPS.map((label, index) => (
              <li
                key={label}
                data-state={index + 1 === step ? 'current' : index + 1 < step ? 'done' : 'todo'}
              >
                <i />
                <span>{label}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </header>
      {children}
    </main>
  );
}
