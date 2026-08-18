'use client';

import { useState } from 'react';

import { CertificateCard } from './CertificateCard';
import type { JoinSubmission } from './joinTypes';
import { JoinShell, type JoinBack } from './JoinShell';
import { PhoneSheet } from './PhoneSheet';
import { ProcessTimeline } from './ProcessTimeline';
import { PROCESS_DONE } from './processSteps';
import type { JoinVariantId } from './variants';

export function CompletionScreen({ submission, embedded = false, showProcess = false, variant, back }: {
  submission: JoinSubmission;
  embedded?: boolean;
  variant?: JoinVariantId;
  back?: JoinBack;
  /** 제출 뒤 네 단계를 본 참가자에게만 그 과정을 다시 열어 준다. */
  showProcess?: boolean;
}) {
  const [processOpen, setProcessOpen] = useState(false);

  return (
    <JoinShell
      currentStep={4}
      embedded={embedded}
      variant={variant}
      back={embedded ? undefined : back ?? { label: '처음 화면', href: '/' }}
    >
      <section className="join-step join-complete">
        <header className="complete-heading">
          <h1>완성됐어요</h1>
        </header>

        <CertificateCard submission={submission} />

        <p className="complete-shelf-note">
          앞 화면 <b>{String(submission.shelfNumber).padStart(2, '0')}</b>번 칸에도 놓였어요
        </p>

        {showProcess ? (
          <button className="complete-process-open" type="button" onClick={() => setProcessOpen(true)}>
            증서가 만들어진 과정 다시 보기
          </button>
        ) : null}
      </section>

      {showProcess ? (
        <PhoneSheet open={processOpen} title="쿠키가 증서가 되는 길" onClose={() => setProcessOpen(false)}>
          <ProcessTimeline phase={PROCESS_DONE} mode="review" />
          <p className="sheet-footnote">
            네 단계 모두 자동으로 끝났어요. 증서 번호는 <b>#{submission.tokenId}</b>예요.
          </p>
        </PhoneSheet>
      ) : null}
    </JoinShell>
  );
}
