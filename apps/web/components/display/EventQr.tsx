import type { MouseEvent, Ref } from 'react';

/**
 * 참가 페이지로 보내는 실제 QR. 행사장에서 이 코드가 유일한 진입점이다.
 * 서버에서 만든 SVG 문자열을 그대로 심는다.
 */
export function EventQr({
  svg,
  onExpand,
  buttonRef,
}: {
  svg: string;
  onExpand: () => void;
  buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={buttonRef}
      className="qr-block"
      type="button"
      aria-label="참가 QR 크게 보기"
      onClick={onExpand}
    >
      <span className="qr-code" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="qr-copy">
        <strong>사진 올리기</strong>
        <span>QR 크게 보기</span>
      </div>
    </button>
  );
}

export function ExpandedEventQr({ svg, onClose }: { svg: string; onClose: () => void }) {
  const closeFromBackdrop = (event: MouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <section
      className="qr-expanded"
      role="dialog"
      aria-modal="true"
      aria-label="참가 QR 확대"
      onMouseDown={closeFromBackdrop}
    >
      <button className="qr-expanded-back" type="button" autoFocus onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" strokeWidth="3" />
        </svg>
        원래 화면으로 돌아가기
      </button>
      <div className="qr-expanded-layout">
        <div className="qr-expanded-copy">
          <h2>
            <span>휴대폰으로</span>
            <span>QR을 찍어 주세요</span>
          </h2>
          <p>스캔하면 쿠키 사진을 올리는 화면이 열립니다.</p>
        </div>
        <div
          className="qr-expanded-code"
          aria-label="확대된 참가 페이지 QR 코드"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </section>
  );
}
