import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PinataClient, buildCertificateMetadata } from './ipfs';

test('metadata는 ipfs image만 담고 external_url·tokenId를 넣지 않는다', () => {
  const metadata = buildCertificateMetadata({
    nickname: '쿠키왕',
    certificateCid: 'bafy-certificate',
    submittedAt: new Date('2026-08-29T03:00:00.000Z'),
  });

  assert.equal(metadata.image, 'ipfs://bafy-certificate');
  assert.match(metadata.name, /쿠키왕/);
  assert.equal(metadata.attributes[2].value, 1787972400);
  assert.ok(!('external_url' in metadata));
  assert.ok(!JSON.stringify(metadata).includes('tokenId'));
});

test('PinataClient가 파일과 JSON을 JWT로 핀하고 CID를 돌려준다', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return Response.json({ IpfsHash: calls.length === 1 ? 'bafy-file' : 'bafy-json' });
  }) as typeof fetch;
  const client = new PinataClient('secret-jwt', fakeFetch, 'https://pinata.test');

  assert.equal(
    await client.pinFile({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' }, 'certificate.jpg'),
    'bafy-file',
  );
  assert.equal(
    await client.pinJson(
      buildCertificateMetadata({
        nickname: '쿠키',
        certificateCid: 'bafy-file',
        submittedAt: new Date(0),
      }),
      'metadata.json',
    ),
    'bafy-json',
  );

  assert.equal(calls[0].url, 'https://pinata.test/pinning/pinFileToIPFS');
  assert.ok(calls[0].init.body instanceof FormData);
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, 'Bearer secret-jwt');
  assert.equal(calls[1].url, 'https://pinata.test/pinning/pinJSONToIPFS');
  assert.match(String(calls[1].init.body), /bafy-file/);
  assert.ok(!String(calls[1].init.body).includes('external_url'));
});

test('Pinata가 CID 없는 성공 응답을 주면 실패한다', async () => {
  const fakeFetch = (async () => Response.json({})) as typeof fetch;
  const client = new PinataClient('secret-jwt', fakeFetch);

  await assert.rejects(
    () => client.pinFile({ bytes: new Uint8Array([1]), contentType: 'image/png' }, 'x.png'),
    /IpfsHash/,
  );
});

test('JWT가 없어도 클라이언트 생성은 되지만 실제 핀 요청은 보내지 않는다', async () => {
  let called = false;
  const fakeFetch = (async () => {
    called = true;
    return Response.json({ IpfsHash: 'never' });
  }) as typeof fetch;
  const client = new PinataClient('', fakeFetch);

  await assert.rejects(
    () => client.pinFile({ bytes: new Uint8Array([1]), contentType: 'image/png' }, 'x.png'),
    /PINATA_JWT/,
  );
  assert.equal(called, false);
});
