const MAX_EDGE = 1280;
const QUALITY = 0.82;

/**
 * 휴대폰 원본 사진은 3~5MB다. 행사장 와이파이로 그대로 올리면 제출이 느려지고 실패한다.
 * 긴 변을 1280px로 줄이고 JPEG로 다시 인코딩해 200KB 안팎으로 만든다.
 * `imageOrientation: 'from-image'`가 EXIF 회전을 적용하므로 사진이 눕지 않는다.
 */
export async function preparePhoto(file: File): Promise<{ blob: Blob; previewUrl: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas 2d context를 만들 수 없습니다.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', QUALITY);
  });
  if (!blob) throw new Error('사진을 변환하지 못했습니다.');

  return { blob, previewUrl: URL.createObjectURL(blob) };
}
