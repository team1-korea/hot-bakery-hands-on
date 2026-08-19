import { ApiError } from './api/client';

const MAX_EDGE = 1280;
const QUALITY = 0.82;

/**
 * 휴대폰 원본 사진은 3~5MB다. 행사장 와이파이로 그대로 올리면 제출이 느려지고 실패한다.
 * 긴 변을 1280px로 줄이고 JPEG로 다시 인코딩해 200KB 안팎으로 만든다.
 * `imageOrientation: 'from-image'`가 EXIF 회전을 적용하므로 사진이 눕지 않는다.
 */
export async function preparePhoto(file: File): Promise<{ blob: Blob; previewUrl: string }> {
  /*
   * 브라우저가 못 읽는 형식이면 여기서 걸린다.
   * "잠시 후 다시 시도"라고 말하면 안 된다. 다시 시도해도 같은 파일은 계속 실패한다.
   */
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ApiError('INVALID_PHOTO', '이 사진은 열지 못했어요. 다시 찍어 주세요.');
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new ApiError('INTERNAL', '사진을 준비하지 못했어요. 다시 시도해 주세요.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', QUALITY);
  });
  if (!blob) throw new ApiError('INVALID_PHOTO', '사진을 변환하지 못했어요. 다시 찍어 주세요.');

  return { blob, previewUrl: URL.createObjectURL(blob) };
}
