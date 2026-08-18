import Image from 'next/image';

import type { JoinSubmission } from './joinTypes';

function CookiePlaceholder() {
  return (
    <div className="complete-cookie-placeholder" aria-hidden="true">
      <span><i /><i /><i /></span>
    </div>
  );
}

/**
 * 발행된 증서 한 장. 완료 화면과 되돌아보기 패널이 같은 카드를 쓴다.
 * pending이면 아직 발행 번호가 없는 상태로 보여준다.
 */
export function CertificateCard({ submission, pending = false }: {
  submission: JoinSubmission;
  pending?: boolean;
}) {
  return (
    <article className="join-certificate" data-pending={pending}>
      <header className="join-certificate-brand">
        <span>AVALANCHE BAKERY</span>
      </header>
      <div className="join-certificate-photo">
        <CookiePlaceholder />
        {submission.photoPreview ? (
          <Image
            src={submission.photoPreview}
            alt={`${submission.nickname}의 쿠키`}
            fill
            unoptimized
            sizes="320px"
          />
        ) : null}
      </div>
      <div className="join-certificate-id">
        <span>{submission.nickname}의 증서</span>
        {pending ? <strong className="is-pending">발행 중</strong> : <strong>#{submission.tokenId}</strong>}
      </div>
    </article>
  );
}

/**
 * 진행 화면 안에 놓는 작은 증서. 지금 만들어지는 결과물을 계속 보여준다.
 */
export function CertificateStub({ submission, pending, onOpen }: {
  submission: JoinSubmission;
  pending: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="certificate-stub" data-pending={pending}>
      <div className="certificate-stub-photo">
        <CookiePlaceholder />
        {submission.photoPreview ? (
          <Image src={submission.photoPreview} alt="" fill unoptimized sizes="72px" />
        ) : null}
      </div>
      <div className="certificate-stub-copy">
        <small>{submission.nickname}의 증서</small>
        <b>{pending ? '발행 중' : `#${submission.tokenId}`}</b>
      </div>
      <button className="certificate-stub-open" type="button" onClick={onOpen}>
        크게 보기
      </button>
    </div>
  );
}
