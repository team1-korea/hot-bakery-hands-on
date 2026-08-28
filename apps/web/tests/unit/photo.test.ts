import { describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';

import { CERTIFICATE_SIZE } from '@/lib/photo';

function jpegSize(bytes: Buffer) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        width: bytes.readUInt16BE(offset + 7),
        height: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += length + 2;
  }
  throw new Error('JPEG 크기를 읽지 못했습니다.');
}

describe('NFT 증서 규격', () => {
  test('프레임을 포함한 최종 이미지는 1080×1440 3:4 세로형이다', () => {
    expect(CERTIFICATE_SIZE).toEqual({ width: 1080, height: 1440 });
    expect(CERTIFICATE_SIZE.width / CERTIFICATE_SIZE.height).toBe(3 / 4);
  });

  test('E2E 프레임도 운영 디자인과 같은 3:4 JPG 규격을 사용한다', async () => {
    const frame = await readFile('tests/fixtures/certificate-frame.jpg');

    expect([...frame.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(jpegSize(frame)).toEqual({ width: 960, height: 1280 });
  });

  test('배포 화면 리허설은 사진이 든 별도 3:4 JPG를 사용한다', async () => {
    const certificate = await readFile('tests/fixtures/display-load-certificate.jpg');

    expect([...certificate.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(jpegSize(certificate)).toEqual({ width: 960, height: 1280 });
    expect(certificate.length).toBeGreaterThan(100_000);
  });

  test('닉네임 합성에 한글 전체가 든 Pretendard Bold를 사용한다', async () => {
    const font = await readFile('public/assets/fonts/pretendard-bold.woff2');

    expect(font.subarray(0, 4).toString()).toBe('wOF2');
    expect(font.length).toBeGreaterThan(700_000);
  });
});
