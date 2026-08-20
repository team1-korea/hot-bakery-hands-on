'use client';

import type { ChangeEvent } from 'react';
import { useRef } from 'react';

import type { CropRect, PhotoSource } from '@/lib/photo';

import { PhotoCropper } from './PhotoCropper';

export function PhotoStep({ source, crop, error, busy, onPhoto, onCrop, onNext }: {
  source: PhotoSource | null;
  crop: CropRect | null;
  error: string | null;
  busy: boolean;
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void;
  onCrop: (rect: CropRect) => void;
  onNext: () => void;
}) {
  /*
   * 사진을 가져오는 길을 둘로 나눠 놓는다.
   *
   * 하나의 입력에 `capture`를 걸면 카메라만 열리고 앨범이 막힌다. 아예 빼면 이번엔
   * 무엇이 열릴지 기기마다 달라진다. 참가자가 누르기 전에 무엇이 열릴지 알게 하려고
   * 입력을 둘 두고 버튼도 둘 둔다.
   */
  const camera = useRef<HTMLInputElement>(null);
  const album = useRef<HTMLInputElement>(null);

  return (
    <section className="join-step">
      <h1>쿠키 사진을<br />한 장 올려 주세요</h1>
      <p>{source ? '끌어서 옮기고 손가락 두 개로 크기를 맞춰요.' : '이 사진이 그대로 증서에 담겨요.'}</p>

      {source ? (
        <PhotoCropper source={source} crop={crop} onCrop={onCrop} />
      ) : (
        <div className="photo-frame is-empty">
          <p>{busy ? '사진을 준비하고 있어요…' : '아직 사진이 없어요'}</p>
          <div className="photo-guide" aria-hidden="true"><i /><i /><i /><i /></div>
        </div>
      )}
      <p className="join-guide">틀 안에 쿠키가 꽉 차게 맞춰 주세요. 틀 밖은 잘려 나가요.</p>
      {error ? <p className="join-error">{error}</p> : null}

      {/*
        * 두 입력은 버튼이 대신 눌러 주는 통로일 뿐이다. 이름이 없어서 탭 순서에 그대로
        * 두면 "파일 선택"만 둘 지나간 뒤에야 진짜 버튼이 나온다. 보조기술에는 숨긴다.
        */}
      <input
        className="join-photo-input"
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPhoto}
      />
      <input
        className="join-photo-input"
        ref={album}
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPhoto}
      />

      <div className="join-actions">
        <div className="join-photo-sources">
          <button className="join-button" type="button" disabled={busy} onClick={() => camera.current?.click()}>
            {source ? '다시 찍기' : '카메라로 찍기'}
          </button>
          <button className="join-button" type="button" disabled={busy} onClick={() => album.current?.click()}>
            앨범에서 고르기
          </button>
        </div>
        <button
          className="join-button"
          data-tone="primary"
          type="button"
          disabled={!source || busy}
          onClick={onNext}
        >
          다음
        </button>
      </div>
    </section>
  );
}

export function NicknameStep({ nickname, error, busy, onNickname, onNext }: {
  nickname: string;
  error: string | null;
  busy: boolean;
  onNickname: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <section className="join-step">
      <h1>증서에 적을<br />닉네임을 정해 주세요</h1>
      <p>본명 대신 불릴 닉네임을 적어 주세요. 앞 화면과 증서에 이대로 남습니다.</p>

      <label className="join-field">
        <span>닉네임 · 최대 12자</span>
        <input
          type="text"
          maxLength={12}
          placeholder="쿠키왕"
          value={nickname}
          onChange={(event) => onNickname(event.target.value)}
        />
      </label>

      {error ? <p className="join-error">{error}</p> : null}

      <div className="join-actions">
        <button
          className="join-button"
          data-tone="primary"
          type="button"
          disabled={busy || nickname.trim().length === 0}
          onClick={onNext}
        >
          {busy ? '등록하는 중…' : '다음'}
        </button>
      </div>
    </section>
  );
}

export function ReviewStep({ nickname, previewUrl, error, busy, onSubmit, onBack }: {
  nickname: string;
  previewUrl: string | null;
  error: string | null;
  busy: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <section className="join-step">
      <h1>이 사진으로<br />발행할까요?</h1>
      <p>아래 그림이 그대로 증서가 돼요.</p>

      {/*
        * 확인 화면의 사진은 크게 보여야 한다. 작게 두면 잘렸는지 알 수 없어서,
        * 확인 절차가 있으나 마나 한 것이 된다.
        */}
      <div className="join-review">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="발행될 쿠키 사진" />
        ) : null}
        <strong>{nickname}</strong>
      </div>
      <p className="join-warn">
        발행하면 되돌릴 수 없어요. 사진과 닉네임은 블록체인에 공개로 영원히 남습니다.
      </p>
      {error ? <p className="join-error">{error}</p> : null}

      <div className="join-actions">
        <button
          className="join-button"
          data-tone="primary"
          type="button"
          disabled={busy}
          onClick={onSubmit}
        >
          {busy ? '보내는 중…' : '이 사진으로 발행하기'}
        </button>
        <button className="join-button" data-tone="quiet" type="button" disabled={busy} onClick={onBack}>
          뒤로 가서 고치기
        </button>
      </div>
    </section>
  );
}
