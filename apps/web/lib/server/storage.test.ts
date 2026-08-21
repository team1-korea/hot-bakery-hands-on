import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clearStoredPhotos, photoUrl, putPhoto, readStoredPhoto } from './storage';

test('DATABASE_URL이 있는데 Storage 설정이 빠지면 메모리로 fallback하지 않는다', async () => {
  const keys = [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_BUCKET',
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  process.env.DATABASE_URL = 'postgresql://configured.example/test';
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_BUCKET;

  try {
    await assert.rejects(
      () => putPhoto('entry-id', { bytes: new Uint8Array([1]), contentType: 'image/png' }),
      /SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY.*SUPABASE_BUCKET/,
    );
    await assert.rejects(() => readStoredPhoto('entry-id'), /Supabase Storage 설정/);
    await assert.rejects(() => clearStoredPhotos(), /Supabase Storage 설정/);
    assert.throws(() => photoUrl('entry-id'), /Supabase Storage 설정/);
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('Storage 초기화는 entries/ 아래 파일 경로를 나열해 정확한 객체를 삭제한다', async () => {
  const keys = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_BUCKET'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const deleted: string[][] = [];

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.SUPABASE_BUCKET = 'certificates';

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      prefix?: string;
      prefixes?: string[];
    };

    if (url.endsWith('/storage/v1/object/list/certificates')) {
      if (body.prefix === 'entries') {
        return Response.json([
          { name: 'entry-a', metadata: null },
          { name: 'legacy.jpg', metadata: { mimetype: 'image/jpeg' } },
        ]);
      }
      if (body.prefix === 'entries/entry-a') {
        return Response.json([
          { name: 'first.jpg', metadata: { mimetype: 'image/jpeg' } },
          { name: 'second.jpg', metadata: { mimetype: 'image/jpeg' } },
        ]);
      }
    }

    if (url.endsWith('/storage/v1/object/certificates') && init?.method === 'DELETE') {
      deleted.push(body.prefixes ?? []);
      return Response.json({ message: 'Successfully deleted' });
    }

    return new Response('unexpected request', { status: 500 });
  };

  try {
    assert.equal(await clearStoredPhotos(), 3);
    assert.deepEqual(deleted, [[
      'entries/entry-a/first.jpg',
      'entries/entry-a/second.jpg',
      'entries/legacy.jpg',
    ]]);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
