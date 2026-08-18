'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';

import { CertificateCard, CertificateStub } from '../_shared/CertificateCard';
import type { JoinSubmission } from '../_shared/joinTypes';
import { PhoneSheet } from '../_shared/PhoneSheet';
import { ProcessTimeline } from '../_shared/ProcessTimeline';
import { PROCESS_DONE } from '../_shared/processSteps';

export function AutomaticPost({ submission }: { submission: JoinSubmission }) {
  return (
    <section className="join-step post-submit post-a">
      <h1>당신의 쿠키를<br />굽고 있어요</h1>
      <div className="look-up-message">
        <small>지금은 폰에서 할 일이 없어요</small>
        <strong>고개를 들어<br />앞 화면을 보세요</strong>
      </div>
      <p>당신의 자리는 <b>{submission.shelfNumber}번 칸</b></p>
    </section>
  );
}

export function GuidedPost({ phase, submission }: {
  phase: number;
  submission: JoinSubmission;
}) {
  const [certificateOpen, setCertificateOpen] = useState(false);
  const pending = phase < PROCESS_DONE - 1;

  return (
    <>
      <section className="join-step post-submit post-b">
        <header><h1>쿠키가 증서가 되는 길</h1></header>
        <ProcessTimeline phase={phase} />
        <CertificateStub
          submission={submission}
          pending={pending}
          onOpen={() => setCertificateOpen(true)}
        />
      </section>

      <PhoneSheet
        open={certificateOpen}
        title={pending ? '지금 만들고 있는 증서' : '발행된 증서'}
        onClose={() => setCertificateOpen(false)}
      >
        <CertificateCard submission={submission} pending={pending} />
        <p className="sheet-footnote">
          {pending
            ? '번호는 굽기가 끝나면 정해져요.'
            : `앞 화면 ${String(submission.shelfNumber).padStart(2, '0')}번 칸에도 같은 증서가 놓여요.`}
        </p>
      </PhoneSheet>
    </>
  );
}

export function ParticipatoryPost({ submission, started, onStart }: {
  submission: JoinSubmission;
  started: boolean;
  onStart: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <section className={`join-step post-submit post-c ${started ? 'is-started' : ''}`}>
      {!started ? (
        <>
          <h1>쿠키를 오븐에 넣을 준비가 됐어요</h1>
          <div className="operator-callout"><i /><b>운영자 안내를 기다려 주세요</b><small>“다 같이 눌러 주세요”라는 말을 들으면 시작해요.</small></div>
          <motion.button className="oven-action" type="button" onClick={onStart} whileTap={reduceMotion ? undefined : { scale: 0.94, y: 4 }} transition={{ duration: 0.16 }}>
            오븐에 넣기
          </motion.button>
        </>
      ) : (
        <div className="c-started-message">
          <strong>고개를 들어<br />앞 화면을 보세요</strong>
          <p>오븐이 시작됐어요. {submission.nickname} 쿠키가 지금 앞 화면으로 이동해요.</p>
        </div>
      )}
    </section>
  );
}
