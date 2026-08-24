import { describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';

import { CERTIFICATE_SIZE } from '@/lib/photo';

describe('NFT 증서 규격', () => {
  test('프레임을 포함한 최종 이미지는 1080×1440 3:4 세로형이다', () => {
    expect(CERTIFICATE_SIZE).toEqual({ width: 1080, height: 1440 });
    expect(CERTIFICATE_SIZE.width / CERTIFICATE_SIZE.height).toBe(3 / 4);
  });

  test('브라우저가 합성할 디자인 PNG도 최종 증서 규격과 같다', async () => {
    const frame = await readFile('public/assets/certificate/certificate-frame-v1.png');

    expect(frame.subarray(1, 4).toString()).toBe('PNG');
    expect(frame.readUInt32BE(16)).toBe(CERTIFICATE_SIZE.width);
    expect(frame.readUInt32BE(20)).toBe(CERTIFICATE_SIZE.height);
  });
});
