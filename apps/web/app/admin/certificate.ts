import { cropPhoto, loadPhoto, type CropRect, type PhotoSource } from '@/lib/photo';

/**
 * 운영자가 고른 원본 사진을 참가자가 보낸 것과 **같은 증서**로 만든다.
 *
 * 서버는 이미지를 다시 그리지 않는다(DECISIONS.md). 참가자 화면이 브라우저에서
 * 자르고 프레임까지 둘러 보내기 때문이다. 대리 업로드가 같은 합성을 거치지 않으면
 * 프레임 없는 증서가 IPFS에 올라가고 그대로 체인에 박힌다.
 */

/**
 * 정중앙 정사각형.
 *
 * 참가자에게는 손가락으로 맞추는 조정 화면이 있지만 운영자에게는 두지 않는다.
 * 손 든 참가자 앞에서 쓰는 화면이라 고를 것이 하나라도 적은 쪽이 낫다.
 */
function centerSquare(source: PhotoSource): CropRect {
  const size = Math.min(source.width, source.height);
  return {
    sx: Math.round((source.width - size) / 2),
    sy: Math.round((source.height - size) / 2),
    size,
  };
}

export async function buildCertificate(file: File): Promise<Blob> {
  const source = await loadPhoto(file);
  try {
    const square = await cropPhoto(source, centerSquare(source));

    /*
     * ─────────── 프레임 합성 자리 ───────────
     *
     * `lib/photo.ts`에 공용 합성 함수가 들어오면 여기 한 줄이 된다:
     *
     *     return composeCertificate(square);
     *
     * 프레임 이미지도 그 함수도 아직 없다(참가자 화면 담당 + 디자인 대기).
     * 그때까지 대리 업로드는 **프레임 없는 정사각형**을 보낸다.
     * 행사 전에 반드시 이 자리를 채우세요.
     */
    return square;
  } finally {
    // 조정 화면이 없으니 미리보기 URL을 쓸 일이 없다. 들고 있으면 새기만 한다.
    URL.revokeObjectURL(source.url);
  }
}
