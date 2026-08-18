'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState, type ChangeEvent } from 'react';

import { NicknameStep, SubmitStep } from './DetailSteps';
import { JoinShell, type JoinBack } from './JoinShell';
import { EmailStep, CodeStep } from './LoginSteps';
import { PhotoStep } from './PhotoStep';
import { STEP_NUMBER, type CommonJoinStage, type JoinSubmission } from './joinTypes';
import type { JoinVariantId } from './variants';

const FLOW_EASE = [0.22, 1, 0.36, 1] as const;

export function CommonJoinFlow({ onSubmit, variant, back }: {
  onSubmit: (submission: JoinSubmission) => void;
  variant?: JoinVariantId;
  back?: JoinBack;
}) {
  const [stage, setStage] = useState<CommonJoinStage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const reduceMotion = useReducedMotion();

  useEffect(() => () => {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
  }, [preview]);

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview((current) => {
      if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
  };
  const submit = () => onSubmit({ nickname: nickname.trim(), photoPreview: preview, shelfNumber: 7, tokenId: 1048 });

  return (
    <JoinShell
      currentStep={STEP_NUMBER[stage]}
      variant={variant}
      back={back ?? { label: '처음 화면', href: '/' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          className="join-step"
          key={stage}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : -16 }}
          transition={{ duration: reduceMotion ? 0 : 0.42, ease: FLOW_EASE }}
        >
          {stage === 'email' ? <EmailStep email={email} onEmail={setEmail} onCode={() => setStage('code')} onGoogle={() => setStage('photo')} /> : null}
          {stage === 'code' ? <CodeStep code={code} email={email} onCode={setCode} onNext={() => setStage('photo')} onBack={() => setStage('email')} /> : null}
          {stage === 'photo' ? <PhotoStep preview={preview} onPhoto={choosePhoto} onSample={() => setPreview('/mock/cookie-1.svg')} onNext={() => setStage('nickname')} onBack={() => setStage('email')} /> : null}
          {stage === 'nickname' ? <NicknameStep nickname={nickname} onNickname={setNickname} onNext={() => setStage('submit')} onBack={() => setStage('photo')} /> : null}
          {stage === 'submit' ? <SubmitStep nickname={nickname} preview={preview} onSubmit={submit} onBack={() => setStage('nickname')} /> : null}
        </motion.section>
      </AnimatePresence>
    </JoinShell>
  );
}
