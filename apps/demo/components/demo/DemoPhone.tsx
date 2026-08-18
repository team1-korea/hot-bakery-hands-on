import { CompletionScreen } from '@/app/join/_shared/CompletionScreen';
import { JoinShell } from '@/app/join/_shared/JoinShell';
import { SubmitStep } from '@/app/join/_shared/DetailSteps';
import { AutomaticPost, GuidedPost } from '@/app/join/_variants/PostSubmitViews';
import { participantTiming } from '@/lib/mockScenario';

import {
  completionBuffer,
  makeSubmission,
  type DemoVariant,
  type SubmissionPattern,
} from './demoState';

function guidedPhase(localMs: number, timing: ReturnType<typeof participantTiming>) {
  const renderedAt = timing.renderedAt - timing.startAt;
  const mintingAt = timing.mintingAt - timing.startAt;
  const mintedAt = timing.mintedAt - timing.startAt;
  if (localMs < renderedAt) return 0;
  if (localMs < mintingAt) return 1;
  if (localMs < mintedAt) return 2;
  return 3;
}

export function DemoPhone({
  variant,
  participantIndex,
  localMs,
  pattern,
}: {
  variant: DemoVariant;
  participantIndex: number;
  localMs: number;
  pattern: SubmissionPattern;
}) {
  const submission = makeSubmission(participantIndex);
  const timing = participantTiming(participantIndex, pattern);
  const mintedAt = timing.mintedAt - timing.startAt;
  const completeAt = mintedAt + completionBuffer(pattern) + (variant === 'b' ? 600 : 0);

  if (localMs >= completeAt) {
    return <CompletionScreen submission={submission} embedded showProcess={variant === 'b'} />;
  }

  return (
    <JoinShell currentStep={4} embedded>
      {localMs < 600 ? (
        <section className="join-step">
          <SubmitStep
            nickname={submission.nickname}
            preview={submission.photoPreview}
            onSubmit={() => {}}
            onBack={() => {}}
          />
        </section>
      ) : null}
      {localMs >= 600 && variant === 'a' ? <AutomaticPost submission={submission} /> : null}
      {localMs >= 600 && variant === 'b' ? (
        <GuidedPost phase={guidedPhase(localMs, timing)} submission={submission} />
      ) : null}
    </JoinShell>
  );
}
