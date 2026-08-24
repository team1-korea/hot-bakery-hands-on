import { describe, expect, test } from 'vitest';

import { C_CHAIN_EXPLORER_TX } from '@/lib/explorer';

describe('C-Chain Explorer 링크', () => {
  test('기본 Fuji 환경은 공식 테스트넷 Explorer를 사용한다', () => {
    expect(C_CHAIN_EXPLORER_TX).toBe('https://explorer-test.avax.network/c-chain/tx');
  });
});
