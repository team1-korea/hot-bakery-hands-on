'use client';

import { useEffect, useState } from 'react';

import { CommonJoinFlow } from '../_shared/CommonJoinFlow';
import { CompletionScreen } from '../_shared/CompletionScreen';
import { JoinShell } from '../_shared/JoinShell';
import type { JoinSubmission } from '../_shared/joinTypes';
import { ParticipatoryPost } from './PostSubmitViews';

export function ParticipatoryJoin() {
  const [submission, setSubmission] = useState<JoinSubmission | null>(null);
  const [started, setStarted] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!started) return;
    const timer = window.setTimeout(() => setComplete(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [started]);

  const startOven = () => {
    navigator.vibrate?.(45);
    setStarted(true);
  };

  if (!submission) return <CommonJoinFlow onSubmit={setSubmission} />;
  if (complete) return <CompletionScreen submission={submission} />;

  return (
    <JoinShell currentStep={4} back={{ label: '처음 화면', href: '/' }}>
      <ParticipatoryPost submission={submission} started={started} onStart={startOven} />
    </JoinShell>
  );
}
