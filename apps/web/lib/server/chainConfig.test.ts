import assert from 'node:assert/strict';
import test from 'node:test';

import fujiDeployment from '@contracts/deployments/43113.json';

import { resolveServerChainConfig } from './chainConfig';

const MAINNET_ADDRESS = '0x1111111111111111111111111111111111111111';

test('기본값과 빈 체인 ID는 커밋된 Fuji 배포를 사용한다', () => {
  for (const chainId of [undefined, '']) {
    const config = resolveServerChainConfig({ NEXT_PUBLIC_CHAIN_ID: chainId });
    assert.equal(config.chainId, 43113);
    assert.equal(config.contractAddress, fujiDeployment.address);
    assert.equal(config.deploymentBlock, BigInt(fujiDeployment.deploymentBlock));
  }
});

test('Fuji는 미리 등록한 메인넷 주소와 배포 블록을 무시한다', () => {
  const config = resolveServerChainConfig({
    NEXT_PUBLIC_CHAIN_ID: '43113',
    CERTIFICATE_ADDRESS: MAINNET_ADDRESS,
    CERTIFICATE_DEPLOYMENT_BLOCK: '99999999',
  });

  assert.equal(config.contractAddress, fujiDeployment.address);
  assert.equal(config.deploymentBlock, BigInt(fujiDeployment.deploymentBlock));
});

test('메인넷은 주소와 배포 블록을 함께 사용한다', () => {
  const config = resolveServerChainConfig({
    NEXT_PUBLIC_CHAIN_ID: '43114',
    CERTIFICATE_ADDRESS: MAINNET_ADDRESS,
    CERTIFICATE_DEPLOYMENT_BLOCK: '70000000',
  });

  assert.equal(config.chainId, 43114);
  assert.equal(config.contractAddress, MAINNET_ADDRESS);
  assert.equal(config.deploymentBlock, BigInt(70000000));
});

test('메인넷 배포 정보가 없거나 잘못되면 시작 단계에서 거절한다', () => {
  assert.throws(
    () => resolveServerChainConfig({ NEXT_PUBLIC_CHAIN_ID: '43114' }),
    /CERTIFICATE_ADDRESS와 CERTIFICATE_DEPLOYMENT_BLOCK/,
  );
  assert.throws(
    () => resolveServerChainConfig({
      NEXT_PUBLIC_CHAIN_ID: '43114',
      CERTIFICATE_ADDRESS: 'not-an-address',
      CERTIFICATE_DEPLOYMENT_BLOCK: '70000000',
    }),
    /CERTIFICATE_ADDRESS와 CERTIFICATE_DEPLOYMENT_BLOCK/,
  );
  assert.throws(
    () => resolveServerChainConfig({
      NEXT_PUBLIC_CHAIN_ID: '43114',
      CERTIFICATE_ADDRESS: MAINNET_ADDRESS,
      CERTIFICATE_DEPLOYMENT_BLOCK: '0',
    }),
    /CERTIFICATE_ADDRESS와 CERTIFICATE_DEPLOYMENT_BLOCK/,
  );
});
