'use client';

import { useEffect, useState } from 'react';

import { CommonJoinFlow } from '../_shared/CommonJoinFlow';
import { CompletionScreen } from '../_shared/CompletionScreen';
import { JoinShell } from '../_shared/JoinShell';
import type { JoinSubmission } from '../_shared/joinTypes';
import { GuidedPost } from './PostSubmitViews';

const BACK = { label: '다른 안 보기', href: '/join' } as const;

export function GuidedJoin() {
  const [submission, setSubmission] = useState<JoinSubmission | null>(null);
  const [phase, setPhase] = useState(0);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!submission) return;
    const timers = [
      window.setTimeout(() => setPhase(1), 2_200),
      window.setTimeout(() => setPhase(2), 4_700),
      window.setTimeout(() => setPhase(3), 8_000),
      window.setTimeout(() => setComplete(true), 10_500),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [submission]);

  if (!submission) return <CommonJoinFlow onSubmit={setSubmission} variant="b" back={BACK} />;
  if (complete) return <CompletionScreen submission={submission} showProcess variant="b" back={BACK} />;

  return (
    <JoinShell currentStep={4} variant="b" back={BACK}>
      <GuidedPost phase={phase} submission={submission} />
    </JoinShell>
  );
}
