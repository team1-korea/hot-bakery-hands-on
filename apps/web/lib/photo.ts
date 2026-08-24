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

const CERTIFICATE_FRAME_URL = process.env.NEXT_PUBLIC_CERTIFICATE_FRAME_URL
  || '/assets/certificate/nft-design.jpg';

/**
 * 최종 원본(960×1280)의 빨간 사진 안내선은 x=297…661, y=528…892다.
 * 1080×1440으로 키운 안내선보다 사방 약 5px 크게 그려 JPEG 번짐까지 사진으로 덮는다.
 */
const PHOTO_X = 330;
const PHOTO_Y = 590;
const PHOTO_SIZE = 420;

const NAME_FONT_FAMILY = '"Pretendard Certificate"';
const NAME_FONT_WEIGHT = 700;
const NAME_FONT_MAX_SIZE = 60;
const NAME_FONT_MIN_SIZE = 38;
const NAME_Y = 1078;
const NAME_MAX_WIDTH = 620;
const NAME_COLOR = '#DA242D';

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
 * 최종 JPG 시안 위에 사진과 닉네임만 더한다. 사진은 시안의 안내선을 살짝 넘어 덮고,
 * 닉네임은 지정된 Pretendard Bold로 그린다. 운영자 대리업로드
 * (`app/admin/certificate.ts`)도 이 함수를 거친다.
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

  if (frame.width * CERTIFICATE_SIZE.height !== frame.height * CERTIFICATE_SIZE.width) {
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

    const fonts = await document.fonts.load(
      `${NAME_FONT_WEIGHT} ${NAME_FONT_MAX_SIZE}px ${NAME_FONT_FAMILY}`,
    );
    if (fonts.length === 0) {
      throw new ApiError('INTERNAL', '증서 글꼴을 불러오지 못했어요. 다시 시도해 주세요.');
    }

    let fontSize = NAME_FONT_MAX_SIZE;
    ctx.font = `${NAME_FONT_WEIGHT} ${fontSize}px ${NAME_FONT_FAMILY}`;
    while (fontSize > NAME_FONT_MIN_SIZE && ctx.measureText(nickname).width > NAME_MAX_WIDTH) {
      fontSize -= 2;
      ctx.font = `${NAME_FONT_WEIGHT} ${fontSize}px ${NAME_FONT_FAMILY}`;
    }
    ctx.fillStyle = NAME_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nickname, CERTIFICATE_SIZE.width / 2, NAME_Y);

    return await toBlob(canvas, OUTPUT_QUALITY);
  } finally {
    frame.close();
    photo.close();
  }
}
