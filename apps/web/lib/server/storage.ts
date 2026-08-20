/**
 * 증서 이미지 보관소. 저장되는 이미지는 **프론트가 프레임까지 합성해 보낸 한 장**뿐이다
 * (PIPELINE.md 1단계). 서버는 바이트를 다시 그리지 않는다.
 *
 * `SUPABASE_URL`이 없으면 메모리에 들고 `/api/photos/{id}`로 돌려준다 — 프론트 담당자가
 * Supabase 없이 개발할 수 있어야 하기 때문이다. 있으면 Storage에 올리고 공개 URL을
 * 돌려주며, 그때 `/api/photos/{id}`는 경로에서 빠진다.
 *
 * **supabase-js를 쓰지 않는다.** 올리기·읽기 두 개뿐이라 REST 호출이 더 짧고
 * 의존성이 하나 줄어든다.
 */

export type Photo = { bytes: Uint8Array; contentType: string };

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** 행사장 와이파이가 죽었을 때 인보케이션이 영원히 매달리지 않게 한다. */
const UPLOAD_TIMEOUT_MS = 15_000;

/** 업로드마다 키가 달라서 같은 URL이 다른 그림이 되는 일이 없다. 그래서 길게 캐시한다. */
const CACHE_CONTROL = 'max-age=31536000';

type Config = { url: string; key: string; bucket: string };

function config(): Config | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET;
  if (!url || !key || !bucket) return null;
  return { url: url.replace(/\/$/, ''), key, bucket };
}

const globalKey = Symbol.for('hot-bakery.photos');
const globalScope = globalThis as unknown as Record<symbol, Map<string, Photo> | undefined>;

/** 개발 중 모듈이 다시 평가돼도 올린 사진이 사라지지 않게 전역에 고정한다. */
const memoryPhotos: Map<string, Photo> =
  globalScope[globalKey] ?? (globalScope[globalKey] = new Map());

/**
 * 증서 한 장을 저장하고 `entries.certificate_path`에 넣을 키를 돌려준다.
 *
 * 키는 참가자별 폴더 아래 **업로드 시각**이다. 참가자당 키를 하나로 고정해 덮어쓰면
 * 운영자가 대리 업로드로 사진을 갈아끼워도 URL이 그대로라, TV의 `<img>`도 CDN도 옛
 * 이미지를 계속 보여준다 — 재촬영이 필요한 상황에서 제일 하면 안 되는 일이다.
 * 키가 달라지면 그 문제가 통째로 없어지고, 대신 재촬영마다 옛 이미지가 하나 남는다.
 * DB의 `certificate_path`가 언제나 진짜 하나를 가리키므로 그 잔재는 아무도 보지 않는다.
 *
 * 같은 밀리초에 두 번 들어온 요청은 같은 키가 되고, `x-upsert`가 그것을 덮어쓴다.
 */
export async function putPhoto(entryId: string, photo: Photo): Promise<string> {
  const supabase = config();
  if (!supabase) {
    memoryPhotos.set(entryId, photo);
    return entryId;
  }

  const path = `entries/${entryId}/${Date.now()}.${EXTENSIONS[photo.contentType] ?? 'bin'}`;
  const response = await fetch(objectUrl(supabase, path), {
    method: 'POST',
    headers: {
      apikey: supabase.key,
      authorization: `Bearer ${supabase.key}`,
      'content-type': photo.contentType,
      'cache-control': CACHE_CONTROL,
      'x-upsert': 'true',
    },
    body: photo.bytes as BodyInit,
    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`증서 업로드 실패 (${response.status}): ${await response.text()}`);
  }
  return path;
}

/** `certificate_path`를 화면이 쓸 URL로 바꾼다. 사진이 없으면 null이다. */
export function photoUrl(path: string | null): string | null {
  if (path === null) return null;
  const supabase = config();
  if (!supabase) return `/api/photos/${path}`;
  return `${supabase.url}/storage/v1/object/public/${supabase.bucket}/${path}`;
}

/**
 * `GET /api/photos/{id}`가 쓴다. **Supabase를 쓰는 배포에서는 항상 null이다** —
 * 그때 `photoUrl`은 공개 URL이라 이 라우트를 거치지 않는다.
 */
export async function getPhoto(entryId: string): Promise<Photo | null> {
  return memoryPhotos.get(entryId) ?? null;
}

/** 테스트 전용. 메모리 보관분을 비운다. */
export function clearPhotos(): void {
  memoryPhotos.clear();
}

function objectUrl(supabase: Config, path: string): string {
  return `${supabase.url}/storage/v1/object/${supabase.bucket}/${path}`;
}
