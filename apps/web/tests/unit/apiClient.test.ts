import { afterEach, describe, expect, test, vi } from 'vitest';

import { ApiError, setAuthTokenGetter, submitEntry } from '@/lib/api/client';
import type { Entry } from '@/lib/api/types';

const ENTRY: Entry = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  nickname: '쿠키왕',
  status: 'SUBMITTED',
  photoUrl: '/api/photos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tokenId: null,
  txHash: null,
  shelfIndex: 0,
  hidden: false,
  failureReason: null,
  submittedAt: '2026-08-23T00:00:00.000Z',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  setAuthTokenGetter(null);
  vi.unstubAllGlobals();
});

describe('참가자 사진 제출 복구', () => {
  test('서버가 이미 받은 제출이면 현재 항목을 읽어 성공으로 복구한다', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ error: { code: 'ALREADY_SUBMITTED', message: '이미 사진을 보냈어요.' } }, 409))
      .mockResolvedValueOnce(json(ENTRY));
    vi.stubGlobal('fetch', fetch);

    await expect(submitEntry({ photo: new Blob(['photo'], { type: 'image/jpeg' }) })).resolves.toEqual(ENTRY);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toBe('/api/entries');
  });

  test('응답이 불확실한 네트워크 오류도 현재 항목으로 복구한다', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('connection lost'))
      .mockResolvedValueOnce(json(ENTRY));
    vi.stubGlobal('fetch', fetch);

    await expect(submitEntry({ photo: new Blob(['photo'], { type: 'image/jpeg' }) })).resolves.toEqual(ENTRY);
  });

  test('사진 검증 오류는 다시 조회하지 않고 그대로 알린다', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(
      json({ error: { code: 'INVALID_PHOTO', message: '사진이 너무 커요.' } }, 400),
    );
    vi.stubGlobal('fetch', fetch);

    await expect(submitEntry({ photo: new Blob(['photo'], { type: 'image/jpeg' }) }))
      .rejects.toMatchObject({ code: 'INVALID_PHOTO' } satisfies Partial<ApiError>);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
