'use client';

import { useEffect, useState } from 'react';

import { CommonJoinFlow } from '../_shared/CommonJoinFlow';
import { CompletionScreen } from '../_shared/CompletionScreen';
import { JoinShell } from '../_shared/JoinShell';
import type { JoinSubmission } from '../_shared/joinTypes';
import { AutomaticPost } from './PostSubmitViews';

const BACK = { label: '다른 안 보기', href: '/join' } as const;

export function AutomaticJoin() {
  const [submission, setSubmission] = useState<JoinSubmission | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!submission) return;
    const timer = window.setTimeout(() => setComplete(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [submission]);

  if (!submission) return <CommonJoinFlow onSubmit={setSubmission} variant="a" back={BACK} />;
  if (complete) return <CompletionScreen submission={submission} variant="a" back={BACK} />;

  return (
    <JoinShell currentStep={4} variant="a" back={BACK}>
      <AutomaticPost submission={submission} />
    </JoinShell>
  );
}
