import { composeCertificate, cropPhoto, loadPhoto, type CropRect, type PhotoSource } from '@/lib/photo';

/**
 * 운영자가 고른 원본 사진을 참가자가 보낸 것과 **같은 증서**로 만든다.
 *
 * 서버는 이미지를 다시 그리지 않는다(DECISIONS.md). 참가자 화면이 브라우저에서
 * 자르고 프레임까지 둘러 보내기 때문이다. 대리 업로드가 같은 합성을 거치지 않으면
 * 프레임 없는 증서가 IPFS에 올라가고 그대로 체인에 박힌다.
 */

function centerSquare(source: PhotoSource): CropRect {
  const size = Math.min(source.width, source.height);
  return {
    sx: Math.round((source.width - size) / 2),
    sy: Math.round((source.height - size) / 2),
    size,
  };
}

export async function buildCertificate(file: File, nickname: string): Promise<Blob> {
  const source = await loadPhoto(file);
  try {
    const square = await cropPhoto(source, centerSquare(source));
    return composeCertificate(square, nickname);
  } finally {
    URL.revokeObjectURL(source.url);
  }
}
