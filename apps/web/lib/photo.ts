import { ApiError } from './api/client';

/**
 * 조정 화면이 다룰 원본 크기.
 * 휴대폰 사진은 4000px대라 그대로 들고 있을 이유가 없다. 여기서 한 번 줄여 두면
 * 손가락으로 끌 때 버벅이지 않고, EXIF 회전도 이 시점에 확정된다.
 */
const SOURCE_MAX_EDGE = 1600;

/** 발행되는 정사각형의 최대 한 변. 크게 확대한 경우엔 이보다 작게 나온다. */
const OUTPUT_MAX_EDGE = 1080;

/** 중간 산물이라 손실을 덜 준다. 최종 인코딩은 잘라 낼 때 한 번 더 한다. */
const SOURCE_QUALITY = 0.92;
const OUTPUT_QUALITY = 0.82;

/** 사진을 축소해 여백이 생겼을 때 그 자리를 채우는 색. 진열장·증서의 바탕과 같다. */
const PAPER = '#f7f1e8';
const AVA = '#e84142';
const INK = '#17110f';
const GOLD = '#d9a441';

/** 조정 화면이 붙들고 있는 원본. `blob`은 잘라 낼 때 다시 디코드하는 데 쓴다. */
export type PhotoSource = { url: string; blob: Blob; width: number; height: number };

/** 원본 좌표계에서 잘라 낼 정사각형. */
export type CropRect = { sx: number; sy: number; size: number };

/**
 * 잘라 낼 사각형이 사진 바깥으로 나갈 수 있다. 참가자가 축소해 사진 전체를 담으면
 * 위아래나 좌우에 빈 자리가 남기 때문이다. 겹치는 부분만 옮겨 그리고 나머지는 바탕색으로 둔다.
 */
function draw(bitmap: ImageBitmap, rect: CropRect, out: number) {
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const context = canvas.getContext('2d');
  if (!context) throw new ApiError('INTERNAL', '사진을 준비하지 못했어요. 다시 시도해 주세요.');

  context.fillStyle = PAPER;
  context.fillRect(0, 0, out, out);

  const left = Math.max(0, rect.sx);
  const top = Math.max(0, rect.sy);
  const right = Math.min(bitmap.width, rect.sx + rect.size);
  const bottom = Math.min(bitmap.height, rect.sy + rect.size);
  if (right <= left || bottom <= top) return canvas;

  const ratio = out / rect.size;
  context.drawImage(
    bitmap,
    left, top, right - left, bottom - top,
    (left - rect.sx) * ratio, (top - rect.sy) * ratio,
    (right - left) * ratio, (bottom - top) * ratio,
  );
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob
        ? resolve(blob)
        : reject(new ApiError('INVALID_PHOTO', '사진을 변환하지 못했어요. 다시 찍어 주세요.'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * 고른 사진을 조정 화면이 쓸 수 있는 형태로 만든다.
 *
 * `imageOrientation: 'from-image'`가 EXIF 회전을 적용하므로, 이 뒤로는 사진이 눕지
 * 않고 width/height도 보이는 그대로다. 방향을 여기서 확정해야 조정 화면의 좌표와
 * 잘라 낸 결과가 어긋나지 않는다.
 */
export async function loadPhoto(file: File): Promise<PhotoSource> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // "잠시 후 다시 시도"라고 말하면 안 된다. 다시 시도해도 같은 파일은 계속 실패한다.
    throw new ApiError('INVALID_PHOTO', '이 사진은 열지 못했어요. 다시 찍어 주세요.');
  }

  const scale = Math.min(1, SOURCE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new ApiError('INTERNAL', '사진을 준비하지 못했어요. 다시 시도해 주세요.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await toBlob(canvas, SOURCE_QUALITY);
  return { url: URL.createObjectURL(blob), blob, width, height };
}

/**
 * 참가자가 틀 안에 맞춘 그대로 잘라 낸다.
 *
 * 크게 확대했으면 잘라 낼 영역 자체가 작다. 그걸 1080까지 늘리면 흐려지기만 하므로
 * 원본이 가진 만큼만 내보낸다.
 */
export async function cropPhoto(source: PhotoSource, rect: CropRect): Promise<Blob> {
  const bitmap = await createImageBitmap(source.blob);
  const out = Math.min(OUTPUT_MAX_EDGE, Math.round(rect.size));
  const canvas = draw(bitmap, rect, out);
  bitmap.close();
  return toBlob(canvas, OUTPUT_QUALITY);
}

const CERT_SIZE = 1080;
const PHOTO_INSET = 80;
const PHOTO_SIZE = CERT_SIZE - PHOTO_INSET * 2;
const BORDER_WIDTH = 4;
const TITLE_Y = 46;
const NAME_Y = CERT_SIZE - 44;

/**
 * 잘라 낸 정사각형 사진에 프레임을 둘러 증서 이미지를 만든다.
 *
 * 디자인 에셋이 오면 이 함수 안만 바꾸면 된다. 지금은 프로그래밍적 프레임을 쓴다.
 * 운영자 대리업로드(`app/admin/certificate.ts`)도 이 함수를 거친다.
 */
export async function composeCertificate(croppedBlob: Blob, nickname: string): Promise<Blob> {
  const bitmap = await createImageBitmap(croppedBlob);
  const canvas = document.createElement('canvas');
  canvas.width = CERT_SIZE;
  canvas.height = CERT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ApiError('INTERNAL', '증서를 만들지 못했어요. 다시 시도해 주세요.');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CERT_SIZE, CERT_SIZE);

  ctx.drawImage(bitmap, PHOTO_INSET, PHOTO_INSET, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = BORDER_WIDTH;
  ctx.strokeRect(
    PHOTO_INSET - BORDER_WIDTH,
    PHOTO_INSET - BORDER_WIDTH,
    PHOTO_SIZE + BORDER_WIDTH * 2,
    PHOTO_SIZE + BORDER_WIDTH * 2,
  );

  ctx.strokeStyle = AVA;
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, CERT_SIZE - 32, CERT_SIZE - 32);

  ctx.fillStyle = INK;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('AVALANCHE BAKERY', CERT_SIZE / 2, TITLE_Y);

  ctx.font = 'bold 24px sans-serif';
  ctx.textBaseline = 'bottom';
  ctx.fillText(nickname, CERT_SIZE / 2, NAME_Y);

  return toBlob(canvas, OUTPUT_QUALITY);
}
