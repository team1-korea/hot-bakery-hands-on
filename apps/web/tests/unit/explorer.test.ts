import { describe, expect, test } from 'vitest';

import { C_CHAIN, C_CHAIN_EXPLORER_TX, resolveCChain } from '@/lib/explorer';

describe('C-Chain Explorer 링크', () => {
  test('기본 Fuji 환경은 공식 테스트넷 Explorer를 사용한다', () => {
    expect(C_CHAIN_EXPLORER_TX).toBe('https://explorer-test.avax.network/c-chain/tx');
    expect(C_CHAIN).toMatchObject({ id: '43113', label: 'Fuji C-Chain', testnet: true });
  });

  test('메인넷 설정은 Explorer와 교육 화면이 함께 쓸 네트워크 정보를 돌려준다', () => {
    expect(resolveCChain('43114')).toEqual({
      id: '43114',
      label: 'Avalanche C-Chain',
      testnet: false,
      explorerTx: 'https://explorer.avax.network/c-chain/tx',
    });
  });
});
