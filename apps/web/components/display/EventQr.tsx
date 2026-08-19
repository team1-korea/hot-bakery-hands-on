/**
 * 참가 페이지로 보내는 실제 QR. 행사장에서 이 코드가 유일한 진입점이다.
 * 서버에서 만든 SVG 문자열을 그대로 심는다.
 */
export function EventQr({ svg }: { svg: string }) {
  return (
    <div className="qr-block" aria-label="참가 페이지 QR 코드">
      <div className="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="qr-copy">
        <strong>사진 올리기</strong>
      </div>
    </div>
  );
}
