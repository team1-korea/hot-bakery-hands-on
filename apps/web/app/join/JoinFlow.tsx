'use client';

import { useCallback, useEffect, useState, type ChangeEvent } from 'react';

import { ApiError, getMyEntry, getState, registerParticipant, submitEntry } from '@/lib/api/client';
import { MAX_ENTRIES, type Entry } from '@/lib/api/types';
import { cropPhoto, loadPhoto, type CropRect, type PhotoSource } from '@/lib/photo';

import { JoinShell } from './JoinShell';
import { NicknameStep, PhotoStep, ReviewStep } from './JoinSteps';
import { SubmittedView } from './SubmittedView';

/**
 * 닉네임이 사진보다 먼저다. 등록이 끝나야 TV에 카드가 올라가고, 사진을 못 올리는
 * 참가자를 운영자가 대신 처리할 수 있다.
 */
type Stage = 'loading' | 'nickname' | 'photo' | 'review';

const STEP_OF: Record<Exclude<Stage, 'loading'>, number> = {
  nickname: 1,
  photo: 2,
  review: 3,
};

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

  // 새로고침하거나 화면이 꺼졌다 켜져도 제출한 사람은 대기 화면으로 돌아온다.
  useEffect(() => {
    /*
     * 이미 사진까지 낸 사람은 대기 화면으로, 등록만 한 사람은 사진 단계로 돌아온다.
     * 새로고침하거나 화면이 꺼졌다 켜져도 처음부터 다시 하지 않는다.
     */
    getMyEntry()
      .then((existing) => {
        if (existing?.photoUrl) setEntry(existing);
        else if (existing) { setNickname(existing.nickname); setStage('photo'); }
        else setStage('nickname');
      })
      .catch(() => setStage('nickname'));

    /*
     * 자리가 남았는지 들어오자마자 확인한다.
     *
     * 만석 판단의 주인은 서버다(`SHOWCASE_FULL`). 다만 서버만 믿으면 참가자는 메일을
     * 인증하고 사진을 찍고 이름까지 쓴 뒤에야 자리가 없다는 말을 듣는다. 여기서 미리
     * 알려 주고, 확인에 실패하면 그냥 평소대로 진행시킨다.
     */
    getState()
      .then((state) => setFull(state.counts.submitted >= MAX_ENTRIES))
      .catch(() => {});
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

  /*
   * 닉네임을 넣는 순간 등록한다. 여기서 TV 작업대에 카드가 올라간다.
   *
   * TODO(Privy): 이 앞에 구글 로그인이 들어간다. 지금은 목 인증이라 바로 등록된다.
   *   `PRIVY_APP_ID`가 생기면 로그인 → 토큰 → 이 호출 순서가 된다.
   */
  const confirmNickname = () => run(async () => {
    await registerParticipant(nickname.trim());
    setStage('photo');
  });

  const choosePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    void run(async () => {
      // 새 사진을 고르면 맞춰 둔 자리는 의미가 없다. 가운데에서 다시 시작한다.
      setSource(await loadPhoto(file));
      setCrop(null);
    });
  };

  /* 조정 화면이 매 움직임마다 부른다. 참조가 바뀌면 그쪽 effect가 계속 돌아 안정시킨다. */
  const changeCrop = useCallback((rect: CropRect) => setCrop(rect), []);

  const confirmPhoto = () => run(async () => {
    if (!source || !crop) throw new ApiError('INVALID_PHOTO', '쿠키 사진을 먼저 골라 주세요.');
    const blob = await cropPhoto(source, crop);
    setPhoto({ blob, previewUrl: URL.createObjectURL(blob) });
    setStage('review');
  });

  const submit = () => run(async () => {
    if (!photo) throw new ApiError('INVALID_PHOTO', '쿠키 사진을 선택해 주세요.');
    setEntry(await submitEntry({ photo: photo.blob }));
  });

  if (entry) {
    return (
      <JoinShell step={4}>
        <SubmittedView initialEntry={entry} />
      </JoinShell>
    );
  }

  /*
   * 내 제출 내역 조회가 끝난 뒤에만 만석을 알린다.
   * 두 요청은 따로 돌아오므로, 먼저 온 만석 응답을 그대로 믿으면 이미 제출한 사람이
   * 자기 대기 화면 직전에 "자리가 없다"는 말을 한 번 보게 된다.
   */
  if (full && stage !== 'loading') {
    return (
      <JoinShell step={0}>
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
      <JoinShell step={1}>
        <section className="join-step" />
      </JoinShell>
    );
  }

  return (
    <JoinShell step={STEP_OF[stage]}>
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
