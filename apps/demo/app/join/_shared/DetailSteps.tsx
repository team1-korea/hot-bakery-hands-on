import Image from 'next/image';

import { StepHeading } from './JoinShell';

export function NicknameStep({ nickname, onNickname, onNext, onBack }: {
  nickname: string;
  onNickname: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <StepHeading title="앞 화면에 뜰 이름을 정해요" copy="내 쿠키가 오븐과 진열장으로 갈 때 이 이름이 함께 보여요." />
      <form className="join-form" onSubmit={(event) => { event.preventDefault(); onNext(); }}>
        <label className="join-field nickname-field">
          <span>닉네임</span>
          <input value={nickname} onChange={(event) => onNickname(event.target.value.slice(0, 10))} maxLength={10} placeholder="예: 초코별" required />
          <b>{nickname.length} / 10</b>
        </label>
        <button className="join-button is-primary" type="submit" disabled={!nickname.trim()}>이 이름으로 계속</button>
        <button className="join-button is-text" type="button" onClick={onBack}>이전</button>
      </form>
    </>
  );
}

export function SubmitStep({ nickname, preview, onSubmit, onBack }: {
  nickname: string;
  preview: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <StepHeading title="이제 앞 화면으로 보내요" copy="사진과 공개 안내를 확인하면 준비가 끝나요." />
      <div className="join-submit-card">
        <div>{preview ? <Image src={preview} alt="제출할 쿠키" fill unoptimized sizes="112px" /> : null}</div>
        <span><small>TV에 표시될 이름</small><b>{nickname}</b></span>
      </div>
      <div className="join-disclosure">
        <p><b>행사 중 앞 화면에 보여요</b><span>쿠키 사진과 닉네임이 행사장 TV에 표시돼요.</span></p>
        <p><b>공개 디지털 증서가 만들어져요</b><span>한 번 만든 증서는 완전히 삭제하기 어려워요.</span></p>
      </div>
      <div className="join-actions">
        <button className="join-button is-primary" type="button" onClick={onSubmit}>동의하고 쿠키 보내기</button>
        <button className="join-button is-text" type="button" onClick={onBack}>이전</button>
      </div>
    </>
  );
}
