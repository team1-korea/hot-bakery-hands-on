'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';

import { ApiError, getMyEntry, getState, registerParticipant, submitEntry } from '@/lib/api/client';
import { MAX_ENTRIES, type Entry } from '@/lib/api/types';
import { composeCertificate, cropPhoto, loadPhoto, type CropRect, type PhotoSource } from '@/lib/photo';

import { JoinShell } from './JoinShell';
import { LoginStep, NicknameStep, PhotoStep, ReviewStep } from './JoinSteps';
import { PRIVY_ENABLED } from './PrivyClientProvider';
import { SubmittedView } from './SubmittedView';
import { usePrivyLogin } from './usePrivyLogin';

type Stage = 'loading' | 'login' | 'nickname' | 'photo' | 'review';

const STEPS_WITH_PRIVY = ['로그인', '닉네임', '사진', '확인'] as const;
const STEPS_WITHOUT_PRIVY = ['닉네임', '사진', '확인'] as const;
const STEPS = PRIVY_ENABLED ? STEPS_WITH_PRIVY : STEPS_WITHOUT_PRIVY;

const STEP_OF: Record<Exclude<Stage, 'loading'>, number> = PRIVY_ENABLED
  ? { login: 1, nickname: 2, photo: 3, review: 4 }
  : { login: 0, nickname: 1, photo: 2, review: 3 };

export function JoinFlow() {
  const [stage, setStage] = useState<Stage>('loading');
  const [entry, setEntry] = useState<Entry | null>(null);
  const [nickname, setNickname] = useState('');
  const [source, setSource] = useState<PhotoSource | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState(false);

  const { login, authenticated } = usePrivyLogin();
  const firstStage: Stage = PRIVY_ENABLED ? 'login' : 'nickname';

  useEffect(() => {
    getMyEntry()
      .then((existing) => {
        if (existing?.photoUrl) setEntry(existing);
        else if (existing) { setNickname(existing.nickname); setStage('photo'); }
        else setStage(PRIVY_ENABLED && !authenticated ? 'login' : firstStage === 'login' ? 'login' : 'nickname');
      })
      .catch(() => setStage(firstStage));

    getState()
      .then((state) => setFull(state.counts.submitted >= MAX_ENTRIES))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
  }, [photo]);

  useEffect(() => () => {
    if (source) URL.revokeObjectURL(source.url);
  }, [source]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = () => run(async () => {
    await login();
    setStage('nickname');
  });

  const confirmNickname = () => run(async () => {
    await registerParticipant(nickname.trim());
    setStage('photo');
  });

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    void run(async () => {
      setSource(await loadPhoto(file));
      setCrop(null);
    });
  };

  const changeCrop = useCallback((rect: CropRect) => setCrop(rect), []);

  const confirmPhoto = () => run(async () => {
    if (!source || !crop) throw new ApiError('INVALID_PHOTO', '쿠키 사진을 먼저 골라 주세요.');
    const cropped = await cropPhoto(source, crop);
    const blob = await composeCertificate(cropped, nickname);
    setPhoto({ blob, previewUrl: URL.createObjectURL(blob) });
    setStage('review');
  });

  const submit = () => run(async () => {
    if (!photo) throw new ApiError('INVALID_PHOTO', '쿠키 사진을 선택해 주세요.');
    setEntry(await submitEntry({ photo: photo.blob }));
  });

  if (entry) {
    return (
      <JoinShell step={STEPS.length + 1} steps={STEPS}>
        <SubmittedView initialEntry={entry} />
      </JoinShell>
    );
  }

  if (full && stage !== 'loading') {
    return (
      <JoinShell step={0} steps={STEPS}>
        <section className="join-wait">
          <h1>오늘은 자리가<br />다 찼어요</h1>
          <p className="join-closed">
            진열장 {MAX_ENTRIES}칸이 모두 찼습니다.<br />운영자에게 말씀해 주세요.
          </p>
        </section>
      </JoinShell>
    );
  }

  if (stage === 'loading') {
    return (
      <JoinShell step={1} steps={STEPS}>
        <section className="join-step" />
      </JoinShell>
    );
  }

  return (
    <JoinShell step={STEP_OF[stage]} steps={STEPS}>
      {stage === 'login' ? (
        <LoginStep busy={busy} error={error} onLogin={handleLogin} />
      ) : null}
      {stage === 'nickname' ? (
        <NicknameStep
          nickname={nickname}
          error={error}
          busy={busy}
          onNickname={setNickname}
          onNext={confirmNickname}
        />
      ) : null}
      {stage === 'photo' ? (
        <PhotoStep
          source={source}
          crop={crop}
          error={error}
          busy={busy}
          onPhoto={choosePhoto}
          onCrop={changeCrop}
          onNext={confirmPhoto}
        />
      ) : null}
      {stage === 'review' ? (
        <ReviewStep
          nickname={nickname}
          previewUrl={photo?.previewUrl ?? null}
          error={error}
          busy={busy}
          onSubmit={submit}
          onBack={() => setStage('photo')}
        />
      ) : null}
    </JoinShell>
  );
}
