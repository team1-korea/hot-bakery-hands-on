'use client';

import type { ChangeEvent } from 'react';
import { useRef } from 'react';

export function EmailStep({ email, error, busy, onEmail, onNext }: {
  email: string;
  error: string | null;
  busy: boolean;
  onEmail: (value: string) => void;
  onNext: () => void;
}) {
  return (
    <section className="join-step">
      <h1>오늘 구운 쿠키를<br />증서로 남겨요</h1>
      <p>이메일로 인증 코드를 보내 드려요. 증서를 다시 찾을 때 쓰는 주소예요.</p>

      <label className="join-field">
        <span>이메일</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => onEmail(event.target.value)}
        />
      </label>
      {error ? <p className="join-error">{error}</p> : null}

      <div className="join-actions">
        <button
          className="join-button"
          data-tone="primary"
          type="button"
          disabled={busy || email.trim().length === 0}
          onClick={onNext}
        >
          {busy ? '보내는 중…' : '인증 코드 받기'}
        </button>
      </div>
    </section>
  );
}

export function CodeStep({ email, code, error, busy, hint, onCode, onNext, onBack }: {
  email: string;
  code: string;
  error: string | null;
  busy: boolean;
  hint: string | null;
  onCode: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <section className="join-step">
      <h1>코드를 넣어 주세요</h1>
      <p>{email}로 보낸 여섯 자리 숫자예요.</p>

      <label className="join-field" data-variant="code">
        <span>인증 코드</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(event) => onCode(event.target.value.replace(/\D/g, ''))}
        />
      </label>
      {hint ? <p className="join-hint">{hint}</p> : null}
      {error ? <p className="join-error">{error}</p> : null}

      <div className="join-actions">
        <button
          className="join-button"
          data-tone="primary"
          type="button"
          disabled={busy || code.length !== 6}
          onClick={onNext}
        >
          {busy ? '확인 중…' : '확인'}
        </button>
        <button className="join-button" data-tone="quiet" type="button" onClick={onBack}>
          이메일 다시 넣기
        </button>
      </div>
    </section>
  );
}

export function PhotoStep({ previewUrl, error, busy, onPhoto, onNext }: {
  previewUrl: string | null;
  error: string | null;
  busy: boolean;
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void;
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
      <p>이 사진이 그대로 증서에 담겨요.</p>

      <div className="join-photo">
        {previewUrl ? (
          // 로컬 blob 미리보기라 next/image의 최적화 대상이 아니다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="선택한 쿠키 사진" />
        ) : (
          <p>{busy ? '사진을 준비하고 있어요…' : '아직 사진이 없어요'}</p>
        )}
      </div>
      {error ? <p className="join-error">{error}</p> : null}

      <input
        className="join-photo-input"
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPhoto}
      />
      <input
        className="join-photo-input"
        ref={album}
        type="file"
        accept="image/*"
        onChange={onPhoto}
      />

      <div className="join-actions">
        <div className="join-photo-sources">
          <button className="join-button" type="button" disabled={busy} onClick={() => camera.current?.click()}>
            {previewUrl ? '다시 찍기' : '카메라로 찍기'}
          </button>
          <button className="join-button" type="button" disabled={busy} onClick={() => album.current?.click()}>
            앨범에서 고르기
          </button>
        </div>
        <button
          className="join-button"
          data-tone="primary"
          type="button"
          disabled={!previewUrl || busy}
          onClick={onNext}
        >
          다음
        </button>
      </div>
    </section>
  );
}

export function NicknameStep({ nickname, onNickname, onNext, onBack }: {
  nickname: string;
  onNickname: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <section className="join-step">
      <h1>증서에 적을<br />이름을 알려 주세요</h1>
      <p>행사장 앞 화면에도 이 이름으로 놓여요.</p>

      <label className="join-field">
        <span>이름 · 최대 12자</span>
        <input
          type="text"
          maxLength={12}
          placeholder="쿠키왕"
          value={nickname}
          onChange={(event) => onNickname(event.target.value)}
        />
      </label>

      <div className="join-actions">
        <button
          className="join-button"
          data-tone="primary"
          type="button"
          disabled={nickname.trim().length === 0}
          onClick={onNext}
        >
          다음
        </button>
        <button className="join-button" data-tone="quiet" type="button" onClick={onBack}>
          사진 다시 고르기
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
      <h1>이대로 보낼까요?</h1>
      <p>보내고 나면 사진과 이름은 바꿀 수 없어요. 증서는 공개 기록으로 남아요.</p>

      <div className="join-review">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="보낼 쿠키 사진" />
        ) : null}
        <div>
          <strong>{nickname}</strong>
          <small>이름과 사진이 앞 화면 진열장에 놓이고, 증서 번호가 발행돼요.</small>
        </div>
      </div>
      {error ? <p className="join-error">{error}</p> : null}

      <div className="join-actions">
        <button
          className="join-button"
          data-tone="primary"
          type="button"
          disabled={busy}
          onClick={onSubmit}
        >
          {busy ? '보내는 중…' : '보내기'}
        </button>
        <button className="join-button" data-tone="quiet" type="button" disabled={busy} onClick={onBack}>
          이름 고치기
        </button>
      </div>
    </section>
  );
}
