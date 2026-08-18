import Image from 'next/image';
import type { ChangeEvent } from 'react';

import { StepHeading } from './JoinShell';

export function PhotoStep({ preview, onPhoto, onSample, onNext, onBack }: {
  preview: string | null;
  onPhoto: (event: ChangeEvent<HTMLInputElement>) => void;
  onSample: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <StepHeading title="방금 구운 쿠키를 찍어 주세요" copy="쿠키가 가운데 오도록 가까이 찍으면 진열장에서 더 잘 보여요." />
      <div className="join-photo-frame">
        <div className="join-photo-placeholder" aria-hidden="true" />
        {preview ? <Image src={preview} alt="선택한 쿠키 사진 미리보기" fill unoptimized sizes="320px" /> : null}
        <span className="join-crop-mark">정사각형으로 보여요</span>
      </div>
      <div className="join-actions is-photo-actions">
        <label className={`join-button join-camera-button ${preview ? 'is-secondary' : 'is-primary'}`}>
          {preview ? '다시 찍기' : '카메라 열기'}
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
        </label>
        {!preview ? <button className="join-button is-text" type="button" onClick={onSample}>샘플 사진으로 보기</button> : null}
        {preview ? <button className="join-button is-primary" type="button" onClick={onNext}>이 사진으로 계속</button> : null}
        <button className="join-button is-text" type="button" onClick={onBack}>이전</button>
      </div>
    </>
  );
}
