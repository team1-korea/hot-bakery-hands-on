import { ApiError } from './api/client';

/**
 * 조정 화면이 다룰 원본 크기.
 * 휴대폰 사진은 4000px대라 그대로 들고 있을 이유가 없다. 여기서 한 번 줄여 두면
 * 손가락으로 끌 때 버벅이지 않고, EXIF 회전도 이 시점에 확정된다.
 */
const SOURCE_MAX_EDGE = 1600;

/** 증서 안에 들어가는 정사각형 사진의 최대 한 변. 크게 확대하면 이보다 작게 나온다. */
const OUTPUT_MAX_EDGE = 1080;

/** 중간 산물이라 손실을 덜 준다. 최종 인코딩은 잘라 낼 때 한 번 더 한다. */
const SOURCE_QUALITY = 0.92;
const OUTPUT_QUALITY = 0.82;

/** 사진을 축소해 여백이 생겼을 때 그 자리를 채우는 색. 진열장·증서의 바탕과 같다. */
const PAPER = '#f7f1e8';
const AVA = '#e84142';
const INK = '#050505';

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

/** 프레임을 포함한 최종 NFT 증서 규격. 사진 크롭 영역의 1:1 비율과는 별개다. */
export const CERTIFICATE_SIZE = { width: 1080, height: 1440 } as const;

const CERTIFICATE_FRAME_URL = '/assets/certificate/certificate-frame-v1.png';

/* 최종 디자인 에셋을 받으면 디자이너가 준 사진·닉네임 영역 좌표로 교체한다. */
const PHOTO_X = 270;
const PHOTO_Y = 480;
const PHOTO_SIZE = 540;
const NAME_Y = 1104;
const NAME_MAX_WIDTH = 680;

let cachedCertificateFrame: Blob | null = null;

async function loadCertificateFrame(): Promise<Blob> {
  if (cachedCertificateFrame) return cachedCertificateFrame;

  let response: Response;
  try {
    response = await fetch(CERTIFICATE_FRAME_URL, { cache: 'force-cache' });
  } catch {
    throw new ApiError('INTERNAL', '증서 디자인을 불러오지 못했어요. 다시 시도해 주세요.');
  }
  if (!response.ok) {
    throw new ApiError('INTERNAL', '증서 디자인을 불러오지 못했어요. 다시 시도해 주세요.');
  }

  cachedCertificateFrame = await response.blob();
  return cachedCertificateFrame;
}

/**
 * 잘라 낸 정사각형 사진을 3:4 세로형 증서 디자인에 합성한다.
 *
 * 현재 v1 에셋은 완성 전 시안이라 기존 쿠키·이름·ID를 덮어서 개발한다. 최종 PNG가 오면
 * 에셋과 위 좌표만 교체한다. 운영자 대리업로드(`app/admin/certificate.ts`)도 이 함수를 거친다.
 */
export async function composeCertificate(croppedBlob: Blob, nickname: string): Promise<Blob> {
  const frameBlob = await loadCertificateFrame();
  let frame: ImageBitmap | null = null;
  let photo: ImageBitmap | null = null;

  try {
    frame = await createImageBitmap(frameBlob);
    photo = await createImageBitmap(croppedBlob);
  } catch {
    frame?.close();
    photo?.close();
    throw new ApiError('INTERNAL', '증서를 만들지 못했어요. 다시 시도해 주세요.');
  }

  if (frame.width !== CERTIFICATE_SIZE.width || frame.height !== CERTIFICATE_SIZE.height) {
    frame.close();
    photo.close();
    throw new ApiError('INTERNAL', '증서 디자인 크기가 올바르지 않아요. 운영자에게 알려 주세요.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = CERTIFICATE_SIZE.width;
  canvas.height = CERTIFICATE_SIZE.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    frame.close();
    photo.close();
    throw new ApiError('INTERNAL', '증서를 만들지 못했어요. 다시 시도해 주세요.');
  }

  try {
    ctx.drawImage(frame, 0, 0, CERTIFICATE_SIZE.width, CERTIFICATE_SIZE.height);
    ctx.drawImage(photo, PHOTO_X, PHOTO_Y, PHOTO_SIZE, PHOTO_SIZE);

    ctx.strokeStyle = AVA;
    ctx.lineWidth = 4;
    ctx.strokeRect(PHOTO_X, PHOTO_Y, PHOTO_SIZE, PHOTO_SIZE);

    // 개발용 시안에 박혀 있는 HEEJIN과 CERTIFICATE ID를 최종 에셋을 받을 때까지 가린다.
    ctx.fillStyle = INK;
    ctx.fillRect(170, 1028, 740, 116);
    ctx.fillRect(270, 1218, 540, 112);

    await document.fonts.ready;
    const fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';
    let fontSize = 72;
    ctx.font = `900 ${fontSize}px ${fontFamily}`;
    while (fontSize > 40 && ctx.measureText(nickname).width > NAME_MAX_WIDTH) {
      fontSize -= 2;
      ctx.font = `900 ${fontSize}px ${fontFamily}`;
    }
    ctx.fillStyle = AVA;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nickname, CERTIFICATE_SIZE.width / 2, NAME_Y);

    return await toBlob(canvas, OUTPUT_QUALITY);
  } finally {
    frame.close();
    photo.close();
  }
}
