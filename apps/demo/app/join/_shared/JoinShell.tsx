import type { ReactNode } from 'react';

import { ExitLink } from '@/components/nav/ExitLink';

import { STEP_LABELS } from './joinTypes';
import type { JoinVariantId } from './variants';

export type JoinBack = {
  label: string;
  href?: string;
  onBack?: () => void;
};

export function JoinShell({
  currentStep,
  children,
  embedded = false,
  back,
  variant,
}: {
  currentStep: number;
  children: ReactNode;
  embedded?: boolean;
  /** 데모 안의 폰에는 두지 않는다. 관찰자는 시뮬레이터 조작기로 빠져나간다. */
  back?: JoinBack;
  /** 지금 보고 있는 안을 화면 안에서 계속 알려 준다. 데모 안의 폰에는 두지 않는다. */
  variant?: JoinVariantId;
}) {
  return (
    <main className={`join-page ${embedded ? 'is-embedded' : ''}`}>
      <div className="join-phone-canvas">
        <header className="join-header">
          <div className="join-brand">
            <svg className="join-brand-mark" viewBox="0 0 1503 1504" aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M1502.5 752c0 414.77-336.23 751-751 751-414.766 0-751-336.23-751-751C.5 337.234 336.734 1 751.5 1c414.77 0 751 336.234 751 751Zm-963.812 298.86H392.94c-30.626 0-45.754 0-54.978-5.9-9.963-6.46-16.051-17.16-16.789-28.97-.554-10.88 7.011-24.168 22.139-50.735l359.87-634.32c15.313-26.936 23.061-40.404 32.839-45.385 10.516-5.35 23.062-5.35 33.578 0 9.778 4.981 17.527 18.449 32.839 45.385l73.982 129.144.377.659c16.539 28.897 24.926 43.551 28.588 58.931 4.058 16.789 4.058 34.5 0 51.289-3.69 15.497-11.992 30.257-28.781 59.591L687.573 964.702l-.489.856c-16.648 29.135-25.085 43.902-36.778 55.042-12.73 12.18-28.043 21.03-44.832 26.02-15.313 4.24-32.47 4.24-66.786 4.24Zm368.062 0h208.84c30.81 0 46.31 0 55.54-6.08 9.96-6.46 16.23-17.35 16.79-29.15.53-10.53-6.87-23.3-21.37-48.323-.5-.852-1-1.719-1.51-2.601L1060.43 785.75l-1.19-2.015c-14.7-24.858-22.12-37.411-31.65-42.263-10.51-5.351-22.88-5.351-33.391 0-9.594 4.981-17.342 18.08-32.655 44.462L857.306 964.891l-.357.616c-15.259 26.34-22.885 39.503-22.335 50.303.738 11.81 6.826 22.69 16.788 29.15 9.041 5.9 24.538 5.9 55.348 5.9Z" fill="currentColor" />
            </svg>
            <strong><b>AVALANCHE</b><b>BAKERY</b></strong>
            <div className="join-brand-end">
              {variant && !embedded ? <em className="join-variant-tag">{variant.toUpperCase()}안</em> : null}
              {back && !embedded ? (
                <ExitLink label={back.label} href={back.href} onClick={back.onBack} tone="paper" />
              ) : null}
            </div>
          </div>
          <ol className="join-progress" aria-label={`${STEP_LABELS.length}단계 중 ${currentStep}단계`}>
            {STEP_LABELS.map((label, index) => {
              const number = index + 1;
              return (
                <li
                  className={number === currentStep ? 'is-current' : number < currentStep ? 'is-done' : ''}
                  key={label}
                >
                  <i />
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>
        </header>
        <div className="join-content">{children}</div>
      </div>
    </main>
  );
}

export function StepHeading({ title, copy }: {
  title: string;
  copy: string;
}) {
  return (
    <header className="join-step-heading">
      <h1>{title}</h1>
      <p>{copy}</p>
    </header>
  );
}
